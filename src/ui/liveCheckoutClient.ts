import {z} from 'zod';
export const LOCAL_GIT_SCHEMA='diagramcloud.local-git/1';
const identity=z.object({repositoryId:z.string().max(80),host:z.string().max(40),locator:z.string().max(500)}).strict();
export type CheckoutIdentity=z.infer<typeof identity>;
const file=z.object({path:z.string().max(16384),status:z.string().max(2)}).strict();
const capability=z.object({schema:z.literal(LOCAL_GIT_SCHEMA),available:z.boolean(),repositories:z.array(identity).max(60).default([]),reason:z.string().max(1000)}).strict();
const status=z.object({schema:z.literal(LOCAL_GIT_SCHEMA),projectId:z.string().max(80),repositoryId:z.string().max(80),host:z.string().max(40),locator:z.string().max(500),head:z.string().regex(/^[a-f0-9]{40,64}$/).nullable(),branch:z.string().max(1024).nullable(),headState:z.enum(['attached','detached','unborn']),staged:z.array(file).max(1000),unstaged:z.array(file).max(1000),untracked:z.array(file).max(1000),conflicts:z.array(file).max(1000),dirty:z.boolean(),startedAt:z.string().datetime(),capturedAt:z.string().datetime(),scope:z.string().max(1000)}).strict();
export type CheckoutStatus=z.infer<typeof status>;
const reasons:Record<string,string>={'checkout-unavailable':'Checkout is unavailable or not a readable Git working tree.','not-checkout-root':'The configured directory is not the checkout root.','binding-unavailable':'This repository binding is not permitted by the host.','git-unavailable':'Git is unavailable on this host.','time-budget-exceeded':'Inspection exceeded its time budget. Status remains unknown.','output-budget-exceeded':'Inspection exceeded its output budget. No partial status is shown.','entry-budget-exceeded':'Checkout has more changes than the bounded inspector can return. No partial status is shown.','non-utf8-git-output':'Git returned a filename that cannot be represented as UTF-8. Status remains unknown.','inspection-busy':'Two checkout inspections are already running. Try again shortly.'};
async function request(kind:'capability'|'inspect',body:unknown,signal:AbortSignal){
 const response=await fetch(`/api/local-git/${kind}`,{method:'POST',headers:{'content-type':'application/json','x-diagramcloud-local':'1'},credentials:'same-origin',body:JSON.stringify(body),signal,cache:'no-store'});
 if(response.status===404||response.status===405)throw new Error('Local checkout inspection is unavailable on this host.');
 const reader=response.body?.getReader();if(!reader)throw new Error('Host returned an empty checkout response.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>512*1024){await reader.cancel();throw new Error('Host response exceeded the checkout budget.');}chunks.push(next.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 let value;try{value=JSON.parse(text);}catch{throw new Error('Host returned an unsupported checkout response.');}
 if(!response.ok)throw new Error(reasons[value?.error]??'Host refused checkout inspection. Status remains unknown.');
 return value;
}
export async function checkoutCapability(projectId:string,repositories:CheckoutIdentity[],signal:AbortSignal){return capability.parse(await request('capability',{projectId,audience:'author',repositories},signal));}
export async function inspectCheckout(projectId:string,repository:CheckoutIdentity,signal:AbortSignal){
 const result=status.parse(await request('inspect',{projectId,audience:'author',repository},signal));
 if(result.projectId!==projectId||result.repositoryId!==repository.repositoryId||result.host!==repository.host||result.locator!==repository.locator)throw new Error('Host returned a different repository binding. Status remains unknown.');
 return result;
}
