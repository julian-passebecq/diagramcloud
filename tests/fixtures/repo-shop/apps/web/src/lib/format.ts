import {fetchOrders} from './api';
export const formatPrice=(n:number)=>`${n} EUR`;
export const warm=()=>fetchOrders();
