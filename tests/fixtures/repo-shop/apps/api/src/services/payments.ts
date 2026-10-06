import Stripe from 'stripe';
import {cache} from '../db/client';
export const charge=async(n:number)=>{void cache;return new Stripe('sk_test_placeholder').paymentIntents.create({amount:n,currency:'eur'});};
