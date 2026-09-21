export type SaveQueueState={status:'saving'|'saved'|'failed';error?:string};

/**
 * Serialize saves and only report terminal state for the newest queued snapshot.
 * Older writes may finish, but they can never flash a premature "saved" status
 * while a newer edit is still waiting behind them.
 */
export function createLatestSaveQueue<T>(save:(value:T)=>Promise<void>,report:(state:SaveQueueState)=>void){
 let tail:Promise<void>=Promise.resolve(),generation=0;
 return{
  enqueue(value:T):Promise<void>{
   const mine=++generation;report({status:'saving'});
   tail=tail.then(()=>save(value),()=>save(value)).then(
    ()=>{if(mine===generation)report({status:'saved'});},
    error=>{if(mine===generation)report({status:'failed',error:error instanceof Error?error.message:String(error)});}
   );
   return tail;
  },
  wait():Promise<void>{return tail;},
  generation():number{return generation;}
 };
}
