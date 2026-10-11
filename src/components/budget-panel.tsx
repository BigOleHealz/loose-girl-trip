import type { Trip } from '@/lib/types';
import { budgetTotals, money, type GasPrices } from '@/lib/budget';
export default function BudgetPanel({trip,budget,prices,error,onRetry}: {trip:Trip;budget:ReturnType<typeof budgetTotals>;prices:GasPrices|null;error:string;onRetry:()=>void}) {
  return <section className="budget-panel" aria-label="Trip budget"><h2>A little room in the budget</h2>
    <dl><div><dt>Gas {prices && <small>weekly EIA · {prices.period}</small>}</dt><dd>{budget.gasComplete ? money(budget.gas) : 'Pending'}</dd></div>
      <div><dt>Lodging</dt><dd>{money(budget.lodging)}</dd></div>
      <div className="budget-grand"><dt>{budget.gasComplete ? 'Grand total' : 'Known subtotal'}</dt><dd>{money(budget.total)}</dd></div>
      <div><dt>Per person · {trip.travelers} travelers</dt><dd>{money(budget.perPerson)}</dd></div>
      <div><dt>Your budget</dt><dd>{money(trip.budgetTotal)}</dd></div></dl>
    <p className={`budget-remaining ${budget.remaining < 0 ? 'over' : ''}`}>{money(Math.abs(budget.remaining))} {budget.remaining < 0 ? 'over budget' : 'remaining'}{!budget.gasComplete ? ' before remaining gas costs' : ''}</p>
    {!budget.gasComplete && <p className="hint">Gas needs all driving legs and current prices. The subtotal includes lodging and any calculated gas; it is not the final total.</p>}
    {error && <p className="error" role="alert">{error} <button className="text-button" onClick={onRetry}>Retry gas prices</button></p>}
    {prices && <details><summary>Gas price sources</summary><ul>{Object.entries(prices.prices).map(([area,quote]) => <li key={area}>{quote.area}: {money(quote.price)}/gal</li>)}</ul><p className="hint">State price → PADD region → US average. Unmapped mileage uses the US average. Estimates use current prices, not future prices.</p></details>}
    <p className="hint">Lodging counts nights, excluding departure day. Food, activities and bookings are outside this estimate.</p>
  </section>;
}
