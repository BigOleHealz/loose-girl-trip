import 'server-only';
import type { GasPrices, GasPrice } from './budget';
export async function getGasPrices(): Promise<GasPrices> {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error('Gas prices are not configured.');
  const url = new URL('https://api.eia.gov/v2/petroleum/pri/gnd/data/');
  url.search = new URLSearchParams({ api_key: key, frequency: 'weekly', 'data[0]': 'value',
    'facets[product][]': 'EPMR', 'facets[process][]': 'PTE', 'sort[0][column]': 'period', 'sort[0][direction]': 'desc', length: '200' }).toString();
  const response = await fetch(url,{ next: { revalidate: 86400 }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Gas prices could not load.');
  const data = await response.json();
  const rows = data.response?.data;
  if (!Array.isArray(rows)) throw new Error('Gas prices are incomplete.');
  const valid = rows.filter(row => typeof row.period === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.period) && typeof row.duoarea === 'string' && row.units === '$/GAL' && Number.isFinite(Number(row.value)) && Number(row.value) > 0);
  const period = valid.map(row => row.period as string).sort().at(-1);
  if (!period) throw new Error('Gas prices are incomplete.');
  const prices: Record<string,GasPrice> = {};
  for (const row of valid) if (row.period === period && (row.duoarea === 'NUS' || /^S[A-Z]{2}$/.test(row.duoarea) || /^R(?:10|1X|1Y|1Z|20|30|40|50)$/.test(row.duoarea))) prices[row.duoarea] = { price: Number(row.value), period, area: row['area-name'] || row.duoarea };
  if (!prices.NUS) throw new Error('National gas fallback is unavailable.');
  return { prices, period };
}
