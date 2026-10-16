// Synthetic teaching source; DiagramCloud inspects this file but never executes it.
export type Order = {id: string; amount: number};
export function admitOrder(input: Order): Order {
  return {id: input.id, amount: input.amount};
}
