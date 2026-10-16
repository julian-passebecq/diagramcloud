// Synthetic teaching source; no measured result or runtime claim.
import {admitOrder, type Order} from '../input';
export function normalizeOrder(input: Order) {
  const order = admitOrder(input);
  return {id: order.id, displayAmount: order.amount.toFixed(2)};
}
