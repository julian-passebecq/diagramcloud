/** Bounded deterministic domain declarations. Source input is already authorized and
 * text/size filtered by acquisition. No C#/DAX/SQL execution, tenant queries or model calls.
 */
import {parse as parseYaml,parseDocument,isNode} from 'yaml';
import {validateDocument,type Project} from '../core/model';
import type {ScanFile} from '../core/scan/scanner';
import {SECRET_FILE,IGNORED_DIR,outsideNestedRepositories} from '../core/scan/scanner';
import {secretInText} from '../core/secrets';
import {GENERATED_PATH,GENERATED_HEADER,VENDOR_PATH} from '../core/scan/inventory';
import {analyzeAzure,analyzeDatabricks,analyzeDotnetSource,analyzeFabric,analyzeKubernetesPackaging} from './nativeAdapters';
import {analyzeAsyncApi} from './eventDeclarations';

export type Domain='fabric'|'databricks'|'dbt'|'dotnet'|'azure'|'kubernetes'|'packages'|'events';
export type DomainFact={key:string;domain:Domain;label:string;kind:Project['nodes'][number]['kind'];path:string;line:number;summary:string};
export type DomainLink={from:string;to:string;label:string;path:string;line:number};
export type DomainContract={role:'producer'|'consumer';scheme:'openapi-contract'|'nuget-package'|'npm-package';identity:string;version:string;nodeKey:string;path:string;line:number;digest?:string};
export type DomainResult={facts:DomainFact[];links:DomainLink[];capabilities:Domain[];diagnostics:string[];analyzerVersion:'diagramcloud-domain/3';contracts:DomainContract[];
 sources:{path:string;contentIdentity:string;parserVersion:string}[];
 limits:{facts:number;links:number;diagnostics:number};};
type Obj=Record<string,unknown>;
const object=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const entries=(v:unknown):[string,unknown][]=>object(v)?Object.entries(v):[];
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const str=(v:unknown):string=>typeof v==='string'?v:'';
const base=(p:string)=>p.split('/').at(-1)||p;
const dir=(p:string)=>p.split('/').slice(0,-1).join('/');
const normalized=(p:string)=>{
 const parts:string[]=[];for(const part of p.replace(/\\/g,'/').split('/')){
  if(!part||part==='.')continue;
  if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part);
 }return parts.join('/');
};
const join=(p:string,relative:string)=>normalized([dir(p),relative].filter(Boolean).join('/'));
const line=(text:string,needle:string)=>{const at=text.indexOf(needle);return at<0?1:text.slice(0,at).split('\n').length;};
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36);};
const stable=(prefix:string,key:string)=>prefix+'-'+hash(key)+'-'+hash(key.split('').reverse().join(''));
const MAX_FACTS=145,MAX_LINKS=220,MAX_DIAGNOSTICS=80;
export function analyzeDomainFiles(files:ScanFile[],options:{domains?:Domain[]}={}):DomainResult{
 const selected=options.domains===undefined?null:new Set(options.domains);const enabled=(domain:Domain)=>selected===null||selected.has(domain);
 if(selected&&[...selected].some(d=>!['fabric','databricks','dbt','dotnet','azure','kubernetes','packages','events'].includes(d)))throw new Error('Unsupported native domain selection');
 // Also guard direct CLI/library callers, not only the browser acquisition path.
 const inputCount=files.length;
 files=outsideNestedRepositories(files).filter(f=>f.path.length<=512&&!/^(?:\/|[a-z]:)/i.test(f.path)&&!f.path.includes('\\')&&!f.path.split('/').some(s=>s==='..'||s==='.'||!s)&&!SECRET_FILE.test(f.path)&&!VENDOR_PATH.test(f.path)&&((!IGNORED_DIR.test(f.path)&&!GENERATED_PATH.test(f.path))||/(^|\/)target\/manifest\.json$/i.test(f.path))&&!GENERATED_HEADER.test(f.text.slice(0,2048))&&!secretInText(f.text)&&new TextEncoder().encode(f.text).length<=512*1024).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).slice(0,1500);
 if(new Set(files.map(f=>f.path)).size!==files.length)throw new Error('Duplicate selected artifact paths refused');
 const facts=new Map<string,DomainFact>(),links=new Map<string,DomainLink>(),capabilities=new Set<Domain>(),diagnostics:string[]=[];
 if(inputCount!==files.length)diagnostics.push('Input selection: '+(inputCount-files.length)+' files omitted by path, sensitive-content, size or file budget; absence is not deletion.');
 const diag=(path:string,message:string)=>{if(diagnostics.length<MAX_DIAGNOSTICS)diagnostics.push(path+': '+message);};
 const add=(fact:DomainFact)=>{
  if(!fact.key||!fact.label)return;
  if(facts.size>=MAX_FACTS&&!facts.has(fact.key)){diag(fact.path,'Domain fact budget reached; select a smaller source.');return;}
  const old=facts.get(fact.key);if(old&&(old.path!==fact.path||old.label!==fact.label)){diag(fact.path,'Conflicting identity '+fact.key);return;}
  facts.set(fact.key,{...fact,label:fact.label.slice(0,160),summary:fact.summary.slice(0,500)});capabilities.add(fact.domain);
 };
 const edge=(v:DomainLink)=>{
  const key=v.from+' -> '+v.to+' '+v.label;if(links.size>=MAX_LINKS||links.has(key))return;
  links.set(key,{...v,label:v.label.slice(0,150)});
 };
 const parsed=(file:ScanFile,json:boolean)=>{
  try{return json?JSON.parse(file.text) as unknown:parseYaml(file.text) as unknown;}
  catch {diag(file.path,'Invalid selected JSON/YAML; no facts inferred.');return null;}
 };
 const locations=new Map<string,ReturnType<typeof parseDocument>>();
 const declarationLine=(file:ScanFile,path:(string|number)[],fallback:string)=>{try{if(!locations.has(file.path))locations.set(file.path,parseDocument(file.text));const node=locations.get(file.path)!.getIn(path,true);return isNode(node)&&node.range?file.text.slice(0,node.range[0]).split('\n').length:line(file.text,fallback);}catch{return line(file.text,fallback);}};
 const xmlCache=new Map<string,string>(),xml=(f:ScanFile)=>{if(!xmlCache.has(f.path))xmlCache.set(f.path,f.text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g,m=>m.replace(/[^\r\n]/g,' ')));return xmlCache.get(f.path)!;},xmlLine=(f:ScanFile,index:number)=>f.text.slice(0,index).split('\n').length;
 // Pass 1 materializes explicit native identities before linking their references.
 for(const f of files){
  const p=f.path.toLowerCase(),name=base(p);
  if(enabled('dbt')&&name==='manifest.json'){
   const data=parsed(f,true);
   if(!object(data)||!object(data.nodes)||!object(data.metadata)||!str(data.metadata.dbt_schema_version))continue;
   if(!/\/manifest\/v(?:[4-9]|1[0-2])\.json$/.test(str(data.metadata.dbt_schema_version))){diag(f.path,'Unsupported dbt manifest version; supported v4–v12 only.');continue;}
   const candidates=[...entries(data.nodes),...entries(data.sources),...entries(data.exposures)];
   for(const [key,raw] of candidates){
    if(!object(raw)||!/^(model|source|test|snapshot|seed|exposure)\./.test(key))continue;
    add({key:'dbt:'+key,domain:'dbt',kind:key.startsWith('source.')?'source':key.startsWith('test.')?'control':'model',
     label:str(raw.name)||key,path:f.path,line:line(f.text,'"'+key+'"'),
     summary:key+'; dbt artifact declaration, not an executed model.'});
   }
  }
  if(enabled('dotnet')&&name.endsWith('.csproj')){
   const key='dotnet:project:'+f.path;
   add({key,domain:'dotnet',kind:'app',label:base(f.path).replace(/\.csproj$/i,''),path:f.path,
    line:1,summary:'.NET project manifest; not a C# call graph.'});
  }
  if(enabled('fabric')&&(name==='definition.pbir'||name.endsWith('.pbip'))){
   const data=parsed(f,true);if(!object(data))continue;
   if(data.version&&!/^[1-4](?:\.|$)/.test(str(data.version))){diag(f.path,'Unsupported PBIP/PBIR version; supported major 1–4.');continue;}
   const key='fabric:report:'+f.path;
   add({key,domain:'fabric',kind:'report',label:dir(f.path).split('/').at(-1)||base(f.path),
    path:f.path,line:1,summary:'Power BI project/report definition; static artifact only.'});
  }
  if(enabled('dotnet')&&(/(?:^|\/)(openapi|swagger)(?:\.[^/]*)?\.(json|ya?ml)$/.test(p)||name==='openapi.yaml'||name==='openapi.json')){
   const data=parsed(f,/\.json$/.test(name));
   if(!object(data)||!((typeof data.openapi==='string')||(typeof data.swagger==='string'))||!object(data.paths))continue;
   if(!(str(data.swagger)==='2.0'||/^3\.[01]\./.test(str(data.openapi)))){diag(f.path,'Unsupported OpenAPI version; supported Swagger 2.0 and OpenAPI 3.0/3.1.');continue;}
   const api='dotnet:api:'+f.path;
   add({key:api,domain:'dotnet',kind:'app',label:str(object(data.info)&&data.info.title)||'OpenAPI interface',
    path:f.path,line:1,summary:'Supplied OpenAPI contract; no server implementation inferred.'});
   for(const [route,ops] of entries(data.paths)){
    for(const [verb,raw] of entries(ops)){
     if(!/^(get|post|put|patch|delete|head|options|trace)$/.test(verb)||!object(raw))continue;
     const id='dotnet:operation:'+f.path+':'+verb+':'+route;
     add({key:id,domain:'dotnet',kind:'function',label:verb.toUpperCase()+' '+route,
      path:f.path,line:line(f.text,route),summary:'Declared API operation; no implementation/call graph inferred.'});
    }
   }
  }
 }
 // Additional native declarations use explicit identities and references only.
 for(const f of files){const name=base(f.path).toLowerCase();
  if(enabled('dotnet')&&(name.endsWith('.sln')||name.endsWith('.slnx'))){
   add({key:'dotnet:solution:'+f.path,domain:'dotnet',kind:'control',label:base(f.path),path:f.path,line:1,summary:'Declared solution membership, independent from source branch or deployment.'});
  }
  if(enabled('dotnet')&&name.endsWith('.csproj'))for(const m of xml(f).matchAll(/<PackageReference\b[^>]*\bInclude\s*=\s*["']([^"']+)["'][^>]*>/gi)){
   const version=/\bVersion\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1]??'unspecified';
   const key='dotnet:package:'+m[1]+'@'+version;
   add({key,domain:'dotnet',kind:'source',label:m[1],path:f.path,line:xmlLine(f,m.index!),summary:'Declared NuGet package '+version+'; resolution and vulnerabilities unknown.'});
   edge({from:key,to:'dotnet:project:'+f.path,label:'PackageReference '+version,path:f.path,line:xmlLine(f,m.index!)});
  }
  if(enabled('dotnet')&&/^(openapi|swagger).*\.(json|ya?ml)$/.test(name)){
   const data=parsed(f,name.endsWith('.json'));if(!object(data)||!facts.has('dotnet:api:'+f.path))continue;
   const schemas=object(data.components)?data.components.schemas:data.definitions;
   for(const [key] of entries(schemas))add({key:'dotnet:schema:'+f.path+':'+key,domain:'dotnet',kind:'model',label:key,path:f.path,line:line(f.text,key),summary:'Supplied OpenAPI schema declaration; no implementation type inferred.'});
   const refs=(v:unknown,depth=0):string[]=>depth>20?[]:Array.isArray(v)?v.flatMap(x=>refs(x,depth+1)):object(v)?[...Object.entries(v).flatMap(([k,x])=>k==='$ref'&&typeof x==='string'?[x]:refs(x,depth+1))]:[];
   for(const [key,raw] of entries(schemas))for(const ref of refs(raw)){const match=/^#\/(?:components\/schemas|definitions)\/([^/]+)$/.exec(ref);
    if(match){const target=match[1].replace(/~1/g,'/').replace(/~0/g,'~');if(entries(schemas).some(([k])=>k===target))edge({from:'dotnet:schema:'+f.path+':'+target,to:'dotnet:schema:'+f.path+':'+key,label:'schema $ref',path:f.path,line:line(f.text,ref)});else diag(f.path,'Unresolved schema reference: '+ref);}
    else diag(f.path,'External OpenAPI reference not fetched: '+ref.slice(0,100));}
   for(const [route,ops] of entries(data.paths))for(const [verb,raw] of entries(ops))for(const ref of refs(raw)){
    const match=/^#\/(?:components\/schemas|definitions)\/([^/]+)$/.exec(ref);if(match){const key=match[1].replace(/~1/g,'/').replace(/~0/g,'~');
     edge({from:'dotnet:schema:'+f.path+':'+key,to:'dotnet:operation:'+f.path+':'+verb+':'+route,label:'operation schema $ref',path:f.path,line:line(f.text,ref)});}}
  }
 }
 const native={files,facts,add,edge,diag,parsed};
 if(enabled('databricks'))analyzeDatabricks(native);if(enabled('fabric'))analyzeFabric(native);if(enabled('azure'))analyzeAzure(native);if(enabled('dotnet'))analyzeDotnetSource(native);if(enabled('kubernetes'))analyzeKubernetesPackaging(native);if(enabled('events'))analyzeAsyncApi(native);
 // Pass 2: relations only when both endpoints have exact native identities.
 for(const f of files){
  const p=f.path.toLowerCase(),name=base(p);
  if(enabled('dbt')&&name==='manifest.json'){
   const data=parsed(f,true);if(!object(data)||!object(data.nodes)||!object(data.metadata)||!str(data.metadata.dbt_schema_version))continue;
   for(const section of ['nodes','sources','exposures'])for(const [key,raw] of entries(data[section])){
    if(!object(raw)||!facts.has('dbt:'+key)||facts.get('dbt:'+key)?.path!==f.path)continue;
    const dependencyValue=object(raw.depends_on)?raw.depends_on.nodes:undefined,parentMap=object(data.parent_map)?data.parent_map:null,hasParents=parentMap&&Object.hasOwn(parentMap,key),parentValue=hasParents?parentMap[key]:undefined;
    if((parentValue!==undefined&&(!Array.isArray(parentValue)||parentValue.some(id=>typeof id!=='string'||!id)))||(dependencyValue!==undefined&&(!Array.isArray(dependencyValue)||dependencyValue.some(id=>typeof id!=='string'||!id)))){diag(f.path,'Invalid dbt structured dependency list for '+key+'; no relationships guessed.');continue;}
    const dependencies=array(dependencyValue).map(str),parents=hasParents?array(parentValue).map(str):null;
    if(parents&&object(raw.depends_on)&&Array.isArray(raw.depends_on.nodes)&&JSON.stringify([...new Set(dependencies)].sort())!==JSON.stringify([...new Set(parents)].sort())){diag(f.path,'dbt parent_map contradicts depends_on for '+key+'; conflicting relationships omitted.');continue;}
    for(const [index,id] of (parents??dependencies).entries()){
     const sourcePath:(string|number)[]=parents?['parent_map',key,index]:[section,key,'depends_on','nodes',index];
     if(facts.has('dbt:'+id)&&facts.get('dbt:'+id)?.path===f.path)edge({from:'dbt:'+id,to:'dbt:'+key,label:parents?'dbt manifest parent_map':'dbt declared depends_on',path:f.path,line:declarationLine(f,sourcePath,'"'+key+'"')});
     else diag(f.path,'dbt dependency not in selected manifest: '+id.slice(0,100));
    }
   }
  }
  if(enabled('dotnet')&&name.endsWith('.csproj')){
   const to='dotnet:project:'+f.path;
   for(const m of xml(f).matchAll(/<ProjectReference\b[^>]*\bInclude\s*=\s*["']([^"']+)["']/gi)){
    const target=join(f.path,m[1]);
    if(target&&facts.has('dotnet:project:'+target))
     edge({from:'dotnet:project:'+target,to,label:'ProjectReference',path:f.path,line:xmlLine(f,m.index!)});
    else diag(f.path,'ProjectReference not in selected sources: '+m[1].slice(0,100));
   }
  }
  if(enabled('dotnet')&&(/(?:^|\/)(openapi|swagger)(?:\.[^/]*)?\.(json|ya?ml)$/.test(p)||name==='openapi.yaml'||name==='openapi.json')){
   const data=parsed(f,/\.json$/.test(name));
   if(!object(data)||!object(data.paths))continue;
   const api='dotnet:api:'+f.path;
   for(const [route,ops] of entries(data.paths))for(const [verb,raw] of entries(ops)){
    const id='dotnet:operation:'+f.path+':'+verb+':'+route;
    if(object(raw)&&facts.has(id)&&facts.has(api))
     edge({from:api,to:id,label:'declares API operation',path:f.path,line:line(f.text,route)});
   }
  }
  if(enabled('fabric')&&name==='definition.pbir'){
   const data=parsed(f,true);
   const byPath=object(data)&&object(data.datasetReference)&&object(data.datasetReference.byPath)
    ?str(data.datasetReference.byPath.path):'';
   const target=byPath?join(f.path,byPath):null;
   if(target&&facts.has('fabric:model:'+target))edge({from:'fabric:model:'+target,to:'fabric:report:'+f.path,label:'PBIR declared datasetReference',path:f.path,line:line(f.text,byPath)});
   else if(byPath)diag(f.path,'PBIR model path not in selected artifacts: '+byPath.slice(0,100));
  }
  if(enabled('dotnet')&&(name.endsWith('.sln')||name.endsWith('.slnx'))){
   const pattern=name.endsWith('.slnx')?/<Project\b[^>]*Path\s*=\s*"([^"]+)"/gi:/Project\([^\n]+?=\s*"[^"]+",\s*"([^"]+\.csproj)"/gi;
   for(const m of (name.endsWith('.slnx')?xml(f):f.text).matchAll(pattern)){const target=join(f.path,m[1]);if(target&&facts.has('dotnet:project:'+target))edge({from:'dotnet:solution:'+f.path,to:'dotnet:project:'+target,label:'solution member',path:f.path,line:xmlLine(f,m.index!)});else diag(f.path,'Solution member not selected: '+m[1].slice(0,100));}
  }
 }
 const contracts:DomainContract[]=[];
 const contract=(v:DomainContract)=>{if(contracts.length<200&&v.identity.length<=200&&v.version.length<=100&&v.identity&&v.version&&!secretInText(v.identity)&&!secretInText(v.version))contracts.push(v);};
 for(const f of files){const name=base(f.path).toLowerCase();
  if(enabled('dotnet')&&name.endsWith('.csproj')){
   const property=(p:string)=>new RegExp('<'+p+'\\b[^>]*>([^<>]+)</'+p+'>','i').exec(xml(f))?.[1].trim()||'';
   const packageId=property('PackageId'),version=property('PackageVersion')||property('Version');
   if(packageId&&version&&property('IsPackable').toLowerCase()==='true'&&!/[${}*]/.test(packageId+version))contract({role:'producer',scheme:'nuget-package',identity:packageId,version,nodeKey:'dotnet:project:'+f.path,path:f.path,line:xmlLine(f,xml(f).search(/<PackageId\b/i))});
   for(const m of xml(f).matchAll(/<PackageReference\b[^>]*\bInclude\s*=\s*["']([^"']+)["'][^>]*>/gi)){const version=/\bVersion\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1];if(version&&/^\d+\.\d+(?:\.\d+)?(?:-[\w.-]+)?$/.test(version))contract({role:'consumer',scheme:'nuget-package',identity:m[1],version,nodeKey:'dotnet:project:'+f.path,path:f.path,line:xmlLine(f,m.index!)});}
  }
  if(enabled('packages')&&/^package\.json$/.test(name)){const data=parsed(f,true);if(!object(data)||!str(data.name))continue;const nodeKey='package:npm:'+f.path;
   add({key:nodeKey,domain:'packages',kind:'app',label:str(data.name),path:f.path,line:1,summary:'Selected npm package manifest; dependency resolution and publication unknown.'});
   if(data.private!==true&&str(data.version))contract({role:'producer',scheme:'npm-package',identity:str(data.name),version:str(data.version),nodeKey,path:f.path,line:line(f.text,'"name"')});
   for(const [identity,value] of [...entries(data.dependencies),...entries(data.devDependencies)])if(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(str(value)))contract({role:'consumer',scheme:'npm-package',identity,version:str(value),nodeKey,path:f.path,line:line(f.text,'"'+identity+'"')});
  }
  if(enabled('dotnet')&&/^openapi|^swagger/.test(name)){const data=parsed(f,name.endsWith('.json'));if(!object(data)||!facts.has('dotnet:api:'+f.path))continue;
   const identity=str(data['x-diagramcloud-contract-id']),version=object(data.info)?str(data.info.version):'';
   const declaredDigest=str(data['x-diagramcloud-contract-digest']);
   if(identity&&version)contract({role:'producer',scheme:'openapi-contract',identity,version,nodeKey:'dotnet:api:'+f.path,path:f.path,line:line(f.text,'x-diagramcloud-contract-id'),...(/^sha256:[a-f0-9]{64}$/i.test(declaredDigest)?{digest:declaredDigest}:{})});
   for(const raw of array(data['x-diagramcloud-consumes']))if(object(raw))contract({role:'consumer',scheme:'openapi-contract',identity:str(raw.id),version:str(raw.version),nodeKey:'dotnet:api:'+f.path,path:f.path,line:line(f.text,'x-diagramcloud-consumes'),...(str(raw.digest)?{digest:str(raw.digest)}:{})});
  }
 }
 return {facts:[...facts.values()],links:[...links.values()].filter(l=>facts.has(l.from)&&facts.has(l.to)),contracts:contracts.filter(c=>facts.has(c.nodeKey)),
  capabilities:[...capabilities].sort(),diagnostics,analyzerVersion:'diagramcloud-domain/3',
  sources:files.filter(f=>[...facts.values()].some(x=>x.path===f.path)).map(f=>({path:f.path,contentIdentity:'fnv-pair:'+hash(f.text)+'-'+hash(f.text.split('').reverse().join('')),parserVersion:'diagramcloud-domain/3'})),
  limits:{facts:MAX_FACTS,links:MAX_LINKS,diagnostics:MAX_DIAGNOSTICS}};
}
/** Add specialist projections without touching scanner-owned identities or existing views. */
export function extendWithDomainFacts(input:Project,report:DomainResult,budget:{nodes?:number;edges?:number;views?:number;sources?:number;sourceRevision?:string}={}):Project{
 const doc=structuredClone(input);
 const root=doc.views.find(v=>v.id===doc.rootViewId);
 if(!root)return input;
 const nodeLimit=Math.min(500,budget.nodes??500),edgeLimit=Math.min(1500,budget.edges??1500),viewLimit=Math.min(80,budget.views??80),sourceLimit=Math.min(200,budget.sources??200);
 const receipt=JSON.stringify({analyzerVersion:report.analyzerVersion,repositoryRevision:budget.sourceRevision??null,capabilities:report.capabilities,sources:report.sources,contracts:report.contracts,diagnostics:report.diagnostics,limits:report.limits});
 const rootNode=doc.nodes.find(n=>root.nodeIds.includes(n.id));
 if(rootNode&&receipt.length<=48000&&doc.blocks.length<1490){const id='domain-analysis-receipt';doc.blocks=doc.blocks.filter(b=>b.id!==id);doc.blocks.push({id,title:'Static analyzer capabilities and limits',type:'code',language:'json',code:receipt,provenance:'source-derived',sourceIds:[],visibility:'private'});rootNode.blockIds=[...new Set([...rootNode.blockIds,id])];}
 const sources=new Map<string,string>(),nodes=new Map<string,string>(),blocks=new Set<string>(doc.blocks.map(x=>x.id));
 const keySource=(path:string)=>{let id=sources.get(path);if(id)return id;id=stable('domain-src',path);
  if(doc.sources.some(s=>s.id===id))throw new Error('Domain source hash collision');
  if(doc.sources.length>=sourceLimit)return '';
  doc.sources.push({id,title:('Source '+base(path)).slice(0,160),location:path,visibility:'private'});
  sources.set(path,id);return id;};
 for(const fact of report.facts){
  if(doc.nodes.length>=nodeLimit-Math.min(report.capabilities.length,viewLimit-doc.views.length)||doc.blocks.length>=1490)break;
  const id=stable('domain',fact.key),source=keySource(fact.path);if(!source)break;
  if(doc.nodes.some(n=>n.id===id))throw new Error('Domain node hash collision');
  const blockId=stable('domain-evidence',fact.key);if(blocks.has(blockId))throw new Error('Domain evidence hash collision');
  blocks.add(blockId);
  doc.blocks.push({id:blockId,title:'Static artifact declaration',type:'text',text:fact.path+':'+fact.line+
   ' — '+fact.summary+'\n'+report.links.filter(l=>l.to===fact.key||l.from===fact.key).map(l=>l.path+':'+l.line+' — '+l.from+' '+l.label+' '+l.to).join('\n'),provenance:'source-derived',sourceIds:[source],visibility:'private'});
  doc.nodes.push({id,label:fact.label,kind:fact.kind,provider:'Generic',icon:'generic-'+fact.kind,summary:fact.summary,
   role:'',status:'idle',blockIds:[blockId],sourceIds:[source],tags:[fact.domain,'Source-derived'],
   visibility:'private',basis:'static-source'});
  nodes.set(fact.key,id);
 }
 const memberships=new Map<Domain,string[]>();
 for(const fact of report.facts){const id=nodes.get(fact.key);if(id)memberships.set(fact.domain,[...(memberships.get(fact.domain)||[]),id]);}
 const edgesByDomain=new Map<Domain,string[]>();
 for(const link of report.links){
  if(doc.edges.length>=edgeLimit)break;
  const from=nodes.get(link.from),to=nodes.get(link.to);if(!from||!to)continue;
  const id=stable('domain-edge',link.from+'>'+link.to+link.label);
  if(doc.edges.some(e=>e.id===id))throw new Error('Domain relation hash collision');
  doc.edges.push({id,source:from,target:to,label:link.label,speed:'medium',kind:'dependency',
   basis:'static-source',visibility:'private'});
  const domain=report.facts.find(f=>f.key===link.to)?.domain;
  if(domain){edgesByDomain.set(domain,[...(edgesByDomain.get(domain)||[]),id]);
   memberships.set(domain,[...new Set([...(memberships.get(domain)||[]),from,to])]);}
 }
 for(const domain of report.capabilities){
  const ids=memberships.get(domain)||[];if(!ids.length||doc.views.length>=viewLimit||doc.nodes.length>=nodeLimit)continue;
  const viewId='domain-view-'+domain,navId='domain-nav-'+domain;
  if(doc.views.some(v=>v.id===viewId)||doc.nodes.some(n=>n.id===navId))throw new Error('Domain view collision');
  const title={fabric:'Fabric / Power BI static items',databricks:'Databricks job and tasks',
   dbt:'dbt declared lineage',dotnet:'.NET and OpenAPI declarations',azure:'Azure declarations',kubernetes:'Helm / Kustomize declarations',packages:'Package contract declarations',events:'AsyncAPI event declarations'}[domain];
  doc.views.push({id:viewId,title,description:'Source declarations only; runtime and cross-service traffic unknown.',
   perspective:domain==='dbt'||domain==='fabric'?'data':domain==='databricks'?'cicd':'code',
   visibility:'private',nodeIds:ids,edgeIds:edgesByDomain.get(domain)||[],
   positions:Object.fromEntries(ids.map((id,i)=>[id,{x:(i%4)*285,y:Math.floor(i/4)*180}]))});
  doc.nodes.push({id:navId,label:title,kind:'control',provider:'Generic',icon:'generic',
   summary:'Deterministic static analyzer view; not observed runtime.',role:'',status:'idle',
   blockIds:[],sourceIds:[],tags:['Domain','Navigation'],visibility:'private',basis:'static-source',childViewId:viewId});
  root.nodeIds.push(navId);root.positions[navId]={x:(root.nodeIds.length-1)%3*300,y:Math.floor((root.nodeIds.length-1)/3)*180};
 }
 return validateDocument(doc);
}
