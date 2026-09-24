import {z} from 'zod';
import {validatePack,type ExperiencePack} from './model';
const key=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return `ref-${(h>>>0).toString(16)}`;};
function shell(id:string,title:string,kind:'manifest'|'codewiki',locator:string):ExperiencePack{
 return validatePack({format:'diagramcloud.experience',schemaVersion:1,id,title,revision:0,rootId:'import-root',sources:[{id:'import-source',title,kind,locator,visibility:'private'}],entities:[{id:'import-root',label:title,type:'repository',children:[],workspaceIds:[],sourceIds:['import-source'],visibility:'private',assertion:'declared'}],relations:[],items:[],workspaces:[]});
}
/** Supported input is the inspected v1 manifest. Never copy arbitrary config or execute commands. */
export function importDataPass(input:unknown):ExperiencePack{
 const x=z.object({schemaVersion:z.literal(1),project:z.object({id:z.string().min(1),title:z.string().min(1).max(200)}),repositories:z.record(z.object({path:z.string(),label:z.string().optional()})).default({}),platforms:z.record(z.unknown()).default({})}).parse(input);
 const p=shell(key(`datapass:${x.project.id}`),x.project.title,'manifest','.datapass/project.json; sanitized declaration import');
 const add=(name:string,type:'repository'|'resource',title:string)=>{const id=key(`${type}:${name}`);p.entities.push({id,label:title.slice(0,200),type,summary:'Declared by imported manifest; provisioning and live state are unverified.',children:[],workspaceIds:[],sourceIds:['import-source'],visibility:'private',assertion:'declared'});p.entities[0].children.push(id);};
 Object.entries(x.repositories).forEach(([name,r])=>add(name,'repository',r.label||name));
 Object.keys(x.platforms).filter(n=>['fabric','databricks','grafana','infrastructure','oracle'].includes(n)).forEach(n=>add(n,'resource',n));
 return validatePack(p);
}
/** Adapter over actual CodeWiki module_tree.json shape. Does not invoke CodeWiki, an LLM or the repository. */
export function importCodeWiki(input:unknown):ExperiencePack{
 const p=shell('codewiki-import','CodeWiki repository modules','codewiki','Imported module_tree.json; commit metadata not supplied');
 const shared=new Map<string,string>();let count=0;
 function descend(value:unknown,parent:string,path:string,depth:number){
  if(depth>24)throw new Error('CodeWiki hierarchy exceeds depth 24');
  const record=z.record(z.unknown()).parse(value);
  for(const [name,raw] of Object.entries(record)){
   if(++count>350)throw new Error('CodeWiki import exceeds 350 modules; choose a focused export');
   const m=z.object({path:z.string().optional(),components:z.array(z.string()).max(1000),children:z.record(z.unknown()).default({})}).parse(raw),logical=`${path}/${name}`,id=key(logical);
   p.entities.push({id,label:name.replaceAll('_',' ').slice(0,200),type:'subsystem',summary:m.path||'Module hierarchy inferred by CodeWiki; review before accepting.',children:[],workspaceIds:[],sourceIds:['import-source'],visibility:'private',assertion:'inferred'});p.entities.find(e=>e.id===parent)!.children.push(id);
   for(const component of m.components){let symbol=shared.get(component);if(!symbol){symbol=key(component);shared.set(component,symbol);p.entities.push({id:symbol,label:component.split('::').pop()!.slice(0,200),type:'component',summary:component.slice(0,2000),children:[],workspaceIds:[],sourceIds:['import-source'],visibility:'private',assertion:'inferred'});}
    const e=p.entities.find(e=>e.id===id)!;if(!e.children.includes(symbol))e.children.push(symbol);
   }
   descend(m.children,id,logical,depth+1);
  }
 }
 descend(input,'import-root','',0);if(count===0)throw new Error('CodeWiki module tree is empty');return validatePack(p);
}
