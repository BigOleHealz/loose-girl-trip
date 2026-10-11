import type { Stop } from './types';

export interface MonthStay { stop: Stop; firstDay: number; lastDay: number; nights: number }
export function monthStays(stops: Stop[], year: number, month: number): MonthStay[] {
  const first = new Date(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01T00:00:00Z`);
  const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + 1);
  const start = first.getTime(), end = next.getTime();
  return stops.flatMap(stop => {
    const arrive = Date.parse(`${stop.arriveDate}T00:00:00Z`), depart = Date.parse(`${stop.departDate}T00:00:00Z`);
    const dayVisit = arrive === depart;
    if (arrive >= end || (dayVisit ? arrive < start : depart <= start)) return [];
    const from = Math.max(start, arrive), to = Math.min(end, depart);
    return [{ stop, firstDay: new Date(from).getUTCDate(), lastDay: new Date(dayVisit ? from : to - 86400000).getUTCDate(), nights: dayVisit ? 0 : (to - from) / 86400000 }];
  }).sort((a, b) => a.firstDay - b.firstDay || a.stop.name.localeCompare(b.stop.name));
}
