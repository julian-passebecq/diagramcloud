import type {Project} from '../core/model';
import {inspectAcquisitionAnalysis} from './materialize';
import {validateAnalysisBundle,type AnalysisBundle} from './profile';
import {actionForGapCause,type GapCause} from './gapDetails';

/** Internal display projection only. No persisted/consumer format, authority or action port. */
export const SOURCE_BRIDGE_LIMITS={entries:24,revisions:12,diagnostics:8} as const;
export const SOURCE_BRIDGE_PATHS=[
 'Native Project schemaVersion 1 and native/DataPass schemaVersion 1 manifests: existing reviewed import paths.',
 'diagramcloud.analysis-bundle/1: private configured analysis; datapass.graph/1: existing private GraphSnapshot import.',
 'Modern v5 bridge/Hub coverage conversion is not qualified here. Global provider and MCP configuration remains with its owner.',
 'Live sidecar link, file permission and base-file hash are not supplied to this panel. No link absence or permission result is inferred.',
] as const;
export type SourceBridgeEntry={repositoryId:string|null;sourceId:string|null;path:string;line:number|null;endLine:number|null;admission:string;fileDigest:string|null;revision:string|null};
export type SourceBridgeDiagnostic={path:string;line:number|null;code:string;message:string;cause:GapCause|null;advice:string|null};
export type SourceBridgeDiagnosticPage={index:number;pages:number;total:number;start:number;end:number;remaining:number};
type AuthorStatus={
 visibility:'author';origin:'acquisition-receipt'|'configured-bundle'|'unavailable';scopeNote:string;retainedContext?:'absent'|'unreadable';
 producerVersion:null;sourceContract:null;consumerVersion:string|null;outputContract:string|null;captureTime:string|null;
 revisionMeaning:string;requested:{depth:string;analyzers:string[]|null}|null;
 admission:{selectedEntries:number;readFiles:number;readBytes:number;unsupported:number;ignored:number;limited:number}|null;
 outputs:{documents:number|null;items:number|null;relations:number|null;sourceRanges:number|null;diagnosticMessages:number}|null;
 revisions:{repositoryId:string|null;revision:string|null;aggregateDigest:string}[];entries:SourceBridgeEntry[];diagnostics:SourceBridgeDiagnostic[];diagnosticPage?:SourceBridgeDiagnosticPage;
 omitted:{entries:number;revisions:number;diagnostics:number;producer:Record<string,number>};
};
export type SourceBridgeStatus={visibility:'private-metadata-unavailable';note:string}|AuthorStatus;
export type SourceBridgeOptions={publicMode:boolean;repositoryId?:string;bundle?:unknown;diagnosticPage?:unknown};
const globalScope='Acquisition-wide metadata for this Project. It is not attributed to the displayed component, pinned selection or canonical Edit target.';
const repositoryScope='Acquisition-wide metadata for the explicitly supplied repository only. It is not per-component evidence or the canonical Edit target.';
function unavailable(scopeNote:string):AuthorStatus{return {visibility:'author',origin:'unavailable',scopeNote,producerVersion:null,sourceContract:null,consumerVersion:null,outputContract:null,captureTime:null,revisionMeaning:'UNKNOWN',requested:null,admission:null,outputs:null,revisions:[],entries:[],diagnostics:[],omitted:{entries:0,revisions:0,diagnostics:0,producer:{}}};}
function diagnostic(row:{path:string;line?:number;code:string;message:string;cause?:GapCause}):SourceBridgeDiagnostic{return {path:row.path,line:row.line??null,code:row.code,message:row.message,cause:row.cause??null,advice:row.cause?actionForGapCause(row.cause).label:null};}

/** One internal display page over retained validated rows, never a producer or acquisition budget. */
function diagnosticRows(rows:Parameters<typeof diagnostic>[0][],requested:unknown){
 const total=rows.length,pages=Math.ceil(total/SOURCE_BRIDGE_LIMITS.diagnostics),index=Math.min(typeof requested==='number'&&Number.isSafeInteger(requested)&&requested>=0?requested:0,Math.max(0,pages-1)),start=index*SOURCE_BRIDGE_LIMITS.diagnostics,end=Math.min(total,start+SOURCE_BRIDGE_LIMITS.diagnostics);
 return {diagnostics:rows.slice(start,end).map(diagnostic),omitted:total-(end-start),...(requested===undefined?{}:{diagnosticPage:{index,pages,total,start,end,remaining:total-end}})};
}

export function sourceBridgeStatus(project:Project,options:SourceBridgeOptions):SourceBridgeStatus{
 // Must precede ALL access to Project/private receipt/bundle/scope, including validation.
 if(options.publicMode)return {visibility:'private-metadata-unavailable',note:'Private source metadata unavailable in this projection. Public citations remain in their existing source lists; citation presence does not establish a file read.'};
 const repositoryId=options.repositoryId,scopeNote=repositoryId?repositoryScope:globalScope;
 // These are independent inputs, not an implicit cross-repository join. Current
 // surfaces pass exactly one; contradictory future callsites must fail closed.
 if(repositoryId!==undefined&&options.bundle!==undefined)return unavailable('Repository receipt scope and transient configured-result scope cannot be combined in this summary. Metadata unavailable; no cross-repository join was made.');
 if(options.bundle!==undefined){
  let bundle:AnalysisBundle;try{bundle=validateAnalysisBundle(options.bundle);}catch{return unavailable('Configured private metadata unavailable. This is not evidence of missing source implementation or a producer fault.');}
  const details=bundle.diagnosticDetails??[],page=diagnosticRows(details,options.diagnosticPage);
  return {...unavailable('Private transient configured result for its explicit revision vector. This is not attributed to the displayed component or a different repository.'),origin:'configured-bundle',consumerVersion:bundle.parserVersion,outputContract:bundle.format+'/'+bundle.version,
   revisionMeaning:'Supplied revision context, not verified Git HEAD, installed version, deployment or freshness.',requested:{depth:bundle.profile.depth,analyzers:[...bundle.profile.analyzers]},
   outputs:{documents:null,items:bundle.items.length,relations:bundle.links.length,sourceRanges:bundle.sources.length,diagnosticMessages:bundle.diagnostics.length},
   revisions:bundle.revisions.slice(0,SOURCE_BRIDGE_LIMITS.revisions).map(row=>({repositoryId:row.repositoryId,revision:row.revision,aggregateDigest:row.contentDigest})),
   entries:bundle.sources.slice(0,SOURCE_BRIDGE_LIMITS.entries).map(row=>({repositoryId:row.repositoryId,sourceId:row.id,path:row.path,line:row.line,endLine:row.endLine??null,admission:'Returned cited text range; file read admission not supplied',fileDigest:row.contentDigest,revision:row.revision})),
   diagnostics:page.diagnostics,...(page.diagnosticPage?{diagnosticPage:page.diagnosticPage}:{}),
   omitted:{entries:Math.max(0,bundle.sources.length-SOURCE_BRIDGE_LIMITS.entries),revisions:Math.max(0,bundle.revisions.length-SOURCE_BRIDGE_LIMITS.revisions),diagnostics:page.omitted,producer:{items:bundle.omitted.items,relations:bundle.omitted.links,sources:bundle.omitted.sources}},
  };
 }
 // An explicit repository receipt never falls back to a different/global acquisition.
 if(repositoryId!==undefined&&!/^[a-z][a-z0-9_.-]{0,79}$/.test(repositoryId))return unavailable(repositoryScope);
 let retained:ReturnType<typeof inspectAcquisitionAnalysis>;try{retained=inspectAcquisitionAnalysis(project,repositoryId);}catch{return unavailable(scopeNote);}
 if(retained.state!=='available')return {...unavailable(scopeNote),retainedContext:retained.state};
 const receipt=retained.analysis;
 const {inventory,sourceIdentity,documentMap}=receipt,page=diagnosticRows(receipt.documentMap.diagnostics,options.diagnosticPage);
 return {...unavailable(scopeNote),origin:'acquisition-receipt',consumerVersion:sourceIdentity.analyzerVersion,outputContract:documentMap.format+'/'+documentMap.version,captureTime:sourceIdentity.observedAt,
  revisionMeaning:'Receipt revision is a HEAD hint only. Aggregate digest identifies inspected bytes; dirty state and current freshness remain UNKNOWN.',requested:{depth:sourceIdentity.profile,analyzers:null},
  admission:{selectedEntries:inventory.selectedFiles,readFiles:inventory.readFiles,readBytes:inventory.readBytes,unsupported:inventory.unsupported,ignored:inventory.ignored,limited:inventory.limited},
  outputs:{documents:documentMap.documents.length,items:null,relations:documentMap.links.length,sourceRanges:null,diagnosticMessages:documentMap.diagnostics.length},
  revisions:[{repositoryId:repositoryId??null,revision:sourceIdentity.sourceRevision,aggregateDigest:sourceIdentity.contentDigest}],
  entries:inventory.entries.slice(0,SOURCE_BRIDGE_LIMITS.entries).map(row=>({repositoryId:repositoryId??null,sourceId:null,path:row.path,line:null,endLine:null,admission:row.state,fileDigest:null,revision:null})),
  diagnostics:page.diagnostics,...(page.diagnosticPage?{diagnosticPage:page.diagnosticPage}:{}),
  omitted:{entries:Math.max(0,inventory.entries.length-SOURCE_BRIDGE_LIMITS.entries),revisions:0,diagnostics:page.omitted,producer:{inventoryEntries:inventory.omittedEntries,documents:documentMap.omitted.documents,relations:documentMap.omitted.links,diagnostics:documentMap.omitted.diagnostics}},
 };
}
