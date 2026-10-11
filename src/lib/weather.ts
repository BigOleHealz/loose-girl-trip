import type { Stop, Trip } from './types';
import { nights, stayError } from './trip';

export interface MonthClimate { month: number; avgHighF: number; avgLowF: number }
export interface WeatherData {
  source: 'climate' | 'forecast'; avgHighF: number; avgLowF: number;
  months: MonthClimate[]; coverage: string; partial: boolean;
}
export function weatherTone(weather: Stop['weather'], threshold: number) {
  if (!weather) return 'unknown';
  return weather.avgLowF < threshold ? 'cold' : weather.avgLowF < threshold + 5 ? 'borderline' : 'warm';
}
export function stopWeather(data: WeatherData, threshold: number): NonNullable<Stop['weather']> {
  return { source: data.source, avgHighF: data.avgHighF, avgLowF: data.avgLowF,
    isCold: data.avgLowF < threshold, bestMonths: data.months.filter(m => m.avgLowF >= threshold).map(m => m.month) };
}
export function stayDays(arrive: string, depart: string): string[] {
  const start = Date.parse(arrive + 'T00:00:00Z');
  const length = Math.max(1, nights({ arriveDate: arrive, departDate: depart }));
  if (length > 3660) throw new Error('Weather supports stays up to ten years.');
  return Array.from({ length }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}
export function climateStay(months: MonthClimate[], arrive: string, depart: string) {
  const days = stayDays(arrive, depart);
  const values = days.map(day => months.find(m => m.month === Number(day.slice(5, 7))));
  if (values.some(v => !v)) throw new Error('Monthly weather is incomplete.');
  return { avgHighF: values.reduce((sum, v) => sum + v!.avgHighF, 0) / days.length,
    avgLowF: values.reduce((sum, v) => sum + v!.avgLowF, 0) / days.length };
}
export function warmerStay(stop: Stop, months: MonthClimate[], trip: Pick<Trip, 'startDate' | 'endDate' | 'coldThresholdF'>, today = new Date().toISOString().slice(0, 10)) {
  const start = new Date(`${stop.arriveDate > today ? stop.arriveDate : today}T00:00:00Z`);
  const day = Number(stop.arriveDate.slice(8));
  for (let i = 0; i < 25; i++) {
    const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last)));
    const arriveDate = date.toISOString().slice(0, 10);
    const departDate = new Date(date.getTime() + nights(stop) * 86400000).toISOString().slice(0, 10);
    if (arriveDate < today || arriveDate === stop.arriveDate || stayError(arriveDate, departDate, trip)) continue;
    if (stayDays(arriveDate, departDate).every(d => (months.find(m => m.month === Number(d.slice(5, 7)))?.avgLowF ?? -Infinity) >= trip.coldThresholdF)) return { arriveDate, departDate };
  }
  return null;
}
export function monthLabel(months: number[]) {
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const groups: string[] = [];
  for (let i = 0; i < months.length; i++) {
    const from = months[i]; let to = from;
    while (months[i + 1] === to + 1) to = months[++i];
    groups.push(from === to ? names[from - 1] : `${names[from - 1]}–${names[to - 1]}`);
  }
  return groups.join(', ');
}
