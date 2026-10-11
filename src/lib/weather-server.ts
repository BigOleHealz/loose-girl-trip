import 'server-only';
import { climateStay, stayDays, type MonthClimate, type WeatherData } from './weather';

interface Daily { time: string[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[] }
async function dailyWeather(url: URL, revalidate: number): Promise<Daily> {
  const response = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error('Weather provider is unavailable. Please retry shortly.');
  const data = await response.json();
  const daily = data.daily as Daily | undefined;
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.temperature_2m_max) || !Array.isArray(daily.temperature_2m_min)) throw new Error('Weather provider returned incomplete data.');
  return daily;
}
function weatherUrl(host: string, path: string, lat: number, lon: number) {
  const url = new URL(path, host);
  url.search = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lon.toFixed(4),
    daily: 'temperature_2m_max,temperature_2m_min', temperature_unit: 'fahrenheit', timezone: 'auto' }).toString();
  return url;
}
export async function getWeather(lat: number, lon: number, arrive: string, depart: string, now = new Date()): Promise<WeatherData> {
  const lastYear = now.getUTCFullYear() - 1;
  const archive = weatherUrl('https://archive-api.open-meteo.com','/v1/archive',lat,lon);
  archive.searchParams.set('start_date', `${lastYear - 9}-01-01`);
  archive.searchParams.set('end_date', `${lastYear}-12-31`);
  archive.searchParams.set('models', 'era5_land');
  const daily = await dailyWeather(archive, 2592000);
  const buckets = Array.from({ length: 12 }, () => ({ high: 0, low: 0, count: 0 }));
  daily.time.forEach((date, i) => {
    const high = daily.temperature_2m_max[i], low = daily.temperature_2m_min[i];
    const month = Number(date.slice(5, 7));
    if (month >= 1 && month <= 12 && typeof high === 'number' && Number.isFinite(high) && typeof low === 'number' && Number.isFinite(low)) {
      const bucket = buckets[month - 1]; bucket.high += high; bucket.low += low; bucket.count++;
    }
  });
  if (buckets.some(b => b.count < 250)) throw new Error('Ten-year monthly weather is incomplete.');
  const months: MonthClimate[] = buckets.map((b, i) => ({ month: i + 1, avgHighF: b.high / b.count, avgLowF: b.low / b.count }));
  const today = now.toISOString().slice(0, 10);
  const offset = (Date.parse(arrive + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  if (offset >= 0 && offset <= 14) {
    const forecast = weatherUrl('https://api.open-meteo.com','/v1/forecast',lat,lon);
    forecast.searchParams.set('forecast_days','16');
    const days = await dailyWeather(forecast, 3600);
    const stay = new Set(stayDays(arrive, depart));
    const included = days.time.map((date, i) => ({ date, high: days.temperature_2m_max[i], low: days.temperature_2m_min[i] }))
      .filter(d => stay.has(d.date) && typeof d.high === 'number' && Number.isFinite(d.high) && typeof d.low === 'number' && Number.isFinite(d.low));
    if (!included.length) throw new Error('Forecast does not cover this arrival yet. Please retry later.');
    return { source: 'forecast', avgHighF: included.reduce((s,d) => s + d.high!,0) / included.length,
      avgLowF: included.reduce((s,d) => s + d.low!,0) / included.length, months,
      coverage: `Forecast through ${included.at(-1)!.date} · ${included.length} of ${stay.size} stay days`, partial: included.length < stay.size };
  }
  return { source: 'climate', ...climateStay(months, arrive, depart), months,
    coverage: `${lastYear - 9}–${lastYear} monthly averages · weighted by stay dates`, partial: false };
}
