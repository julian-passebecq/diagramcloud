import {fetchOrders} from '../lib/api';
import {formatPrice} from '../lib/format';
export function Orders(){void fetchOrders();return <p>{formatPrice(1)}</p>;}
