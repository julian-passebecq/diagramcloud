import {mapAuthorizedDocuments,wantedDocument} from './documents';
import {validateAnalysisProfile,validateAnalysisBundle,sha256,canonicalJson,type AnalysisProfile,type AnalysisBundle} from './profile';
import type {DocumentInput} from './types';
/** Selected text only. This rebuilds generated lexical analysis, never a persistent
 * author graph, observed state, file reader or agent execution environment. */
export async function buildDocumentAnalysisBundle(input:readonly DocumentInput[],revision:{repositoryId:string;revision:string},profileInput:AnalysisProfile):Promise<AnalysisBundle>{
 const profile=validateAnalysisProfile(profileInput);if(!profile.analyzers.includes('documents'))throw new Error('Document analyzer was not selected');if(profile.repositoryIds.length&&!profile.repositoryIds.includes(revision.repositoryId))throw new Error('Selected repository is outside the profile repository scope');
 const selected:DocumentInput[]=[];let bytes=0,omittedFiles=0;
 for(const f of [...input].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)){const size=new TextEncoder().encode(f.text).byteLength,inScope=!profile.scope.length||profile.scope.some(s=>f.path===s||f.path.startsWith(s.replace(/\/$/,'')+'/'));if(!inScope||!wantedDocument(f.path)||selected.length>=profile.budgets.files||size>profile.budgets.fileBytes||bytes+size>profile.budgets.totalBytes){omittedFiles++;continue;}selected.push(f);bytes+=size;}
 const map=mapAuthorizedDocuments(selected),fileDigests=new Map(await Promise.all(selected.map(async f=>[f.path,await sha256(f.text)] as const)));
 const vectorDigest=await sha256(canonicalJson([...fileDigests].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0))),items:AnalysisBundle['items']=[],links:AnalysisBundle['links']=[],sources:AnalysisBundle['sources']=[],sourceMap=new Map<string,string>(),fileNodes=new Map<string,string>();let omittedItems=0,omittedLinks=0;
 const stable=async(kind:string,path:string,selector:string)=>kind+'-'+(await sha256(canonicalJson([revision.repositoryId,path,selector]))).slice(0,32);
 const source=async(path:string,line:number,endLine=line)=>{const key=path+':'+line+':'+endLine;if(sourceMap.has(key))return sourceMap.get(key)!;const id=await stable('s',path,revision.revision+':'+line+':'+endLine+':'+fileDigests.get(path));sources.push({id,path,repositoryId:revision.repositoryId,revision:revision.revision,line,endLine,contentDigest:fileDigests.get(path)!});sourceMap.set(key,id);return id;};
 const item=async(path:string,selector:string,label:string,kind:string,line:number,endLine=line)=>{if(items.length>=profile.budgets.nodes){omittedItems++;return undefined;}const id=await stable('d',path,selector);items.push({id,label:label.slice(0,160),kind,confidence:'confirmed',sourceIds:[await source(path,line,endLine)]});return id;};
 const link=async(from:string|undefined,to:string|undefined,path:string,line:number,kind:string)=>{if(!from||!to||links.length>=profile.budgets.links){omittedLinks++;return;}const sourceId=await source(path,line),id=await stable('l',path,from+':'+to+':'+kind+':'+sourceId);if(!links.some(l=>l.id===id))links.push({id,from,to,kind,sourceIds:[sourceId],confidence:'confirmed'});};
 for(const d of map.documents){const root=await item(d.path,'document',d.path,'document',1);if(root)fileNodes.set(d.path,root);
  const headingCounts=new Map<string,number>();for(const h of d.headings){const count=headingCounts.get(h.title)??0;headingCounts.set(h.title,count+1);const next=await item(d.path,'heading:'+h.level+':'+h.title+':'+count,h.title,'section',h.line);await link(root,next,d.path,h.line,'contains-section');}
  for(const r of d.records){const next=await item(d.path,'record:'+r.id,r.id,'record',r.startLine,r.endLine);await link(root,next,d.path,r.startLine,'contains-record');}
 }
 for(const l of map.links)await link(fileNodes.get(l.fromPath),fileNodes.get(l.toPath),l.fromPath,l.fromLine,l.kind);
 const usedSources=new Set([...items,...links].flatMap(i=>i.sourceIds));
 return validateAnalysisBundle({format:'diagramcloud.analysis-bundle',version:1,parserVersion:'diagramcloud-document-bundle/1',profile,revisions:[{...revision,contentDigest:vectorDigest}],items,links,sources:sources.filter(s=>usedSources.has(s.id)),diagnostics:[...map.diagnostics.map(d=>d.path+':'+(d.line??'?')+' '+d.code+': '+d.message),...(omittedFiles?['Profile file/byte budget or safety metadata omitted '+omittedFiles+' selected inputs.']:[])],omitted:{items:omittedItems+map.omitted.documents,links:omittedLinks+map.omitted.links,sources:0}});
}
