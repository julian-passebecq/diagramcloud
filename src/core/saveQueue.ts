export type SaveQueueState={status:'saving'|'saved'|'failed';error?:string};

/**
 * Serialize saves and report a terminal state only after the newest queued write.
 * A successful snapshot supersedes earlier edits of the SAME document, not of
 * another document. The optional key preserves the legacy single-document API.
 */
export function createLatestSaveQueue<T>(save:(value:T)=>Promise<void>,report:(state:SaveQueueState)=>void,keyOf?:(value:T)=>string){
 let tail:Promise<void>=Promise.resolve(),generation=0;
 const pending=new Map<string,{generation:number;error?:string}>();
 const state=():SaveQueueState=>{
  if(!pending.size)return {status:'saved'};
  const failed=Array.from(pending.values()).find(row=>row.error!==undefined);
  return failed?{status:'failed',error:failed.error}:{status:'saving'};
 };
 return{
  enqueue(value:T):Promise<void>{
   const key=keyOf?keyOf(value):'',mine=++generation;
   pending.set(key,{generation:mine});report({status:'saving'});
   tail=tail.then(()=>save(value),()=>save(value)).then(
    ()=>{if(pending.get(key)?.generation===mine)pending.delete(key);if(mine===generation)report(state());},
    error=>{if(pending.get(key)?.generation===mine)pending.set(key,{generation:mine,error:(error instanceof Error?error.message:String(error))||'Local save failed. Export a JSON backup.'});if(mine===generation)report(state());}
   );
   return tail;
  },
  wait():Promise<void>{return tail;},
  generation():number{return generation;},
  /** Any pending or failed document must keep the tab-close guard armed. */
  unsaved(key?:string):boolean{return key===undefined?pending.size>0:pending.has(key);},
  /** Copies of caller-supplied identities only; never private document content. */
  unsavedKeys():string[]{return Array.from(pending.keys());}
 };
}
