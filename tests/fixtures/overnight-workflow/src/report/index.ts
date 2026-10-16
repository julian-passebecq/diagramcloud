// Synthetic teaching source; importing a function does not prove execution.
import {normalizeOrder} from '../normalize';
import type {Order} from '../input';
export function orderReport(input: Order) {
  return {title: 'Synthetic order report', row: normalizeOrder(input)};
}
