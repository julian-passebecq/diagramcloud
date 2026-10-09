/** Bounded AsyncAPI declaration analysis. No messages, credentials, endpoints or
 * payloads are read into facts, and external references are never fetched. */
import {parseDocument,isNode} from 'yaml';
import type {NativeContext} from './nativeAdapters';
type Obj=Record<string,unknown>;
const obj=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const entries=(v:unknown)=>obj(v)?Object.entries(v):[];
const literal=(v:unknown)=>typeof v==='string'&&v.length<=160&&!/[${}\r\n]/.test(v)?v:'';
export function analyzeAsyncApi(c:NativeContext):void{
 for(const f of c.files.filter(f=>/(^|\/)asyncapi\.(json|ya?ml)$/i.test(f.path))){
  let data:unknown;const doc=parseDocument(f.text,{uniqueKeys:true});
  try{if(doc.errors.length)throw Error();data=doc.toJS({maxAliasCount:0});}catch{c.diag(f.path,'Invalid or aliased AsyncAPI declaration; no event facts.');continue;}
  if(!obj(data)||!/^([23])\.\d+\.\d+$/.test(literal(data.asyncapi))){c.diag(f.path,'Unsupported AsyncAPI version; selected 2.x/3.x declarations only.');continue;}
  const v3=literal(data.asyncapi).startsWith('3.'),prefix='events:'+f.path+':',channels=new Map<string,string>();
  const line=(path:(string|number)[])=>{const n=doc.getIn(path,true);return isNode(n)&&n.range?f.text.slice(0,n.range[0]).split('\n').length:1;};
  const add=(key:string,label:string,path:(string|number)[],kind:'process'|'control'|'storage')=>c.add({key,domain:'events',label,kind,path:f.path,line:line(path),summary:'Explicit AsyncAPI '+(kind==='storage'?'channel/queue':kind==='control'?'dead-letter queue':'operation')+' declaration; delivery, subscriptions and runtime messages remain unknown.'});
  const edge=(from:string,to:string,label:string,path:(string|number)[])=>c.edge({from,to,label,path:f.path,line:line(path)});
  for(const [name,channel] of entries(data.channels).slice(0,80)){
   if(!obj(channel)||channel.$ref){c.diag(f.path,'Referenced channel not analyzed; select an inline local channel declaration.');continue;}
   const key=prefix+'channel:'+name;channels.set(name,key);add(key,name,['channels',name],'storage');
   const sqs=obj(channel.bindings)?channel.bindings.sqs:undefined;
   if(obj(sqs)){
    if(sqs.bindingVersion&&!['0.2.0','0.3.0'].includes(literal(sqs.bindingVersion))){c.diag(f.path,'Unsupported SQS binding version; dead-letter relation unknown.');continue;}
    const queue=sqs.queue,dlq=sqs.deadLetterQueue;
    if(obj(queue)&&obj(dlq)&&literal(queue.name)&&literal(dlq.name)){
     const dlqKey=key+':dlq';add(dlqKey,literal(dlq.name),['channels',name,'bindings','sqs','deadLetterQueue','name'],'control');
     const policy=obj(queue.redrivePolicy)?queue.redrivePolicy.deadLetterQueue:null;
     if(obj(policy)&&literal(policy.name)===literal(dlq.name)&&!policy.arn)edge(key,dlqKey,'declared SQS dead-letter redrive',['channels',name,'bindings','sqs','queue','redrivePolicy','deadLetterQueue','name']);
     else if(queue.redrivePolicy)c.diag(f.path,'SQS dead-letter identifier unresolved or external; no delivery relation inferred.');
    }else if(obj(queue)&&queue.redrivePolicy)c.diag(f.path,'SQS dead-letter queue not defined inline; relation unknown.');
   }
   if(!v3)for(const verb of ['publish','subscribe'])if(obj(channel[verb])){
    // AsyncAPI 2.x verbs describe the application interface: publish is received
    // by the application, subscribe is sent by the application (official binding examples).
    const op=channel[verb] as Obj,id=key+':'+verb;add(id,literal(op.operationId)||verb+' '+name,['channels',name,verb],'process');
    edge(verb==='subscribe'?id:key,verb==='subscribe'?key:id,verb==='subscribe'?'declared sends':'declared receives',['channels',name,verb]);
   }
  }
  if(v3)for(const [name,op] of entries(data.operations).slice(0,100)){
   if(!obj(op)||!['send','receive'].includes(literal(op.action)))continue;
   const ref=obj(op.channel)?literal(op.channel.$ref):'',match=/^#\/channels\/([^/]+)$/.exec(ref);
   const target=match?channels.get(match[1].replace(/~1/g,'/').replace(/~0/g,'~')):undefined;
   if(!target){c.diag(f.path,'AsyncAPI operation channel unresolved or external; no channel join inferred.');continue;}
   const key=prefix+'operation:'+name;add(key,name,['operations',name],'process');
   edge(op.action==='send'?key:target,op.action==='send'?target:key,op.action==='send'?'declared sends':'declared receives',['operations',name,'channel','$ref']);
  }
 }
}
