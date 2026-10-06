import {Router} from 'express';
import {db} from '../db/client';
import {charge} from '../services/payments';
export const ordersRouter=Router();
ordersRouter.post('/',async(req,res)=>{await charge(10);res.json(await db.query('select 1'));});
