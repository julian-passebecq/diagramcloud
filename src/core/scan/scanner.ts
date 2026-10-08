import {parseAllDocuments} from 'yaml';
import type {ProjectEdge,ProjectNode} from '../model';
import {inferKind} from '../interchange/graph';
import {DEPLOY_ACTIONS,FRAMEWORK_KIND,IMAGE_TECH,TECHS,TERRAFORM_PROVIDER,techOfPackage,terraformKind,type TechKey} from './tech';

/**
 * Deterministic repository scanner. It reads manifests (package.json, requirements, pyproject, go.mod), Dockerfiles,
 * docker-compose, Kubernetes manifests, Terraform, GitHub Actions workflows, SQL / dbt / Prisma schemas, example env
 * files (key names only) and import statements, and returns a model of systems, containers, components, tables and
 * resources. Every item and link carries file:line evidence and a confidence:
 *  - confirmed: declared explicitly (depends_on, an import statement, a Terraform reference, a foreign key);
 *  - inferred: implied by a declaration (a database driver in the dependencies, a host name in configuration);
 *  - possible: a hint only (a key name in an example env file).
 * Nothing is executed, no network is used, and secret files (.env, keys, certificates) are never read.
 */
export type ScanFile={path:string;text:string};
export type Confidence='confirmed'|'inferred'|'possible';
export type Evidence={file:string;line:number;finding:string;confidence:Confidence};
export type ScanLayer='system'|'external'|'container'|'component'|'file'|'table'|'resource'|'ci'|'group';
export type ScanItem={key:string;label:string;kind:ProjectNode['kind'];provider:string;layer:ScanLayer;parent?:string;summary:string;confidence:Confidence;evidence:Evidence[];tech?:TechKey;files?:number};
export type ScanLink={from:string;to:string;label:string;kind:ProjectEdge['kind'];confidence:Confidence;evidence:Evidence[];layer:'container'|'component'|'file'|'data'|'resource'|'ci';count:number};
export type ScanModel={name:string;branch?:string;commit?:string;items:Map<string,ScanItem>;links:ScanLink[];detectors:Map<string,number>;skipped:Map<string,number>};

const RANK:Record<Confidence,number>={confirmed:3,inferred:2,possible:1};
const best=(a:Confidence,b:Confidence)=>RANK[a]>=RANK[b]?a:b;
export const lineAt=(text:string,index:number)=>index<0?1:text.slice(0,index).split('\n').length;
/** Line of the first match of `needle` (string or regex) in text, from an optional offset; 1 when not found. */
export function lineOf(text:string,needle:string|RegExp,from=0):number{
 if(typeof needle==='string'){const i=text.indexOf(needle,from);return lineAt(text,i);}
 const re=new RegExp(needle.source,needle.flags.replace('g','')+'g');re.lastIndex=from;const m=re.exec(text);return lineAt(text,m?m.index:-1);
}
const dirOf=(p:string)=>p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';
const baseOf=(p:string)=>p.slice(p.lastIndexOf('/')+1);
const join=(...parts:string[])=>normalize(parts.filter(Boolean).join('/'));
function normalize(p:string):string{const out:string[]=[];for(const s of p.split('/')){if(!s||s==='.')continue;if(s==='..')out.pop();else out.push(s);}return out.join('/');}

/** Directories never scanned, and files never read because they may hold secrets. */
export const IGNORED_DIR=/(^|\/)(node_modules|\.git|dist|build|out|coverage|vendor|target|\.venv|venv|env|__pycache__|\.next|\.nuxt|\.turbo|\.cache|\.idea|\.vscode|bin|obj|\.terraform|site-packages|test-results|playwright-report|\.claude\/worktrees|\.worktrees)(\/|$)/;
export const SECRET_FILE=/(^|\/)(\.env(\.(?!example$|sample$|template$|dist$)[^/]*)?|\.npmrc|\.pypirc|id_[a-z0-9]+|[^/]*\.(pem|key|p12|pfx|jks|keystore|tfstate|tfstate\.backup|tfvars)|[^/]*(secret|credential)s?[^/]*\.(json|ya?ml|txt))$/i;
const SOURCE=/\.(ts|tsx|js|jsx|mjs|cjs|py)$/;
const GIT_FILES=/^\.git\/(HEAD|packed-refs|refs\/heads\/.+)$/;
/** Whether a repository-relative path is worth reading (used by the browser folder picker and the CLI walker). */
/** Sub-folders that carry their own `.git` (a nested clone, submodule or git worktree): another repository, never part of this one. */
export function nestedRepositoryPrefixes(paths:string[]):string[]{
 const out=new Set<string>();for(const p of paths){const m=/^(.+?)\/\.git(\/|$)/.exec(p);if(m)out.add(m[1]);}
 return [...out].sort();
}
/** Paths outside every nested repository. */
export function outsideNestedRepositories<T extends {path:string}>(items:T[]):T[]{const nested=nestedRepositoryPrefixes(items.map(i=>i.path));return items.filter(i=>!nested.some(n=>i.path===n||i.path.startsWith(`${n}/`)));}
export function wantedFile(path:string):boolean{
 if(GIT_FILES.test(path))return true;
 if((IGNORED_DIR.test(path)&&!/(^|\/)target\/manifest\.json$/i.test(path))||SECRET_FILE.test(path))return false;
 const name=baseOf(path).toLowerCase();
 return name==='package.json'||/^requirements[\w.-]*\.txt$/.test(name)||name==='pyproject.toml'||name==='go.mod'||/^dockerfile/.test(name)||/\.dockerfile$/.test(name)
  ||/\.(ya?ml)$/.test(name)||/\.tf$/.test(name)||name==='schema.prisma'||/\.sql$/.test(name)
  ||/\.(pbir|pbip|tmdl|bicep|csproj|sln|slnx)$/.test(name)||name==='manifest.json'||name==='definition.pbism'||name==='openapi.json'||name==='swagger.json'||name==='.platform'||name==='databricks.json'||/\.job\.json$/.test(name)||/^\.env\.(example|sample|template|dist)$/.test(name)||SOURCE.test(name);
}
export const MAX_FILE_BYTES=512*1024,MAX_FILES=6000;

export function scanRepository(input:ScanFile[],options:{name?:string}={}):ScanModel{
 const files=new Map<string,string>(),skipped=new Map<string,number>(),detectors=new Map<string,number>();
 const skip=(why:string)=>skipped.set(why,(skipped.get(why)??0)+1),seen=(what:string,n=1)=>detectors.set(what,(detectors.get(what)??0)+n);
 for(const f of input){
  const path=normalize(f.path.replace(/\\/g,'/'));
  if(SECRET_FILE.test(path)&&!GIT_FILES.test(path)){skip('secret or credential file(s) never read');continue;}
  if(!wantedFile(path))continue;
  if(files.size>=MAX_FILES){skip(`file(s) beyond the first ${MAX_FILES} not read`);continue;}
  if(f.text.length>MAX_FILE_BYTES){skip('file(s) over 512 KiB not read');continue;}
  files.set(path,f.text);
 }
 const items=new Map<string,ScanItem>(),links=new Map<string,ScanLink>();
 const item=(key:string,init:Omit<ScanItem,'key'|'evidence'|'confidence'>&{confidence?:Confidence},ev?:Evidence):ScanItem=>{
  let it=items.get(key);
  if(!it){it={key,evidence:[],confidence:ev?.confidence??init.confidence??'inferred',...init};items.set(key,it);}
  if(ev){it.evidence.push(ev);it.confidence=best(it.confidence,ev.confidence);}
  return it;
 };
 const link=(from:string,to:string,label:string,layer:ScanLink['layer'],ev:Evidence,kind:ProjectEdge['kind']='batch')=>{
  if(from===to)return;
  const k=`${from}>${to}>${layer}`,l=links.get(k);
  if(l){l.count++;if(l.evidence.length<20)l.evidence.push(ev);if(RANK[ev.confidence]>RANK[l.confidence]){l.confidence=ev.confidence;l.label=label;}return;}
  links.set(k,{from,to,label,layer,kind,confidence:ev.confidence,evidence:[ev],count:1});
 };
 const ev=(file:string,line:number,finding:string,confidence:Confidence):Evidence=>({file,line,finding,confidence});

 // ---- Git identity (read-only: HEAD and refs, never objects) ----
 let branch:string|undefined,commit:string|undefined;
 const head=files.get('.git/HEAD')?.trim();
 if(head){const ref=head.match(/^ref:\s*(refs\/heads\/(.+))$/);if(ref){branch=ref[2];commit=files.get(`.git/${ref[1]}`)?.trim()??files.get('.git/packed-refs')?.split('\n').find(l=>l.endsWith(` ${ref[1]}`))?.split(' ')[0];}else if(/^[0-9a-f]{40}$/.test(head))commit=head;}
 if(commit&&!/^[0-9a-f]{40,64}$/.test(commit))commit=undefined;

 // ---- Code containers: folders with a manifest or a Dockerfile ----
 const rootPkg=files.get('package.json');let rootJson:Record<string,unknown>={};try{rootJson=rootPkg?JSON.parse(rootPkg):{};}catch{skip('package.json file(s) that are not valid JSON');}
 const name=(options.name||(typeof rootJson.name==='string'?rootJson.name.replace(/^@[^/]+\//,''):'')||'repository').slice(0,120);
 const systemKey='system';
 item(systemKey,{label:name,kind:'app',provider:'Generic',layer:'system',summary:'The scanned repository as one system.',confidence:'confirmed'},ev('.',1,'Repository root','confirmed'));
 const containerDirs=new Set<string>();const packageNames=new Map<string,string>();
 const manifests=[...files.keys()].filter(p=>/(^|\/)(package\.json|pyproject\.toml|go\.mod)$|(^|\/)requirements[\w.-]*\.txt$|(^|\/)([\w.-]*\.)?dockerfile$|(^|\/)dockerfile[\w.-]*$/i.test(p));
 const isWorkspaceRoot=Array.isArray(rootJson.workspaces)||typeof rootJson.workspaces==='object'&&rootJson.workspaces!==null||files.has('pnpm-workspace.yaml')||files.has('lerna.json');
 if(!manifests.length&&[...files.keys()].some(p=>SOURCE.test(p)))containerDirs.add('');
 for(const p of manifests){const d=dirOf(p);if(d===''&&isWorkspaceRoot&&manifests.some(q=>dirOf(q)!==''&&/package\.json$/.test(q)))continue;containerDirs.add(d);}
 const containerKey=(d:string)=>`c:${d||'.'}`;
 const ownerOf=(path:string)=>{let best:string|undefined;for(const d of containerDirs)if((d===''||path===d||path.startsWith(`${d}/`))&&(best===undefined||d.length>best.length))best=d;return best;};
 const usesFramework=new Map<string,Set<string>>();
 const declare=(d:string,file:string,line:number,dep:string,how:string)=>{
  const fw=FRAMEWORK_KIND.find(([re])=>re.test(dep));if(fw)(usesFramework.get(d)??usesFramework.set(d,new Set()).get(d)!).add(`${fw[2]}|${fw[1]}|${dep}`);
  const tech=techOfPackage(dep);if(tech){seen('dependency on a known external system');linkTech(containerKey(d),tech,ev(file,line,`${how} ${dep}`,'inferred'),`uses (${dep})`);}
 };
 const techTargets=new Map<TechKey,string>();
 const techNode=(tech:TechKey)=>{const t=techTargets.get(tech);if(t)return t;const k=`x:${tech}`,T=TECHS[tech];item(k,{label:T.label,kind:T.kind,provider:T.provider,layer:'external',summary:'External system used by the code.',tech,confidence:'possible'});return k;};
 const pendingTech:[string,TechKey,Evidence,string][]=[];
 function linkTech(from:string,tech:TechKey,e:Evidence,label:string){pendingTech.push([from,tech,e,label]);}

 for(const d of [...containerDirs].sort()){
  const key=containerKey(d),pkgPath=join(d,'package.json'),pkg=files.get(pkgPath);
  let label=d?baseOf(d):name,summary='Code container';
  const found:string[]=[];
  if(pkg){let json:Record<string,unknown>={};try{json=JSON.parse(pkg);}catch{skip('package.json file(s) that are not valid JSON');}
   if(typeof json.name==='string'){label=json.name.replace(/^@[^/]+\//,'');packageNames.set(json.name,d);}
   for(const section of ['dependencies','devDependencies','peerDependencies','optionalDependencies']){const deps=json[section];if(deps&&typeof deps==='object')for(const dep of Object.keys(deps as object)){if(section==='devDependencies'&&!FRAMEWORK_KIND.some(([re])=>re.test(dep)))continue;declare(d,pkgPath,lineOf(pkg,`"${dep}"`),dep,'package.json declares');}}
   found.push('package.json');seen('package.json manifest');}
  for(const req of [...files.keys()].filter(p=>dirOf(p)===d&&/(^|\/)requirements[\w.-]*\.txt$/.test(p))){const text=files.get(req)!;text.split('\n').forEach((l,i)=>{const m=l.match(/^\s*([A-Za-z0-9_.\-]+)/);if(m&&!l.trim().startsWith('#')&&!l.trim().startsWith('-'))declare(d,req,i+1,m[1].toLowerCase(),'requirements declare');});found.push(baseOf(req));seen('Python requirements');}
  const py=files.get(join(d,'pyproject.toml'));
  if(py){const nm=py.match(/^\s*name\s*=\s*"([^"]+)"/m);if(nm&&!pkg)label=nm[1];
   py.split('\n').forEach((l,i)=>{const m=l.match(/^\s*"([A-Za-z0-9_.\-]+)\s*(?:\[[^\]]*\])?\s*(?:[<>=!~;].*)?",?\s*$/)??l.match(/^\s*([A-Za-z0-9_\-]+)\s*=\s*(?:"[^"]*"|\{)/);if(m&&!/^(name|version|description|python|requires-python|readme|license|authors|packages|include|build-backend|requires)$/i.test(m[1]))declare(d,join(d,'pyproject.toml'),i+1,m[1].toLowerCase(),'pyproject declares');});
   found.push('pyproject.toml');seen('pyproject manifest');}
  const gomod=files.get(join(d,'go.mod'));
  if(gomod){const mod=gomod.match(/^module\s+(\S+)/m);if(mod&&!pkg&&!py)label=baseOf(mod[1]);gomod.split('\n').forEach((l,i)=>{const m=l.match(/^\s*(?:require\s+)?([a-z0-9.\-]+\.[a-z]+\/[^\s]+)\s+v/i);if(m)declare(d,join(d,'go.mod'),i+1,m[1],'go.mod requires');});found.push('go.mod');seen('go.mod manifest');}
  const docker=[...files.keys()].find(p=>dirOf(p)===d&&/(^|\/)(dockerfile[\w.-]*|[\w.-]*\.dockerfile)$/i.test(p));
  if(docker){const text=files.get(docker)!,from=text.match(/^\s*FROM\s+(\S+)/im);found.push(`${baseOf(docker)}${from?` (FROM ${from[1]})`:''}`);seen('Dockerfile');}
  const kinds=[...(usesFramework.get(d)??[])].map(s=>s.split('|'));
  const kind=(kinds.find(k=>k[1]==='app')??kinds.find(k=>k[1]==='process')??kinds[0])?.[1] as ProjectNode['kind']|undefined;
  summary=kinds.length?`${[...new Set(kinds.map(k=>k[0]))].join(', ')} (${[...new Set(kinds.map(k=>k[2]))].slice(0,4).join(', ')})`:summary;
  item(key,{label,kind:kind??inferKind(label),provider:'Generic',layer:'container',summary:`${summary} · ${found.join(', ')}`,confidence:'confirmed'},ev(found[0]==='package.json'?pkgPath:join(d,found[0]?.split(' ')[0]??''),1,`Manifest: ${found.join(', ')}`,'confirmed'));
 }

 // ---- docker-compose ----
 const services=new Map<string,string>();
 for(const [path,text] of files)if(/(^|\/)(docker-)?compose[\w.-]*\.ya?ml$/i.test(path)){
  let doc:Record<string,unknown>|undefined;try{doc=parseAllDocuments(text)[0]?.toJSON() as Record<string,unknown>;}catch{skip('YAML file(s) that could not be parsed');continue;}
  const svc=doc?.services as Record<string,Record<string,unknown>>|undefined;if(!svc||typeof svc!=='object')continue;seen('docker-compose file');
  for(const [sname,s] of Object.entries(svc)){
   if(!s||typeof s!=='object')continue;
   const at=lineOf(text,new RegExp(`^\\s+${sname.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*:`,'m'));
   const build=typeof s.build==='string'?s.build:typeof s.build==='object'&&s.build?(s.build as {context?:string}).context:undefined;
   const image=typeof s.image==='string'?s.image:'';
   let key:string;
   if(build!==undefined){const d=join(dirOf(path),build);if(!containerDirs.has(d)){containerDirs.add(d);item(containerKey(d),{label:sname,kind:inferKind(sname),provider:'Generic',layer:'container',summary:`Built from ${d||'.'}`,confidence:'confirmed'});}key=containerKey(d);}
   else{const tech=IMAGE_TECH.find(([re])=>re.test(image))?.[1];key=`svc:${sname}`;
    item(key,{label:tech?`${sname} (${TECHS[tech].label})`:sname,kind:tech?TECHS[tech].kind:inferKind(`${sname} ${image}`),provider:tech?TECHS[tech].provider:'Generic',layer:'container',summary:`Container image ${image||'(none)'}`,tech,confidence:'confirmed'});
    if(tech&&!techTargets.has(tech))techTargets.set(tech,key);}
   item(key,{label:sname,kind:'process',provider:'Generic',layer:'container',summary:''},ev(path,at,`compose service “${sname}”${image?` (image ${image})`:''}${s.ports?` ports ${JSON.stringify(s.ports).slice(0,60)}`:''}`,'confirmed'));
   services.set(sname,key);
  }
  for(const [sname,s] of Object.entries(svc)){
   if(!s||typeof s!=='object')continue;const from=services.get(sname)!;
   const deps=Array.isArray(s.depends_on)?s.depends_on:s.depends_on&&typeof s.depends_on==='object'?Object.keys(s.depends_on):[];
   for(const dep of deps as string[]){const to=services.get(dep);if(to)link(from,to,'depends on','container',ev(path,lineOf(text,new RegExp(`^\\s+-?\\s*${dep}\\b`,'m'),text.indexOf(`${sname}:`)),`${sname} depends_on ${dep}`,'confirmed'),'query');}
   // Host names in environment values are read only to find links; values never enter the document.
   const env=Array.isArray(s.environment)?(s.environment as string[]).map(x=>String(x).split('=').slice(1).join('=')):s.environment&&typeof s.environment==='object'?Object.values(s.environment as object).map(String):[];
   for(const value of env)for(const [other,to] of services)if(other!==sname&&new RegExp(`(^|[/@:=,\\s])${other.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(:\\d+|/|$)`).test(value))link(from,to,'connects to','container',ev(path,lineOf(text,`${sname}:`),`${sname} environment names host “${other}”`,'inferred'),'query');
  }
 }

 // ---- Kubernetes manifests ----
 const workloads=new Map<string,{key:string;labels:Record<string,string>}>(),k8sServices=new Map<string,string>(),ingresses:[string,number,string,string][]=[];
 const pendingK8sEnv:[string,string,string,number,string][]=[],pendingServices:[string,Record<string,string>,string,number][]=[];
 for(const [path,text] of files)if(/\.ya?ml$/i.test(path)&&/^\s*apiVersion:/m.test(text)&&/^\s*kind:/m.test(text)){
  let docs:Record<string,unknown>[];try{docs=parseAllDocuments(text).map(d=>d.toJSON() as Record<string,unknown>).filter(Boolean);}catch{skip('YAML file(s) that could not be parsed');continue;}
  for(const doc of docs){
   const kind=String(doc.kind??''),meta=(doc.metadata??{}) as {name?:string},spec=(doc.spec??{}) as Record<string,unknown>,nm=meta.name??'';if(!nm)continue;
   const at=lineOf(text,new RegExp(`name:\\s*["']?${nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["']?\\s*$`,'m'));
   if(/^(Deployment|StatefulSet|DaemonSet|CronJob|Job)$/.test(kind)){
    seen('Kubernetes workload');
    const tpl=(kind==='CronJob'?((spec.jobTemplate as Record<string,unknown>)?.spec as Record<string,unknown>)?.template:spec.template) as {metadata?:{labels?:Record<string,string>};spec?:{containers?:{image?:string;env?:{name:string;value?:string}[]}[]}}|undefined;
    const images=(tpl?.spec?.containers??[]).map(c=>c.image??'');
    const imageName=baseOf((images[0]??'').split(':')[0]??'');
    const match=[...items.values()].find(i=>i.layer==='container'&&(i.label===nm||i.label===imageName||services.get(nm)===i.key));
    const tech=IMAGE_TECH.find(([re])=>images.some(im=>re.test(im)))?.[1];
    const key=match?.key??`k8s:${nm}`;
    item(key,{label:tech?`${nm} (${TECHS[tech].label})`:nm,kind:tech?TECHS[tech].kind:inferKind(nm),provider:'Kubernetes',layer:'container',summary:`Kubernetes ${kind}${images.length?` · ${images.join(', ').slice(0,120)}`:''}`,tech,confidence:'confirmed'},ev(path,at,`Kubernetes ${kind} “${nm}”${images[0]?` runs ${images[0]}`:''}`,'confirmed'));
    if(tech&&!techTargets.has(tech))techTargets.set(tech,key);
    workloads.set(nm,{key,labels:tpl?.metadata?.labels??{}});
    for(const c of tpl?.spec?.containers??[])for(const e of c.env??[])if(e.value)pendingK8sEnv.push([key,e.value,path,lineOf(text,`name: ${e.name}`),e.name]);
   }else if(kind==='Service'){const sel=(spec.selector??{}) as Record<string,string>;pendingServices.push([nm,sel,path,at]);}
   else if(kind==='Ingress'){seen('Kubernetes ingress');const rules=(spec.rules??[]) as {host?:string;http?:{paths?:{backend?:{service?:{name?:string};serviceName?:string}}[]}}[];
    for(const r of rules)for(const p of r.http?.paths??[]){const svcName=p.backend?.service?.name??p.backend?.serviceName;if(svcName)ingresses.push([path,at,`${nm}${r.host?` (${r.host})`:''}`,svcName]);}}
  }
 }
 for(const [nm,sel,path,at] of pendingServices){const w=[...workloads.values()].find(w=>Object.entries(sel).length>0&&Object.entries(sel).every(([k,v])=>w.labels[k]===v))??workloads.get(nm);if(w){k8sServices.set(nm,w.key);items.get(w.key)!.evidence.push(ev(path,at,`Kubernetes Service “${nm}” selects this workload`,'confirmed'));}}
 for(const [path,at,label,svcName] of ingresses){const to=k8sServices.get(svcName)??workloads.get(svcName)?.key;if(!to)continue;const key=`ing:${label}`;item(key,{label:`Ingress ${label}`,kind:'control',provider:'Kubernetes',layer:'container',summary:'Kubernetes Ingress',confidence:'confirmed'},ev(path,at,`Ingress ${label}`,'confirmed'));link(key,to,'routes to','container',ev(path,at,`Ingress ${label} → service ${svcName}`,'confirmed'),'query');}
 for(const [from,value,path,line,envName] of pendingK8sEnv)for(const [svcName,to] of k8sServices)if(to!==from&&new RegExp(`(^|[/@])${svcName}(\\.|:|/|$)`).test(value))link(from,to,'connects to','container',ev(path,line,`env ${envName} names service “${svcName}”`,'inferred'),'query');

 // ---- Terraform ----
 const resources=new Map<string,{key:string;body:string;path:string;line:number}>();
 for(const [path,text] of files)if(/\.tf$/.test(path)){
  const re=/^\s*(resource|module)\s+"([^"]+)"(?:\s+"([^"]+)")?\s*\{/gm;let m:RegExpExecArray|null;
  while((m=re.exec(text))){
   let depth=0,i=text.indexOf('{',m.index),end=i;for(;end<text.length;end++){if(text[end]==='{')depth++;else if(text[end]==='}'){depth--;if(depth===0)break;}}
   const body=text.slice(i,end),isModule=m[1]==='module',type=isModule?'module':m[2],nm=isModule?m[2]:m[3]??'';
   const provider=isModule?'Generic':TERRAFORM_PROVIDER.find(([r])=>r.test(type))?.[1]??'Generic';
   const key=`tf:${type}.${nm}`,line=lineAt(text,m.index);
   const source=isModule?body.match(/source\s*=\s*"([^"]+)"/)?.[1]:undefined;
   item(key,{label:isModule?`module ${nm}`:`${nm} (${type.replace(/^(aws|azurerm|google|azuread|kubernetes|databricks|snowflake)_/,'').replace(/_/g,' ')})`,kind:isModule?'process':terraformKind(type),provider,layer:'resource',summary:isModule?`Terraform module${source?` from ${source}`:''}`:`Terraform ${type}`,confidence:'confirmed'},ev(path,line,`${m[1]} "${type}"${nm&&!isModule?` "${nm}"`:''}`,'confirmed'));
   resources.set(isModule?`module.${nm}`:`${type}.${nm}`,{key,body,path,line});seen('Terraform resource or module');
  }
 }
 for(const [,r] of resources)for(const [ref,other] of resources)if(other!==r&&new RegExp(`(^|[^\\w.])${ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\.`).test(r.body)){
  const file=files.get(r.path)!,at=lineOf(file,ref+'.',file.indexOf(r.body));link(r.key,other.key,'references','resource',ev(r.path,at,`${ref} referenced`,'confirmed'),'dependency');
 }

 // ---- GitHub Actions ----
 const ciKey='ci:github-actions';
 for(const [path,text] of files)if(/^\.github\/workflows\/[^/]+\.ya?ml$/.test(path)){
  seen('GitHub Actions workflow');
  item(ciKey,{label:'GitHub Actions',kind:'control',provider:'Generic',layer:'ci',summary:'Continuous integration and delivery workflows',confidence:'confirmed'},ev(path,1,`workflow ${baseOf(path)}`,'confirmed'));
  text.split('\n').forEach((l,i)=>{
   const uses=l.match(/^\s*-?\s*uses:\s*["']?([^@\s"']+)/);
   const target=uses?DEPLOY_ACTIONS.find(([re])=>re.test(uses[1])):undefined;
   const run=l.match(/(terraform apply|kubectl apply|helm upgrade|docker push|npm publish|vercel (?:deploy|--prod)|az webapp deploy|az containerapp|gcloud run deploy|firebase deploy|wrangler (?:deploy|publish)|vsce publish)/i)?.[1];
   const name=target?.[1]??(run?{['terraform apply']:'Terraform apply',['kubectl apply']:'Kubernetes cluster',['helm upgrade']:'Kubernetes cluster',['docker push']:'Container registry',['npm publish']:'npm registry',['vsce publish']:'VS Code Marketplace'}[run.toLowerCase()]??(/vercel/i.test(run)?'Vercel':/az /i.test(run)?'Azure':/gcloud|firebase/i.test(run)?'Google Cloud':/wrangler/i.test(run)?'Cloudflare':'Deployment target'):undefined);
   if(!name)return;
   const key=`deploy:${name.toLowerCase()}`;
   item(key,{label:name,kind:/registry|marketplace/i.test(name)?'storage':'app',provider:target?.[2]??(['Azure','AWS','Google Cloud'].includes(name)?name:'Generic'),layer:'external',summary:'Deployment or publication target named in CI',confidence:'confirmed'},ev(path,i+1,uses?`uses ${uses[1]}`:`runs ${run}`,'confirmed'));
   link(ciKey,key,'deploys to','ci',ev(path,i+1,uses?`uses ${uses[1]}`:`runs ${run}`,'confirmed'),'control');
  });
 }

 // ---- Example env files: key names only ----
 const ENV_TECH:[RegExp,TechKey][]=[[/^(DATABASE_URL|POSTGRES|PG(HOST|USER|DATABASE)|DB_HOST)/,'postgresql'],[/^MYSQL/,'mysql'],[/^MONGO/,'mongodb'],[/^REDIS/,'redis'],[/^STRIPE/,'stripe'],[/^OPENAI/,'openai'],[/^ANTHROPIC/,'anthropic'],[/^SENTRY/,'sentry'],[/^KAFKA/,'kafka'],[/^(AZURE_STORAGE|AZURITE)/,'azureblob'],[/^(S3_|AWS_S3)/,'s3'],[/^SENDGRID/,'sendgrid'],[/^TWILIO/,'twilio'],[/^AUTH0/,'auth0'],[/^(RABBIT|AMQP)/,'rabbitmq']];
 for(const [path,text] of files)if(/(^|\/)\.env\.(example|sample|template|dist)$/.test(path)){
  seen('example env file');const owner=ownerOf(path);const from=owner!==undefined?containerKey(owner):systemKey;
  text.split('\n').forEach((l,i)=>{const k=l.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/)?.[1];if(!k)return;
   // The value is read only for a URL scheme (postgres://, mongodb://…); it never enters the document.
   const scheme=l.split('=').slice(1).join('=').trim().match(/^["']?([a-z][a-z0-9+]*):\/\//i)?.[1]?.toLowerCase();
   const tech=scheme?({postgres:'postgresql',postgresql:'postgresql',mysql:'mysql',mongodb:'mongodb','mongodb+srv':'mongodb',redis:'redis',rediss:'redis',amqp:'rabbitmq',amqps:'rabbitmq'} as Record<string,TechKey>)[scheme]:undefined;
   const t=tech??ENV_TECH.find(([re])=>re.test(k))?.[1];if(t)linkTech(from,t,ev(path,i+1,`${k} in ${baseOf(path)}`,'possible'),'configured');});
 }

 // ---- Data: SQL, dbt and Prisma ----
 const tableKey=(n:string)=>`t:${n.replace(/["`[\]]/g,'').toLowerCase()}`;
 const table=(n:string,file:string,line:number,what:string,confidence:Confidence='confirmed',kind:ProjectNode['kind']='table')=>{const clean=n.replace(/["`[\]]/g,'');return item(tableKey(clean),{label:clean,kind,provider:'Generic',layer:'table',summary:what,confidence},ev(file,line,what,confidence)).key;};
 const IDENT=String.raw`((?:["\`\[]?[A-Za-z_][\w$]*["\`\]]?\.){0,2}["\`\[]?[A-Za-z_][\w$]*["\`\]]?)`;
 const dbtRoots=[...files.keys()].filter(p=>/(^|\/)dbt_project\.ya?ml$/.test(p)).map(dirOf);
 for(const [path,text] of files)if(/\.sql$/i.test(path)){
  const dbtRoot=dbtRoots.find(r=>path.startsWith(r?`${r}/`:'')&&/\/models\/|^models\//.test(path.slice(r?r.length+1:0)));
  if(dbtRoot!==undefined){
   const model=baseOf(path).replace(/\.sql$/i,''),to=table(model,path,1,'dbt model','confirmed');seen('dbt model');
   for(const m of text.matchAll(/\{\{\s*ref\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g))link(table(m[1],path,lineAt(text,m.index!),'dbt model (referenced)','inferred'),to,'ref','data',ev(path,lineAt(text,m.index!),`ref('${m[1]}')`,'confirmed'));
   for(const m of text.matchAll(/\{\{\s*source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g))link(table(`${m[1]}.${m[2]}`,path,lineAt(text,m.index!),'dbt source','confirmed','source'),to,'source','data',ev(path,lineAt(text,m.index!),`source('${m[1]}', '${m[2]}')`,'confirmed'));
   continue;
  }
  const clean=text.replace(/--[^\n]*/g,m=>' '.repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' '));
  let offset=0;
  for(const stmt of clean.split(';')){
   const at=offset;offset+=stmt.length+1;
   const create=stmt.match(new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|global|local|transient|secure)\s+)*(table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?${IDENT}`,'i'));
   const insert=stmt.match(new RegExp(String.raw`\b(?:insert\s+(?:into|overwrite)(?:\s+table)?|merge\s+into)\s+${IDENT}`,'i'));
   const target=create?.[2]??insert?.[1];if(!target)continue;
   const line=lineAt(text,at+(create?.index??insert?.index??0)+(stmt.slice(0,create?.index??insert?.index??0).match(/^\s*/)?.[0].length??0));
   const to=table(target,path,line,create?`SQL ${create[1].toLowerCase()}`:'SQL load target');seen(create?'SQL table or view':'SQL load statement');
   const bodyStart=create?create.index!+create[0].length:insert!.index!+insert![0].length,body=stmt.slice(bodyStart);
   const ctes=new Set([...body.matchAll(/(?:\bwith|,)\s*([A-Za-z_]\w*)\s+as\s*\(/gi)].map(m=>m[1].toLowerCase()));
   if(create&&/\bas\b[\s(]*(?:with|select)\b/i.test(body)||insert)for(const m of body.matchAll(new RegExp(String.raw`\b(?:from|join)\s+${IDENT}`,'gi'))){
    const src=m[1];if(ctes.has(src.toLowerCase())||/^(select|lateral|unnest|generate_series|values)$/i.test(src))continue;
    link(table(src,path,lineAt(text,at+bodyStart+m.index!),'referenced by a SQL statement','inferred'),to,create?'feeds':'loads','data',ev(path,line,`${src} → ${target}`,'confirmed'));
   }
   for(const m of body.matchAll(new RegExp(String.raw`\breferences\s+${IDENT}`,'gi')))link(to,table(m[1],path,line,'referenced by a foreign key','inferred'),'foreign key','data',ev(path,line,`${target} references ${m[1]}`,'confirmed'),'query');
  }
 }
 for(const [path,text] of files)if(/(^|\/)schema\.prisma$/.test(path)){
  seen('Prisma schema');
  const provider=text.match(/datasource\s+\w+\s*\{[^}]*provider\s*=\s*"([^"]+)"/)?.[1];
  const tech=({postgresql:'postgresql',mysql:'mysql',sqlserver:'sqlserver',sqlite:'sqlite',mongodb:'mongodb',cockroachdb:'postgresql'} as Record<string,TechKey>)[provider??''];
  const owner=ownerOf(path);if(tech)linkTech(owner!==undefined?containerKey(owner):systemKey,tech,ev(path,lineOf(text,'provider'),`Prisma datasource ${provider}`,'confirmed'),'stores data in');
  const models=[...text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  for(const m of models)table(m[1],path,lineAt(text,m.index!),'Prisma model');
  for(const m of models){const body=m[2];for(const f of body.matchAll(/^\s*\w+\s+(\w+)(\[\])?\??\s+@relation/gm))if(models.some(x=>x[1]===f[1]))link(tableKey(m[1]),tableKey(f[1]),'relation','data',ev(path,lineAt(text,m.index!+m[0].indexOf(f[0])),`${m[1]} @relation → ${f[1]}`,'confirmed'),'query');}
 }

 // ---- Imports: components inside each code container ----
 const sources=[...files.keys()].filter(p=>SOURCE.test(p)&&!/(^|\/)(tests?|__tests__|e2e|spec|fixtures|mocks?)\//i.test(p)&&!/\.(test|spec|d)\.[a-z]+$/.test(p));
 const byContainer=new Map<string,string[]>();
 for(const p of sources){const d=ownerOf(p);if(d===undefined)continue;(byContainer.get(d)??byContainer.set(d,[]).get(d)!).push(p);}
 const sourceSet=new Set(sources);
 for(const [d,list] of byContainer){
  // The module root: src/ (or app/, lib/) when present, then down through single wrapper folders such as src/app/.
  let root=['src','app','lib'].map(r=>join(d,r)).find(r=>list.some(p=>p.startsWith(`${r}/`)))??d;
  for(let k=0;k<2;k++){const direct=list.some(p=>dirOf(p)===root),subs=new Set(list.filter(p=>root===''||p.startsWith(`${root}/`)).map(p=>p.slice(root?root.length+1:0).split('/')).filter(s=>s.length>1).map(s=>s[0]));if(direct||subs.size!==1)break;root=join(root,[...subs][0]);}
  const moduleOf=(p:string)=>{if(root&&!p.startsWith(`${root}/`)&&p!==root)return undefined;const rest=p.slice(root?root.length+1:0).split('/');return rest.length>1?rest[0]:'(entry)';};
  const counts=new Map<string,number>();for(const p of list){const m=moduleOf(p);if(m)counts.set(m,(counts.get(m)??0)+1);}
  if(counts.size<2)continue;
  const top=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,24).map(([m])=>m),kept=new Set(top);
  const container=containerKey(d),mkey=(m:string)=>`m:${d||'.'}:${kept.has(m)?m:'(other)'}`;
  for(const [m,n] of counts){const k=mkey(m),label=kept.has(m)?(m==='(entry)'?`${items.get(container)?.label??'app'} entry`:m):'other modules';
   const it=item(k,{label,kind:m==='(entry)'?'app':inferKind(m),provider:'Generic',layer:'component',parent:container,summary:'',confidence:'confirmed',files:0},ev(join(root,m==='(entry)'?'':m)||'.',1,`${n} source file(s)`,'confirmed'));it.files=(it.files??0)+n;it.summary=`${it.files} source file(s) in ${join(root,m==='(entry)'?'':m)||'.'}`;}
  seen('code module',counts.size);
  // Files: the finest level, one view per module, linked by the imports between files of the same module.
  for(const p of list){const m=moduleOf(p);if(!m||!kept.has(m)||baseOf(p)==='__init__.py')continue;const text=files.get(p)!;
   item(`f:${p}`,{label:baseOf(p),kind:inferKind(baseOf(p).replace(/\.[a-z]+$/,'')),provider:'Generic',layer:'file',parent:mkey(m),summary:`${p} · ${text.split('\n').length} lines`,confidence:'confirmed'},ev(p,1,'source file','confirmed'));}
  const resolveRel=(from:string,spec:string)=>{const base=join(dirOf(from),spec);for(const c of [base,...['.ts','.tsx','.js','.jsx','.mjs','.py'].map(e=>base+e),...['index.ts','index.tsx','index.js','__init__.py'].map(i=>join(base,i))])if(sourceSet.has(c))return c;return base;};
  for(const p of list){
   const text=files.get(p)!,from=moduleOf(p);if(!from)continue;
   const specs:[string,number][]=[];
   // `from . import a, b` imports the sibling modules a and b; `from .x import y` imports module x.
   if(p.endsWith('.py')){for(const m of text.matchAll(/^\s*(?:from\s+(\.*[\w.]*)\s+import\s+\(?([\w\s,*]+)|import\s+([\w.]+))/gm)){const line=lineAt(text,m.index!);
    if(m[1]&&/^\.+$/.test(m[1]))for(const nm of m[2].split(',').map(x=>x.trim().split(/\s+/)[0]).filter(x=>x&&x!=='*'))specs.push([`${m[1]}${nm}`,line]);else specs.push([m[1]??m[3],line]);}}
   else for(const m of text.matchAll(/(?:\bimport\s[^'";]*?\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bexport\s[^'";]*?\bfrom\s*|\bimport\s+)['"]([^'"\n]+)['"]/g))specs.push([m[1],lineAt(text,m.index!)]);
   for(const [spec,line] of specs){
    let target:string|undefined;
    if(p.endsWith('.py')){
     if(spec.startsWith('.')){const ups=spec.match(/^\.+/)![0].length;let base=dirOf(p);for(let k=1;k<ups;k++)base=dirOf(base);target=resolveRel(`${base}/x`,spec.slice(ups).replace(/\./g,'/')||'.');}
     else{const path=spec.replace(/\./g,'/');for(const c of [join(d,path),join(root,path),join(dirOf(root),path)]){if(sourceSet.has(`${c}.py`)){target=`${c}.py`;break;}if(list.some(x=>x.startsWith(`${c}/`))){target=`${c}/__init__.py`;break;}}}
    }else if(spec.startsWith('.'))target=resolveRel(p,spec);
    else if(/^[@~#]\//.test(spec))target=resolveRel(`${root}/x`,spec.slice(2));
    if(target){
     const owner=ownerOf(target);
     if(owner===d){const to=moduleOf(target);if(to&&to!==from)link(mkey(from),mkey(to),'imports','component',ev(p,line,`import ${spec}`,'confirmed'));
      else if(to&&sourceSet.has(target)&&target!==p&&baseOf(target)!=='__init__.py')link(`f:${p}`,`f:${target}`,'imports','file',ev(p,line,`import ${spec}`,'confirmed'));}
     else if(owner!==undefined)link(container,containerKey(owner),'imports','container',ev(p,line,`import ${spec}`,'confirmed'));
     continue;
    }
    const pkgName=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0].split('.')[0];
    const ws=packageNames.get(pkgName);if(ws!==undefined&&ws!==d){link(container,containerKey(ws),'imports','container',ev(p,line,`import ${spec}`,'confirmed'));continue;}
    const tech=techOfPackage(pkgName)??techOfPackage(spec);
    if(tech){linkTech(mkey(from),tech,ev(p,line,`import ${spec}`,'confirmed'),'imports');linkTech(container,tech,ev(p,line,`import ${spec}`,'confirmed'),`uses (${pkgName})`);}
   }
  }
 }

 // Resolve technology links last, so a compose or Kubernetes service running that technology is preferred over an external node.
 for(const [from,tech,e,label] of pendingTech){const to=techNode(tech);const layer=items.get(from)?.layer==='component'?'component':'container';link(from,to,label,layer,e,TECHS[tech].kind==='storage'?'query':'batch');}
 for(const it of items.values())if(it.layer==='external'&&it.tech){const inbound=[...links.values()].filter(l=>l.to===it.key);if(inbound.length)it.confidence=inbound.map(l=>l.confidence).reduce(best);}
 return {name,branch,commit,items,links:[...links.values()],detectors,skipped};
}
