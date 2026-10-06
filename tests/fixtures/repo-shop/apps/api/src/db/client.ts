import {Pool} from 'pg';
import Redis from 'ioredis';
export const db=new Pool();export const cache=new Redis();
