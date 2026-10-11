import type { Leg, Stop, Trip } from './types';
import { nights } from './trip';

export interface GasPrice { price: number; period: string; area: string }
export interface GasPrices { prices: Record<string, GasPrice>; period: string }
// EIA Petroleum Administration for Defense Districts, including 1A/1B/1C.
export const STATE_TO_PADD: Record<string, string> = Object.fromEntries([
  ['R1X','CT ME MA NH RI VT'], ['R1Y','DE DC MD NJ NY PA'], ['R1Z','FL GA NC SC VA WV'],
  ['R20','IL IN IA KS KY MI MN MO NE ND OH OK SD TN WI'], ['R30','AL AR LA MS NM TX'],
  ['R40','CO ID MT UT WY'], ['R50','AK AZ CA HI NV OR WA']
].flatMap(([padd, states]) => states.split(' ').map(state => [state,padd])));
const STATE_ABBREVIATIONS: Record<string,string> = Object.fromEntries([
  'AL:Alabama','AK:Alaska','AZ:Arizona','AR:Arkansas','CA:California','CO:Colorado','CT:Connecticut','DE:Delaware','DC:District of Columbia','FL:Florida','GA:Georgia','HI:Hawaii','ID:Idaho','IL:Illinois','IN:Indiana','IA:Iowa','KS:Kansas','KY:Kentucky','LA:Louisiana','ME:Maine','MD:Maryland','MA:Massachusetts','MI:Michigan','MN:Minnesota','MS:Mississippi','MO:Missouri','MT:Montana','NE:Nebraska','NV:Nevada','NH:New Hampshire','NJ:New Jersey','NM:New Mexico','NY:New York','NC:North Carolina','ND:North Dakota','OH:Ohio','OK:Oklahoma','OR:Oregon','PA:Pennsylvania','RI:Rhode Island','SC:South Carolina','SD:South Dakota','TN:Tennessee','TX:Texas','UT:Utah','VT:Vermont','VA:Virginia','WA:Washington','WV:West Virginia','WI:Wisconsin','WY:Wyoming'
].map(value => { const [abbr,name] = value.split(':'); return [name,abbr]; }));
export function gasPriceFor(stateName: string, prices: GasPrices) {
  const state = STATE_ABBREVIATIONS[stateName] || stateName;
  const padd = STATE_TO_PADD[state];
  return prices.prices[`S${state}`] || prices.prices[padd] || (padd?.startsWith('R1') ? prices.prices.R10 : undefined) || prices.prices.NUS;
}
export function pricedLeg(leg: Leg, mpg: number, prices: GasPrices): Leg | null {
  let gasCost = 0;
  for (const [state, miles] of Object.entries(leg.milesByState)) {
    const quote = gasPriceFor(state,prices);
    if (!quote || !Number.isFinite(miles) || miles < 0 || !Number.isFinite(mpg) || mpg <= 0) return null;
    gasCost += miles / mpg * quote.price;
  }
  return { ...leg, gasCost };
}
export function lodgingCost(stop: Stop, defaultRate: number) { return nights(stop) * (stop.nightlyRate ?? defaultRate); }
export function budgetTotals(trip: Trip, legs: Leg[], prices: GasPrices | null) {
  const priced = prices ? legs.map(leg => pricedLeg(leg, trip.vehicleMpg, prices)).filter((leg): leg is Leg => leg !== null) : [];
  const expected = Math.max(0, trip.stops.length - 1);
  const gasComplete = expected === 0 || (!!prices && priced.length === expected);
  const gas = priced.reduce((sum, leg) => sum + leg.gasCost,0);
  const lodging = trip.stops.reduce((sum, stop) => sum + lodgingCost(stop,trip.defaultNightlyRate),0);
  const total = gas + lodging;
  return { legs: priced, gas, lodging, total, remaining: trip.budgetTotal - total, perPerson: total / trip.travelers, gasComplete };
}
export const money = (amount: number) => new Intl.NumberFormat('en-US',{ style: 'currency', currency: 'USD' }).format(amount);
