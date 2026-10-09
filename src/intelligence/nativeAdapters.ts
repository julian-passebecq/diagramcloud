/** Selected-file native parsers. References are resolved only inside the supplied
 * selection. This is declaration analysis, never deployment, execution or observation. */
import {parseAllDocuments,parseDocument,isMap,isNode} from 'yaml';
import type {ScanFile} from '../core/scan/scanner';
import type {DomainFact,DomainLink} from './domainAdapters';

type Obj=Record<string,unknown>;
export type NativeContext={files:ScanFile[];facts:Map<string,DomainFact>;add:(f:DomainFact)=>void;edge:(e:DomainLink)=>void;diag:(p:string,m:string)=>void;parsed:(f:ScanFile,json:boolean)=>unknown};
const obj=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const entries=(v:unknown):[string,unknown][]=>obj(v)?Object.entries(v):[];
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const str=(v:unknown)=>typeof v==='string'?v:'';
const base=(p:string)=>p.split('/').at(-1)||p;
const dir=(p:string)=>p.split('/').slice(0,-1).join('/');
const at=(text:string,index:number)=>text.slice(0,Math.max(0,index)).split('\n').length;
const line=(text:string,value:string)=>at(text,text.indexOf(value));
function localPath(file:string,reference:string):string|null{
 if(!reference||/^(?:[/\\]|[a-z][a-z\d+.-]*:)/i.test(reference)||reference.includes('\0'))return null;
 const parts=dir(file).split('/').filter(Boolean);
 for(const p of reference.replace(/\\/g,'/').split('/')){if(!p||p==='.')continue;if(p==='..'){if(!parts.length)return null;parts.pop();}else parts.push(p);}
 return parts.join('/');
}
function strings(value:unknown,depth=0):string[]{
 if(depth>16)return [];if(typeof value==='string')return [value];
 return Array.isArray(value)?value.flatMap(x=>strings(x,depth+1)):obj(value)?Object.values(value).flatMap(x=>strings(x,depth+1)):[];
}
function stringEntries(value:unknown,path:(string|number)[]=[],depth=0):{text:string;path:(string|number)[]}[]{
 if(depth>16)return [];if(typeof value==='string')return [{text:value,path}];
 return Array.isArray(value)?value.flatMap((v,i)=>stringEntries(v,[...path,i],depth+1)):obj(value)?Object.entries(value).flatMap(([k,v])=>stringEntries(v,[...path,k],depth+1)):[];
}
/** Lexical exclusions are used only to keep declarations in comments or quoted
 * examples from becoming facts. Offsets stay in the original selected file. */
function codeMatches(text:string,re:RegExp,language:'csharp'|'bicep'='csharp'):RegExpMatchArray[]{
 const token=language==='csharp'?/\$*("{3,})[\s\S]*?\1|@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g:/'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g;
 const excluded=[...text.matchAll(token)].map(m=>[m.index!,m.index!+m[0].length]);
 return [...text.matchAll(re)].filter(m=>!excluded.some(([start,end])=>m.index!>=start&&m.index!<end));
}
function safeGlob(file:string,pattern:string):RegExp|null{
 // Databricks include patterns are relative to their declaring config file. Never expand the
 // filesystem; the regex filters already-authorized selected paths only.
 if(!pattern||pattern.length>240||pattern.includes('..')||/[\\\[\]{}!]/.test(pattern)||/^(?:\/|[a-z]+:)/i.test(pattern))return null;
 const relative=pattern.split('/').filter(part=>part!=='.').join('/');
 const path=[dir(file),relative].filter(Boolean).join('/');let re='^';
 for(let i=0;i<path.length;i++){const c=path[i];if(c==='*'){if(path[i+1]==='*'){i++;if(path[i+1]==='/'){i++;re+='(?:.*/)?';}else re+='.*';}else re+='[^/]*';}else if(c==='?')re+='[^/]';else re+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
 return new RegExp(re+'$');
}

export function analyzeDatabricks(c:NativeContext):void{
 const candidates=c.files.filter(f=>/\.(?:ya?ml|json)$/i.test(f.path)),claimed=new Set<string>();
 const cache=new Map<string,unknown>();const parse=(f:ScanFile)=>{if(!cache.has(f.path))cache.set(f.path,c.parsed(f,/\.json$/i.test(f.path)));return cache.get(f.path);};
 const locations=new Map<string,ReturnType<typeof parseDocument>>();
 const location=(f:ScanFile,path:(string|number)[],fallback:string)=>{try{if(!locations.has(f.path))locations.set(f.path,parseDocument(f.text));const doc=locations.get(f.path)!,parent=doc.getIn(path.slice(0,-1),true);if(isMap(parent)){const pair=parent.items.find(p=>isNode(p.key)&&String(p.key.toJSON())===String(path.at(-1)));if(isNode(pair?.key)&&pair.key.range)return at(f.text,pair.key.range[0]);}const node=doc.getIn(path,true);return isNode(node)&&node.range?at(f.text,node.range[0]):line(f.text,fallback);}catch{return line(f.text,fallback);}};
 const roots=candidates.filter(f=>/^databricks\.(?:ya?ml|json)$/i.test(base(f.path))).sort((a,b)=>a.path.localeCompare(b.path));
 const analyze=(root:ScanFile,selected:ScanFile[],standalone=false)=>{
  const data=parse(root);if(!obj(data))return;const scope=root.path,bundle='databricks:bundle:'+scope;
  c.add({key:bundle,domain:'databricks',kind:'control',label:standalone?base(root.path):str(obj(data.bundle)&&data.bundle.name)||dir(root.path)||'Databricks bundle',path:root.path,line:1,summary:standalone?'Selected standalone Databricks resource declaration; bundle scope unknown.':'Selected Databricks bundle configuration; target settings remain declarations, not deployed instances.'});
  type Resource={key:string;native:string;type:'jobs'|'pipelines';target:string;raw:Obj;file:ScanFile;sourcePath:(string|number)[]};
  const resources:Resource[]=[],targets=new Map<string,ScanFile>();
  const key=(target:string,type:string,name:string)=>'databricks:'+scope+':'+(target||'base')+':'+type+':'+name;
  const collect=(file:ScanFile,raw:unknown,target='',path:(string|number)[]=['resources'])=>{
   for(const type of ['jobs','pipelines'] as const)for(const [name,value] of entries(obj(raw)?raw[type]:null)){
    if(!obj(value))continue;const id=key(target,type,name);
    const existing=resources.find(r=>r.key===id);if(existing){c.diag(file.path,'Conflicting '+type+' declaration '+name+' in selected include; no merge guessed.');continue;}
    resources.push({key:id,native:name,type,target,raw:value,file,sourcePath:[...path,type,name]});
    const sourceLine=location(file,[...path,type,name],name);
    c.add({key:id,domain:'databricks',kind:'process',label:(target?target+' / ':'')+(str(value.name)||name),path:file.path,line:sourceLine,summary:'Declared Databricks '+(type==='jobs'?'job':'pipeline')+(target?' target override for '+target:'')+'; deployment and execution unknown.'});
    c.edge({from:target?'databricks:target:'+scope+':'+target:bundle,to:id,label:target?'target resource override':'bundle resource',path:file.path,line:sourceLine});
    if(type==='jobs')for(const [index,task] of arr(value.tasks).entries())if(obj(task)&&str(task.task_key)){
     c.add({key:id+':task:'+str(task.task_key),domain:'databricks',kind:'process',label:str(task.task_key),path:file.path,line:location(file,[...path,type,name,'tasks',index,'task_key'],str(task.task_key)),summary:'Declared job task; no runtime attestation.'});
    }
   }
  };
  for(const f of selected){claimed.add(f.path);const data=parse(f);if(!obj(data))continue;
   if(/\.job\.json$/i.test(f.path)){collect(f,{jobs:{[str(data.name)||base(f.path)]:data}});continue;}
   collect(f,data.resources);
   for(const [name,raw] of entries(data.targets)){
    if(!obj(raw))continue;if(!targets.has(name)){const targetLine=location(f,['targets',name],name+':');targets.set(name,f);c.add({key:'databricks:target:'+scope+':'+name,domain:'databricks',kind:'control',label:name,path:f.path,line:targetLine,summary:'Declared bundle target'+(str(raw.mode)?' mode '+str(raw.mode):'')+'; no environment deployment inferred.'});c.edge({from:bundle,to:'databricks:target:'+scope+':'+name,label:'declares target',path:f.path,line:targetLine});}
    collect(f,raw.resources,name,['targets',name,'resources']);
   }
  }
  for(const r of resources){
   const {file,raw}=r;
   if(r.target){const original=key('',r.type,r.native);if(c.facts.has(original))c.edge({from:original,to:r.key,label:'declared target override; not effective merge',path:file.path,line:c.facts.get(r.key)?.line??1});}
   const declarations=stringEntries(raw,r.sourcePath),references=declarations.flatMap(s=>[...s.text.matchAll(/\$\{resources\.(jobs|pipelines)\.([\w-]+)\.id\}/g)].map(m=>({type:m[1],name:m[2],text:m[0],path:s.path})));
   for(const ref of references){const target=c.facts.has(key(r.target,ref.type,ref.name))?key(r.target,ref.type,ref.name):key('',ref.type,ref.name);
    if(c.facts.has(target))c.edge({from:target,to:r.key,label:'explicit bundle resource reference',path:file.path,line:location(file,ref.path,ref.text)});else c.diag(file.path,'Unresolved bundle resource reference '+ref.text);}
   for(const [taskIndex,task] of arr(raw.tasks).entries()){if(!obj(task)||!str(task.task_key))continue;const taskId=r.key+':task:'+str(task.task_key);
    c.edge({from:r.key,to:taskId,label:'contains declared task',path:file.path,line:c.facts.get(taskId)?.line??location(file,[...r.sourcePath,'tasks',taskIndex,'task_key'],str(task.task_key))});
    for(const [dependencyIndex,dependency] of arr(task.depends_on).entries()){const name=obj(dependency)?str(dependency.task_key):'';if(!name)continue;const from=r.key+':task:'+name;
     if(c.facts.has(from))c.edge({from,to:taskId,label:'declared depends_on',path:file.path,line:location(file,[...r.sourcePath,'tasks',taskIndex,'depends_on',dependencyIndex,'task_key'],name)});else c.diag(file.path,'Unresolved Databricks task dependency '+name);}
   }
   // Notebook/library references are precise selected paths, never fetched.
   for(const declaration of declarations){const value=declaration.text;if(/\.(?:py|ipynb|sql)$/i.test(value)&&!value.includes('${')){
    const path=localPath(file.path,value),source=c.files.find(f=>f.path===path);
    if(source){const artifact='databricks:source:'+scope+':'+source.path;c.add({key:artifact,domain:'databricks',kind:'source',label:base(source.path),path:source.path,line:1,summary:'Explicit selected notebook/library path; code never executed.'});c.edge({from:artifact,to:r.key,label:'declared notebook/library path',path:file.path,line:location(file,declaration.path,value)});}
    else c.diag(file.path,'Notebook/library not selected: '+value.slice(0,100));
   }}
  }
 };
 for(const root of roots){const selected:ScanFile[]=[root],visited=new Set([root.path]);
  for(let cursor=0;cursor<selected.length&&cursor<100;cursor++){const f=selected[cursor],data=parse(f);if(!obj(data))continue;
   for(const pattern of arr(data.include).map(str).filter(Boolean)){
    const re=safeGlob(f.path,pattern);if(!re){c.diag(f.path,'Unsafe or unsupported include pattern refused: '+pattern.slice(0,100));continue;}
    const matches=candidates.filter(x=>re.test(x.path));if(!matches.length)c.diag(f.path,'Include has no selected match: '+pattern);
    for(const match of matches){if(visited.has(match.path)){if(match.path===root.path)c.diag(f.path,'Include cycle to bundle root ignored.');continue;}if(selected.length>=100){c.diag(f.path,'Include budget of 100 selected configuration files reached.');break;}visited.add(match.path);selected.push(match);}
   }
  }analyze(root,selected);
 }
 for(const f of candidates)if(!claimed.has(f.path)&&(/\.job\.json$/i.test(f.path)||/(?:^|\/)resources\/.+\.ya?ml$/i.test(f.path))){const data=parse(f);if(obj(data)&&(/\.job\.json$/i.test(f.path)||obj(data.resources)))analyze(f,[f],true);}
}

type TmdlItem={type:'table'|'column'|'measure'|'relationship';name:string;line:number;indent:number;table?:string;body:string};
const tmdlName="(?:'(?:''|[^'])*'|[^\\s=]+)";
const unquote=(s:string)=>s.startsWith("'")&&s.endsWith("'")?s.slice(1,-1).replace(/''/g,"'"):s;
function tmdlItems(text:string):TmdlItem[]{
 const lines=text.split(/\r?\n/),items:TmdlItem[]=[];let table:string|undefined;
 const re=new RegExp('^(\\s*)(table|column|measure|relationship)\\s+('+tmdlName+')','i');
 for(let i=0;i<lines.length;i++){const match=re.exec(lines[i]);if(!match)continue;const type=match[2].toLowerCase() as TmdlItem['type'],name=unquote(match[3]);
  if(type==='table')table=name;if(type==='relationship')table=undefined;
  const indent=match[1].replace(/\t/g,'    ').length;let end=i+1;
  while(end<lines.length){const next=lines[end];if(next.trim()&&next.match(/^\s*/)?.[0].replace(/\t/g,'    ').length!<=indent)break;end++;}
  items.push({type,name,line:i+1,indent,table:type==='column'||type==='measure'?table:undefined,body:lines.slice(i,end).join('\n')});
 }return items;
}
export function analyzeFabric(c:NativeContext):void{
 const models=new Map<string,string>(),decls=new Map<string,TmdlItem[]>();
 const modelRoot=(path:string)=>{const parts=path.split('/'),i=parts.findIndex(p=>/\.SemanticModel$/i.test(p));return i>=0?parts.slice(0,i+1).join('/'):null;};
 for(const f of c.files){const name=base(f.path).toLowerCase(),root=modelRoot(f.path);
  if(root&&(name==='definition.pbism'||name.endsWith('.tmdl'))&&!models.has(root)){const key='fabric:model:'+root;models.set(root,key);c.add({key,domain:'fabric',kind:'model',label:base(root),path:f.path,line:1,summary:'Selected semantic model artifact directory; no evaluated measures.'});}
  if(name==='.platform'){const data=c.parsed(f,true);if(!obj(data)||!obj(data.metadata)||!str(data.metadata.type))continue;
   c.add({key:'fabric:item:'+dir(f.path),domain:'fabric',kind:'app',label:str(data.metadata.displayName)||base(dir(f.path)),path:f.path,line:line(f.text,'metadata'),summary:'Fabric .platform item type '+str(data.metadata.type)+(obj(data.config)&&str(data.config.logicalId)?'; logicalId '+str(data.config.logicalId):'')+'. Selected static item metadata only.'});}
  if(!name.endsWith('.tmdl'))continue;const items=tmdlItems(f.text);decls.set(f.path,items);
  for(const item of items){const identity=(item.table?item.table+'/':'')+item.name,key='fabric:tmdl:'+f.path+':'+item.type+':'+identity;
   c.add({key,domain:'fabric',kind:item.type==='table'||item.type==='column'?'table':item.type==='measure'?'model':'process',label:item.table?item.table+'.'+item.name:item.name,path:f.path,line:item.line,summary:'TMDL '+item.type+' declaration; expression and semantic model never evaluated.'});}
 }
 const tables=[...c.facts.values()].filter(f=>f.domain==='fabric'&&f.key.includes(':table:'));
 for(const [path,items] of decls){const f=c.files.find(f=>f.path===path)!,root=modelRoot(path),model=root?models.get(root):null;
  const itemKey=(item:TmdlItem)=>'fabric:tmdl:'+path+':'+item.type+':'+(item.table?item.table+'/':'')+item.name;
  for(const item of items){const key=itemKey(item);if(model)c.edge({from:model,to:key,label:'contains TMDL declaration',path,line:item.line});
   if(item.table){const owner=items.find(i=>i.type==='table'&&i.name===item.table);if(owner)c.edge({from:itemKey(owner),to:key,label:'declares '+item.type,path,line:item.line});}
   if(item.type!=='relationship')continue;
   const prop=new RegExp('^\\s*(fromColumn|toColumn):\\s*('+tmdlName+')\\.('+tmdlName+')\\s*$','gm');
   for(const match of item.body.matchAll(prop)){const table=unquote(match[2]),column=unquote(match[3]),candidates=tables.filter(t=>t.label===table&&root&&modelRoot(t.path)===root);
    if(candidates.length!==1){c.diag(path,'Unresolved or ambiguous TMDL '+match[1]+' table '+table);continue;}
    const cols=[...c.facts.values()].filter(t=>t.path===candidates[0].path&&t.key.endsWith(':column:'+table+'/'+column));
    if(cols.length!==1){c.diag(path,'TMDL column not selected: '+table+'.'+column);continue;}
    c.edge({from:cols[0].key,to:key,label:'TMDL '+match[1],path,line:item.line+at(item.body,match.index!)-1});
   }
  }
 }
 // PBIR's exact relative model reference is shared with the base adapter.
 for(const [root,key] of models){const item='fabric:item:'+root;if(c.facts.has(item))c.edge({from:item,to:key,label:'selected semantic model item',path:root+'/.platform',line:1});}
}

/** Mask comments without moving line numbers; strings are retained for literal route
 * extraction. This intentionally does not claim a compiler's resolved call graph. */
function csharpText(text:string):string{return text.replace(/\$*("{3,})[\s\S]*?\1|@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,m=>m.startsWith('//')||m.startsWith('/*')?m.replace(/[^\r\n]/g,' '):m);}
function csharpBodyEnd(text:string,index:number):number{
 const masked=text.replace(/\$*("{3,})[\s\S]*?\1|@"(?:""|[^"])*"|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,m=>m.replace(/[^\r\n]/g,' ')),start=masked.indexOf('{',index);if(start<0)return index;
 let depth=1;for(let at=start+1;at<masked.length;at++){if(masked[at]==='{')depth++;if(masked[at]==='}'&&!--depth)return at;}return masked.length;
}
export function analyzeDotnetSource(c:NativeContext):void{
 for(const f of c.files){if(!/\.cs$/i.test(f.path))continue;const text=csharpText(f.text),prefix='dotnet:source:'+f.path;
  const controllers=codeMatches(text,/(?:\[ApiController\]\s*)?(?:(?:public|internal|partial|abstract|sealed)\s+)*class\s+(\w+)\s*:\s*([^\r\n{]+)/g).filter(m=>/\bController(?:Base)?\b/.test(m[2]));
  const classEnd=new Map(controllers.map(ct=>[ct.index!,csharpBodyEnd(text,ct.index!+ct[0].length)]));
  for(const controller of controllers)c.add({key:prefix+':controller:'+controller[1],domain:'dotnet',kind:'app',label:controller[1],path:f.path,line:at(text,controller.index!),summary:'Syntactically declared ASP.NET controller; route registration and execution unknown.'});
  const fileRoutes=codeMatches(text,/\[Route\(\s*"([^"\r\n]+)"\s*\)\]/g);
  for(const m of codeMatches(text,/\[Http(Get|Post|Put|Patch|Delete|Head|Options)(?:\(\s*"([^"\r\n]*)"\s*\))?\]/g)){
   const owner=controllers.filter(ct=>ct.index!<m.index!&&m.index!<classEnd.get(ct.index!)!).at(-1);if(!owner){c.diag(f.path,'HTTP attribute has no selected controller declaration; omitted.');continue;}
   const previousEnd=Math.max(-1,...controllers.filter(ct=>ct.index!<owner.index!).map(ct=>classEnd.get(ct.index!)!));
   const controllerRoute=fileRoutes.filter(route=>route.index!>previousEnd&&route.index!<owner.index!).at(-1)?.[1];
   const route=controllerRoute?.replace(/\[controller\]/gi,owner[1].replace(/Controller$/,''));
   const literal=m[2]||'',composed=literal.startsWith('/')||literal.startsWith('~/')?literal.replace(/^~/,''):[route,literal].filter(Boolean).join('/');
   if(!composed||composed.includes('[')){c.diag(f.path,'Unresolved ASP.NET attribute route token; no concrete route guessed.');continue;}
   const key=prefix+':route:'+m.index;c.add({key,domain:'dotnet',kind:'function',label:m[1].toUpperCase()+' '+composed,path:f.path,line:at(text,m.index!),summary:'Literal ASP.NET route syntax; no hosting or callable implementation inferred.'});c.edge({from:prefix+':controller:'+owner[1],to:key,label:'declares HTTP attribute',path:f.path,line:at(text,m.index!)});
  }
  for(const m of codeMatches(text,/\b([\w.]+)\.Map(Get|Post|Put|Patch|Delete|Methods)\(\s*"([^"\r\n]+)"/g)){
   const key=prefix+':minimal:'+m.index;c.add({key,domain:'dotnet',kind:'function',label:m[2].toUpperCase()+' '+m[3],path:f.path,line:at(text,m.index!),summary:'Literal minimal API mapping syntax; MapGroup prefixes, extension methods and runtime registration unknown.'});
  }
  const contexts=codeMatches(text,/\bclass\s+(\w+)\s*:\s*DbContext\b/g);
  const contextEnd=new Map(contexts.map(ct=>[ct.index!,csharpBodyEnd(text,ct.index!+ct[0].length)]));
  for(const m of contexts)c.add({key:prefix+':context:'+m[1],domain:'dotnet',kind:'storage',label:m[1],path:f.path,line:at(text,m.index!),summary:'Declared EF DbContext inheritance; migrations, database connection and execution unknown.'});
  for(const m of codeMatches(text,/\bDbSet\s*<\s*([\w.]+)\s*>\s+(\w+)/g)){
   const owner=contexts.filter(ct=>ct.index!<m.index!&&m.index!<contextEnd.get(ct.index!)!).at(-1),entity='dotnet:entity:'+f.path+':'+m[1];
   c.add({key:entity,domain:'dotnet',kind:'table',label:m[1],path:f.path,line:at(text,m.index!),summary:'Declared DbSet entity type '+m[1]+'; physical table name and schema unknown.'});
   if(owner)c.edge({from:prefix+':context:'+owner[1],to:entity,label:'declares DbSet '+m[2],path:f.path,line:at(text,m.index!)});
  }
  for(const m of codeMatches(text,/\bEntity\s*<\s*(\w+)\s*>\s*\(\s*\)\s*\.\s*Has(One|Many)\s*<\s*(\w+)\s*>/g)){
   const from='dotnet:entity:'+f.path+':'+m[1],to='dotnet:entity:'+f.path+':'+m[3];
   if(c.facts.has(from)&&c.facts.has(to))c.edge({from,to,label:'EF literal Has'+m[2]+' declaration',path:f.path,line:at(text,m.index!)});else c.diag(f.path,'EF relationship entity types not declared in selected context file.');
  }
 }
}

type Block={name:string;type:string;api:string;body:string;index:number;bodyIndex:number;existing:boolean};
function bicepBlocks(text:string):Block[]{
 const out:Block[]=[];const pattern=/\bresource\s+(\w+)\s+'([^'@]+)@([^']+)'\s*(existing\s*)?=\s*\{/g;
 // Brace matching skips comments and strings; interpolation is retained as source.
 for(const m of codeMatches(text,pattern,'bicep')){let i=m.index!+m[0].length,depth=1;const start=i;
  for(;i<text.length&&depth;i++){if(text[i]==="'"){i++;for(;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]==="'")break;}continue;}
   if(text.slice(i,i+2)==='//'){i=text.indexOf('\n',i);if(i<0)break;continue;}if(text.slice(i,i+2)==='/*'){const end=text.indexOf('*/',i+2);if(end<0)break;i=end+1;continue;}if(text[i]==='{')depth++;if(text[i]==='}')depth--;}
  if(!depth)out.push({name:m[1],type:m[2],api:m[3],body:text.slice(start,i-1),index:m.index!,bodyIndex:start,existing:!!m[4]});
 }return out;
}
export function analyzeAzure(c:NativeContext):void{
 const locations=new Map<string,ReturnType<typeof parseDocument>>();
 const sourceLine=(f:ScanFile,path:(string|number)[],fallback:string)=>{try{if(!locations.has(f.path))locations.set(f.path,parseDocument(f.text));const doc=locations.get(f.path)!,parent=doc.getIn(path.slice(0,-1),true);if(isMap(parent)){const pair=parent.items.find(p=>isNode(p.key)&&String(p.key.toJSON())===String(path.at(-1)));if(isNode(pair?.key)&&pair.key.range)return at(f.text,pair.key.range[0]);}const node=doc.getIn(path,true);return isNode(node)&&node.range?at(f.text,node.range[0]):line(f.text,fallback);}catch{return line(f.text,fallback);}};
 for(const f of c.files){const name=base(f.path).toLowerCase();
  if(/^containerapp\.(?:json|ya?ml)$/.test(name)){
   const data=c.parsed(f,name.endsWith('.json')),properties=obj(data)&&obj(data.properties)?data.properties:null,template=properties&&obj(properties.template)?properties.template:null;
   if(obj(data)&&template&&Array.isArray(template.containers)){
    const id='azure:containerapp-config:'+f.path;c.add({key:id,domain:'azure',kind:'app',label:str(data.name)||base(dir(f.path))||'Container Apps config',path:f.path,line:str(data.name)?sourceLine(f,['name'],str(data.name)):1,summary:'Selected Container Apps configuration/template declaration. Provisioning state, live revisions and traffic UNKNOWN; environment values never copied.'});
    for(const field of ['containers','initContainers'])for(const [index,container] of arr(template[field]).entries())if(obj(container)&&str(container.name)){
     const key=id+':'+field+':'+index,source=sourceLine(f,['properties','template',field,index,'name'],str(container.name));
     c.add({key,domain:'azure',kind:'process',label:str(container.name),path:f.path,line:source,summary:field==='initContainers'?'Container Apps init container declaration; commands are not copied or executed.':'Container Apps container declaration; image availability, environment values and runtime execution unknown.'});c.edge({from:id,to:key,label:'Container Apps declared '+field,path:f.path,line:source});
    }
   }else c.diag(f.path,'Unsupported Container Apps config shape; requires properties.template.containers. No resource guessed from filename.');
  }
  if(name.endsWith('.bicep')){const blocks=bicepBlocks(f.text),key=(symbol:string)=>'azure:resource:'+f.path+':'+symbol;
   for(const block of blocks)c.add({key:key(block.name),domain:'azure',kind:/Storage|Sql|DocumentDB/i.test(block.type)?'storage':'app',label:block.name,path:f.path,line:at(f.text,block.index),summary:'Declared Bicep '+block.type+' API '+block.api+(block.existing?'; existing-resource reference':'')+'. Deployment and health UNKNOWN.'});
   for(const block of blocks){for(const m of codeMatches(block.body,/\b(parent|scope):\s*(\w+)\b/g,'bicep'))if(blocks.some(b=>b.name===m[2]))c.edge({from:key(m[2]),to:key(block.name),label:'Bicep explicit '+m[1],path:f.path,line:at(f.text,block.bodyIndex+m.index!)});
    for(const m of codeMatches(block.body,/\bdependsOn:\s*\[([^\]]*)\]/g,'bicep'))for(const dependency of codeMatches(m[1],/\b(\w+)\b/g,'bicep')){if(blocks.some(b=>b.name===dependency[1]))c.edge({from:key(dependency[1]),to:key(block.name),label:'Bicep explicit dependsOn',path:f.path,line:at(f.text,block.bodyIndex+m.index!+m[0].indexOf('[')+1+dependency.index!)});}
    for(const m of codeMatches(block.body,/\b(\w+)\.(?:id|name|properties)\b/g,'bicep'))if(blocks.some(b=>b.name===m[1])&&m[1]!==block.name)c.edge({from:key(m[1]),to:key(block.name),label:'Bicep symbolic resource reference',path:f.path,line:at(f.text,block.bodyIndex+m.index!)});
   }
   for(const m of codeMatches(f.text,/\bmodule\s+(\w+)\s+'([^']+)'\s*=/g,'bicep')){
    const target=localPath(f.path,m[2]),selected=c.files.find(x=>x.path===target);if(!selected){c.diag(f.path,'Bicep module not selected; external/registry modules never fetched: '+m[2].slice(0,100));continue;}
    const id='azure:module:'+f.path+':'+m[1];c.add({key:id,domain:'azure',kind:'control',label:m[1],path:f.path,line:at(f.text,m.index!),summary:'Selected local Bicep module path '+target+'; parameter evaluation and deployment unknown.'});
    // Module target facts may appear later: materialize only exact resource declarations.
    for(const block of bicepBlocks(selected.text)){const resource='azure:resource:'+selected.path+':'+block.name;c.add({key:resource,domain:'azure',kind:'app',label:block.name,path:selected.path,line:at(selected.text,block.index),summary:'Declared Bicep '+block.type+' API '+block.api+'. Deployment and health UNKNOWN.'});c.edge({from:id,to:resource,label:'declares selected module resource',path:f.path,line:at(f.text,m.index!)});}
   }
  }
  if(name.endsWith('.json')){const data=c.parsed(f,true);if(obj(data)&&/deploymentTemplate\.json(?:#)?$/i.test(str(data.$schema))){
   type Resource={id:string;raw:Obj;parent?:string;path:(string|number)[]};const resources:Resource[]=[];
   const walk=(value:unknown,parent?:string,depth=0,path:(string|number)[]=['resources'])=>{if(depth>12){c.diag(f.path,'ARM nested resource depth exceeded 12.');return;}
    for(const [index,raw] of arr(value).entries()){if(!obj(raw)||!str(raw.type)||!str(raw.name))continue;const id=(parent?parent+'>':'azure:arm:'+f.path+':')+str(raw.type)+'/'+str(raw.name),resourcePath=[...path,index];resources.push({id,raw,parent,path:resourcePath});
     c.add({key:id,domain:'azure',kind:/Microsoft\.Web|Microsoft\.App/i.test(str(raw.type))?'app':'control',label:str(raw.name),path:f.path,line:sourceLine(f,[...resourcePath,'name'],str(raw.name)),summary:'ARM '+str(raw.type)+' API '+str(raw.apiVersion)+' declaration; expressions and deployment are not evaluated.'});walk(raw.resources,id,depth+1,[...resourcePath,'resources']);}
   };walk(data.resources);
   for(const r of resources){if(r.parent)c.edge({from:r.parent,to:r.id,label:'ARM nested resource',path:f.path,line:sourceLine(f,[...r.path,'name'],str(r.raw.name))});
    for(const [index,dep] of arr(r.raw.dependsOn).map(str).entries()){const match=/^\[resourceId\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)\]$/.exec(dep),direct=resources.filter(x=>str(x.raw.name)===dep||str(x.raw.type)+'/'+str(x.raw.name)===dep),resolved=match?resources.filter(x=>str(x.raw.type)===match[1]&&str(x.raw.name)===match[2]):direct;
     if(resolved.length===1)c.edge({from:resolved[0].id,to:r.id,label:'ARM exact dependsOn',path:f.path,line:sourceLine(f,[...r.path,'dependsOn',index],dep)});else c.diag(f.path,'ARM dependsOn expression unresolved or ambiguous; not evaluated.');}
   }
  }
  if(name==='function.json'&&obj(data)&&Array.isArray(data.bindings)){
   const id='azure:function:'+dir(f.path);c.add({key:id,domain:'azure',kind:'function',label:base(dir(f.path)),path:f.path,line:1,summary:'Azure Functions binding configuration; host/runtime unknown.'});
   for(const [index,binding] of data.bindings.entries()){if(!obj(binding)||!str(binding.type))continue;const key=id+':binding:'+index,bindingLine=sourceLine(f,['bindings',index,'type'],str(binding.type));c.add({key,domain:'azure',kind:'source',label:str(binding.name)||str(binding.type),path:f.path,line:bindingLine,summary:'Declared '+str(binding.direction)+' '+str(binding.type)+' binding; connection values are never interpreted.'});c.edge({from:str(binding.direction)==='out'?id:key,to:str(binding.direction)==='out'?key:id,label:'Functions declared '+str(binding.direction)+' binding',path:f.path,line:bindingLine});}
  }}
  if(name==='azure.yaml'||name==='azure.yml'){const data=c.parsed(f,false);if(!obj(data)||!obj(data.services))continue;
   for(const [service,raw] of entries(data.services)){if(!obj(raw))continue;const key='azure:azd:'+f.path+':'+service;c.add({key,domain:'azure',kind:'app',label:service,path:f.path,line:sourceLine(f,['services',service],service+':'),summary:'azd service declaration; host '+(str(raw.host)||'unspecified')+'. No provisioning or deployed instance inferred.'});
    const folder=str(raw.project),path=folder?localPath(f.path,folder):null,projects=path!==null?c.files.filter(x=>(path?x.path.startsWith(path+'/'):dir(x.path)==='')&&/\.csproj$/i.test(x.path)):[];
    if(projects.length===1)c.edge({from:'dotnet:project:'+projects[0].path,to:key,label:'azd explicit selected service project',path:f.path,line:sourceLine(f,['services',service,'project'],folder)});else if(folder)c.diag(f.path,'azd project path has no unique selected .NET project; no join guessed.');
   }
  }
 }
}

export function analyzeKubernetesPackaging(c:NativeContext):void{
 const selected=new Map(c.files.map(f=>[f.path,f]));
 const yaml=(f:ScanFile)=>{try{return parseAllDocuments(f.text).map(doc=>({doc,data:doc.toJS({maxAliasCount:40}) as unknown}));}catch{c.diag(f.path,'Invalid selected Kubernetes packaging YAML.');return [];}};
 const manifest=(f:ScanFile)=>{const ids:string[]=[];
  for(const {data,doc} of yaml(f)){if(!obj(data)||!str(data.apiVersion)||!str(data.kind)||!obj(data.metadata)||!str(data.metadata.name)||str(data.kind)==='Secret')continue;
   const nameNode=doc.getIn(['metadata','name'],true),sourceLine=isNode(nameNode)&&nameNode.range?at(f.text,nameNode.range[0]):line(f.text,str(data.metadata.name));
   const id='kubernetes:resource:'+f.path+':'+str(data.kind)+':'+str(data.metadata.namespace)+':'+str(data.metadata.name);ids.push(id);c.add({key:id,domain:'kubernetes',kind:/Service|Ingress/.test(str(data.kind))?'app':'control',label:str(data.kind)+' '+str(data.metadata.name),path:f.path,line:sourceLine,summary:'Selected '+str(data.apiVersion)+' Kubernetes declaration; templating, cluster state and rollout UNKNOWN.'});
  }return ids;
 };
 const packages=c.files.filter(f=>/^(?:Chart\.ya?ml|kustomization\.ya?ml|Kustomization)$/i.test(base(f.path)));
 for(const f of packages){const raw=c.parsed(f,false);if(!obj(raw))continue;const helm=/^Chart\./i.test(base(f.path)),id='kubernetes:'+(helm?'chart:':'overlay:')+f.path;
  if(helm&&!/^(?:v1|v2)$/.test(str(raw.apiVersion))){c.diag(f.path,'Unsupported Helm Chart API version.');continue;}
  c.add({key:id,domain:'kubernetes',kind:'control',label:helm?str(raw.name)||base(dir(f.path)):base(dir(f.path))||'Kustomize overlay',path:f.path,line:1,summary:helm?'Helm chart declaration; templates never rendered and no dependency downloaded.':'Kustomize package/overlay declaration; transformers and cluster state not evaluated.'});
  if(helm){for(const dep of arr(raw.dependencies)){if(!obj(dep)||!str(dep.name))continue;const repository=str(dep.repository);
    if(repository.startsWith('file://')){const path=localPath(f.path,repository.slice(7)),target=path?c.files.find(x=>dir(x.path)===path&&/^Chart\.ya?ml$/i.test(base(x.path))):null;
     if(target)c.edge({from:'kubernetes:chart:'+target.path,to:id,label:'Helm local chart dependency '+str(dep.version),path:f.path,line:line(f.text,repository)});else c.diag(f.path,'Helm local dependency not selected: '+str(dep.name));}
    else c.diag(f.path,'Helm remote dependency not fetched: '+str(dep.name)+' '+str(dep.version));
   }continue;}
  const refs=[...arr(raw.resources),...arr(raw.bases),...arr(raw.components)].map(str).filter(Boolean);
  for(const ref of refs){const path=localPath(f.path,ref);if(!path||ref.includes('?ref=')||ref.includes('::')){c.diag(f.path,'Kustomize remote/unsafe reference refused: '+ref.slice(0,100));continue;}
   const direct=selected.get(path),child=c.files.find(x=>dir(x.path)===path&&/^(kustomization\.ya?ml|Kustomization)$/i.test(base(x.path)));
   if(child){if(child.path===f.path)c.diag(f.path,'Kustomize self-reference ignored.');else c.edge({from:'kubernetes:overlay:'+child.path,to:id,label:'Kustomize selected package reference',path:f.path,line:line(f.text,ref)});}
   else if(direct)for(const target of manifest(direct))c.edge({from:target,to:id,label:'Kustomize selected resource',path:f.path,line:line(f.text,ref)});
   else c.diag(f.path,'Kustomize resource/base not selected: '+ref.slice(0,100));
  }
  for(const patch of [...arr(raw.patches),...arr(raw.patchesStrategicMerge)]){const ref=typeof patch==='string'?patch:obj(patch)?str(patch.path):'';if(!ref)continue;const path=localPath(f.path,ref),target=path?selected.get(path):null;
   if(target){const key='kubernetes:patch:'+target.path;c.add({key,domain:'kubernetes',kind:'source',label:base(target.path),path:target.path,line:1,summary:'Selected Kustomize patch; target matching and transformed result unknown.'});c.edge({from:key,to:id,label:'Kustomize selected patch',path:f.path,line:line(f.text,ref)});}else c.diag(f.path,'Kustomize patch not selected: '+ref.slice(0,100));
  }
 }
}
