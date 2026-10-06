export const fetchOrders=()=>fetch('/api/orders').then(r=>r.json());
