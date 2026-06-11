export type Order = {
  id: string;
  customer?: { id: string; name: string };
};

// Returns a human-readable label for an order, used in the fulfilment log.
export function describeOrder(order: Order): string {
  return `order ${order.id} placed by customer ${order.customer.id}`;
}
