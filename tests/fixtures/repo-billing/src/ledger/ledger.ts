import Stripe from 'stripe';
import {Pool} from 'pg';
const pool=new Pool();
export async function recordPayment(id:string){const stripe=new Stripe('');await pool.query('select 1');return {id,stripe:!!stripe};}
