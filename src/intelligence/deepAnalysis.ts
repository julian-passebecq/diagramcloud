/** Actual Tree-sitter syntax analysis. Compiler binding, runtime dispatch, execution
 * and network access are outside this pure selected-file seam. */
import type {Language,Parser,Node} from 'web-tree-sitter';
import type {ScanFile} from '../core/scan/scanner';
import {IGNORED_DIR,SECRET_FILE,outsideNestedRepositories} from '../core/scan/scanner';
import {secretInText} from '../core/secrets';
import {validateAnalysisProfile,validateAnalysisBundle,sha256,type AnalysisProfile,type AnalysisBundle} from './profile';
export type DeepLanguage='typescript'|'tsx'|'javascript'|'python'|'c-sharp';
export type DeepRuntime={createParser:()=>Parser;language:(language:DeepLanguage)=>Promise<Language>};
export const DEEP_PARSER_VERSION='diagramcloud-tree-sitter/1;runtime0.25.10;grammars-vscode0.3.1';
const languageOf=(path:string):DeepLanguage|undefined=>/\.tsx$/i.test(path)?'tsx':/\.ts$/i.test(path)?'typescript':/\.(?:js|mjs|cjs|jsx)$/i.test(path)?'javascript':/\.py$/i.test(path)?'python':/\.cs$/i.test(path)?'c-sharp':undefined;
const declarations=new Set(['function_declaration','generator_function_declaration','function_definition','class_declaration','class_definition','method_definition','method_declaration','constructor_declaration','interface_declaration','struct_declaration','enum_declaration']);
const imports=new Set(['import_statement','import_from_statement','using_directive']);
const calls=new Set(['call_expression','call','invocation_expression','object_creation_expression']);
function hash(s:string){let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return(n>>>0).toString(36);}
const stable=(prefix:string,key:string)=>prefix+'-'+hash(key)+'-'+hash(key.split('').reverse().join(''));
const abort=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Deep analysis cancelled','AbortError');};
const yieldTurn=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function safePath(path:string){return !!path&&path.length<=500&&!/^(?:\/|[a-z]:)/i.test(path)&&!/[\\\u0000-\u001f]/.test(path)&&!path.split('/').some(s=>!s||s==='.'||s==='..')&&!SECRET_FILE.test(path)&&!IGNORED_DIR.test(path)&&!secretInText(path);}
function relativeTargets(file:string,reference:string,language:DeepLanguage):string[]{
 if(!reference.startsWith('.')||reference.includes('\0')||/^[a-z]+:/i.test(reference))return [];
 const parent=file.split('/').slice(0,-1),raw=language==='python'?reference.replace(/^(\.+)(.*)$/,(_,dots:string,rest:string)=>'../'.repeat(Math.max(0,dots.length-1))+'./'+rest.replace(/\./g,'/')):reference;
 for(const segment of raw.split('/')){if(!segment||segment==='.')continue;if(segment==='..'){if(!parent.length)return [];parent.pop();}else parent.push(segment);}
 const path=parent.join('/');return language==='python'?[path+'.py',path+'/__init__.py']:[path,path+'.ts',path+'.tsx',path+'.js',path+'.jsx',path+'.mjs',path+'/index.ts',path+'/index.tsx',path+'/index.js'];
}
type SymbolRecord={id:string;name:string;sourceId:string;start:number;end:number;depth:number;file:string};
/** Shared acquisition identity for worker analysis and its generated cache. Only
 * admitted selected bytes enter the revision vector; no source is fetched. */
export async function prepareDeepSelection(input:ScanFile[],profileInput:AnalysisProfile,options:{repositoryId:string;revision:string;signal?:AbortSignal}){
 const profile=validateAnalysisProfile(profileInput);if(!['deep','custom'].includes(profile.depth)||!profile.analyzers.includes('tree-sitter'))throw new Error('Tree-sitter requires an explicitly selected deep/custom profile');
 if(profile.repositoryIds.length&&!profile.repositoryIds.includes(options.repositoryId))throw new Error('Selected repository is outside the explicit deep profile scope');
 if(!/^[a-z][a-z0-9_.-]{0,79}$/.test(options.repositoryId)||!options.revision||options.revision.length>120||secretInText(options.revision))throw new Error('Invalid explicit repository identity/revision');
 let omittedSources=0;
 const outside=new Set(outsideNestedRepositories(input).map(f=>f.path)),seen=new Set<string>(),files:ScanFile[]=[];let bytes=0;
 for(const f of [...input].sort((a,b)=>a.path.localeCompare(b.path))){abort(options.signal);
  if(seen.has(f.path))throw new Error('Duplicate selected deep source paths');seen.add(f.path);
  const size=new TextEncoder().encode(f.text).byteLength,selected=!profile.scope.length||profile.scope.some(s=>f.path===s||f.path.startsWith(s.replace(/\/$/,'')+'/'));
  if(!selected||!outside.has(f.path)||!safePath(f.path)||!languageOf(f.path)||secretInText(f.text)){omittedSources++;continue;}
  if(files.length>=profile.budgets.files||size>profile.budgets.fileBytes||bytes+size>profile.budgets.totalBytes){omittedSources++;continue;}bytes+=size;files.push({...f});
 }
 const digests=new Map<string,string>();for(const f of files){abort(options.signal);digests.set(f.path,await sha256(f.text));}
 const sourceDigest=await sha256(files.map(f=>f.path+'\0'+digests.get(f.path)).join('\n'));abort(options.signal);
 return {profile,files,digests,sourceDigest,omittedSources};
}
export async function deepAnalyze(input:ScanFile[],profileInput:AnalysisProfile,runtime:DeepRuntime,options:{repositoryId:string;revision:string;signal?:AbortSignal;onProgress?:(p:{read:number;total:number;path:string})=>void;parseMicros?:number}):Promise<AnalysisBundle>{
 const timeout=options.parseMicros??250000;if(!Number.isSafeInteger(timeout)||timeout<1||timeout>1000000)throw new Error('Deep parse budget must be 1–1,000,000 microseconds per file');
 const {profile,files,digests,sourceDigest,omittedSources}=await prepareDeepSelection(input,profileInput,options);
 const diagnostics:string[]=[],sources:AnalysisBundle['sources']=[],items:AnalysisBundle['items']=[],links:AnalysisBundle['links']=[],sourceIds=new Set<string>(),itemIds=new Set<string>(),linkIds=new Set<string>(),omitted={items:0,links:0,sources:omittedSources};
 const diag=(s:string)=>{if(diagnostics.length<2000)diagnostics.push(s.slice(0,1000));};
 if(omitted.sources)diag(omitted.sources+' selected files omitted by scope, syntax support, nested/secret safety or file/byte budgets; absence is not removal.');
 const fileIds=new Map<string,string>(),fileSources=new Map<string,string>(),symbols:SymbolRecord[]=[],callSites:{id:string;name:string;file:string;sourceId:string;owner?:SymbolRecord}[]=[],pendingImports:{id:string;file:string;reference:string;language:DeepLanguage;sourceId:string}[]=[];
 const source=(f:ScanFile,n?:Node)=>{const line=(n?.startPosition.row??0)+1,endLine=(n?.endPosition.row??0)+1,id=stable('deep-src',options.repositoryId+':'+f.path+':'+line+':'+endLine+':'+(n?.type??'file')+':'+(n?.startPosition.column??0));
  if(!sourceIds.has(id)){if(sources.length>=20000){omitted.sources++;return null;}sourceIds.add(id);sources.push({id,path:f.path,repositoryId:options.repositoryId,revision:options.revision,line,endLine,contentDigest:digests.get(f.path)!});}return id;};
 const add=(item:AnalysisBundle['items'][number])=>{if(items.length>=profile.budgets.nodes){omitted.items++;return false;}if(itemIds.has(item.id)){diag('Conflicting syntax identity '+item.id+'; duplicate declaration omitted.');omitted.items++;return false;}itemIds.add(item.id);items.push({...item,label:item.label.slice(0,160)});return true;};
 const edge=(from:string,to:string,kind:string,sources:string[],confidence:'confirmed'|'inferred'|'possible'='confirmed')=>{if(links.length>=profile.budgets.links){omitted.links++;return;}if(!itemIds.has(from)||!itemIds.has(to))return;const id=stable('deep-link',from+'>'+to+'>'+kind);if(!linkIds.has(id)){linkIds.add(id);links.push({id,from,to,kind,sourceIds:sources,confidence});}};
 for(const f of files){const sourceId=source(f);if(!sourceId)continue;const id=stable('deep-file',options.repositoryId+':'+f.path);if(add({id,label:f.path.slice(0,160),kind:'source-file',sourceIds:[sourceId],confidence:'confirmed'})){fileIds.set(f.path,id);fileSources.set(f.path,sourceId);}}
 let walked=0;const parser=runtime.createParser();
 try{for(const [index,f] of files.entries()){await yieldTurn();abort(options.signal);const language=languageOf(f.path)!;parser.setLanguage(await runtime.language(language));abort(options.signal);parser.reset();
   const started=performance.now(),tree=parser.parse(f.text,null,{progressCallback:()=>options.signal?.aborted===true||(performance.now()-started)*1000>timeout});if(!tree){abort(options.signal);diag(f.path+': parse timeout/cancellation; no syntax declarations established.');options.onProgress?.({read:index+1,total:files.length,path:f.path});continue;}
   try{if(tree.rootNode.hasError)diag(f.path+': syntax errors present; malformed subtrees omitted and remaining declarations are partial syntax evidence.');
    const stack:{node:Node;owner?:SymbolRecord;depth:number}[]=[{node:tree.rootNode,depth:0}];let fileWalked=0;
    while(stack.length){const current=stack.pop()!,n=current.node;let owner=current.owner;fileWalked++;walked++;
     if(fileWalked>100000||walked>500000){diag(f.path+': syntax traversal budget reached; remaining subtrees omitted.');omitted.items+=stack.length+1;break;}if(fileWalked%1000===0)abort(options.signal);
     if(n.isError||n.isMissing||['comment','string','string_literal','string_content','template_string'].includes(n.type))continue;
     const variable=n.type==='variable_declarator'&&n.childForFieldName('value')&&['arrow_function','function_expression'].includes(n.childForFieldName('value')!.type);
     if(declarations.has(n.type)||variable){const name=n.childForFieldName('name')?.text;if(name){const parentName=owner?.name??'',kind=/class|struct|interface|enum/.test(n.type)?'type-declaration':'function-declaration',identity=options.repositoryId+':'+f.path+'>'+parentName+'>'+n.type+'>'+name,id=stable('deep-symbol',identity),sourceId=source(f,n);
       if(sourceId&&add({id,label:(parentName?parentName+'.':'')+name,kind,sourceIds:[sourceId],confidence:'confirmed'})){edge(owner?.id??fileIds.get(f.path)!,id,'declares-symbol',[sourceId]);owner={id,name:parentName?parentName+'.'+name:name,sourceId,start:n.startIndex,end:n.endIndex,depth:current.depth,file:f.path};symbols.push(owner);}
      }}
     if(imports.has(n.type)){const sourceId=source(f,n),id=stable('deep-import',options.repositoryId+':'+f.path+':'+n.text);if(sourceId&&add({id,label:n.text.replace(/\s+/g,' ').slice(0,160),kind:'import-declaration',sourceIds:[sourceId],confidence:'confirmed'})){
       edge(fileIds.get(f.path)!,id,'declares-import',[sourceId]);const raw=n.childForFieldName('source')??n.childForFieldName('module_name')??n.childForFieldName('name');let reference=raw?.text??'';
       if(language!=='python')reference=reference.replace(/^['"]|['"]$/g,'');if(reference)pendingImports.push({id,file:f.path,reference,language,sourceId});else diag(f.path+':'+(n.startPosition.row+1)+' import has no supported exact local module pointer.');
      }}
     if(calls.has(n.type)){const callee=n.childForFieldName('function')??n.childForFieldName('expression')??n.childForFieldName('type'),name=callee?.text??'',sourceId=source(f,n),id=stable('deep-call',options.repositoryId+':'+f.path+':'+(owner?.name??'top-level')+':'+name+':'+n.startPosition.row+':'+n.startPosition.column);
      if(sourceId&&name&&add({id,label:name+' (…) ',kind:'call-site-syntax',sourceIds:[sourceId],confidence:'confirmed'})){edge(owner?.id??fileIds.get(f.path)!,id,'contains-call-site',[sourceId]);callSites.push({id,name,file:f.path,sourceId,owner});}
     }
     for(const child of [...n.namedChildren].reverse())if(child)stack.push({node:child,owner,depth:current.depth+1});
    }
   }finally{tree.delete();}options.onProgress?.({read:index+1,total:files.length,path:f.path});
  }}finally{parser.delete();}
 const symbolsByName=new Map<string,SymbolRecord[]>();for(const symbol of symbols){const key=symbol.file+'\0'+symbol.name.split('.').at(-1);symbolsByName.set(key,[...(symbolsByName.get(key)||[]),symbol]);}
 for(const call of callSites){if(!profile.includeInferred)continue;
  // A compiler is needed to prove dispatch. Even an unambiguous selected local
  // name remains a possible link, explicitly separated from the call-site fact.
  if(!/^[A-Za-z_$][\w$]*$/.test(call.name))continue;const names=symbolsByName.get(call.file+'\0'+call.name)??[],matches=names.filter(s=>s.start<(call.owner?.start??-1));
  const topLevel=names.filter(s=>!s.name.includes('.')),resolved=matches.length===1?matches:topLevel;
  if(resolved.length===1)edge(call.id,resolved[0].id,'possible-local-call-target',[call.sourceId,resolved[0].sourceId],'possible');else if(resolved.length>1)diag(call.file+': ambiguous local call target '+call.name+'; unresolved.');
 }
 for(const reference of pendingImports){const possible=relativeTargets(reference.file,reference.reference,reference.language).filter(path=>fileIds.has(path));
  if(possible.length===1)edge(reference.id,fileIds.get(possible[0])!,'exact-selected-module-path',[reference.sourceId,fileSources.get(possible[0])!]);else diag(reference.file+': import '+reference.reference.slice(0,160)+' '+(possible.length?'is ambiguous in selected paths':'has no exact supported selected local path')+'; external/package/namespace imports are not fetched or guessed.');
 }
 diag('Tree-sitter syntax only: declaration/import/call-site facts are confirmed source syntax; possible local call-target links are not compiler bindings or runtime calls. No source code was executed.');
 return validateAnalysisBundle({format:'diagramcloud.analysis-bundle',version:1,parserVersion:DEEP_PARSER_VERSION,profile,revisions:[{repositoryId:options.repositoryId,revision:options.revision,contentDigest:sourceDigest}],sources,items,links,diagnostics,omitted});
}
