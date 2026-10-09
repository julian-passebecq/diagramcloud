import {publicationBriefSchema,validatePublicationBrief} from './publicationBrief';
import {z} from 'zod';
import {validateDocument,type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {viewSpec} from '../core/viewspec';
import {projectReadiness} from './readiness';
import {impactFacts,architectureAudit,contextualRecipes,learningPath} from './recipes';
import {designSvg} from '../export/design';
import {parseDesignBrief} from '../core/designBrief';
import {designBookHtml} from '../export/design/book';
import {deltaSvg} from '../export/design/delta';
import {validateProjectBrief} from './brief';
import {proposeVerificationSpec} from './verification';
import {DEFAULT_OPTIONS} from './types';
import {stageEntityProposal} from './entityProposal';
import {defects} from '../export/design/quality';
import {semanticVisualQuality,compareRenderCandidates} from './visualQuality';
export const querySchema=z.object({kind:z.enum(['summary','components','evidence','impact','views','verification','gaps','sources','recipes','learning','analysis']),
 direction:z.enum(['upstream','downstream']).default('downstream'),includeInferred:z.boolean().default(false),
 search:z.string().max(160).optional(),nodeId:z.string().max(120).optional(),limit:z.number().int().min(1).max(100).default(30)}).strict();
/** Native consumers get the same public boundary as exports. No user-controlled
 * path, filesystem, command, permission or network operation is accepted. */
export function queryProject(input:Project,request:unknown){const doc=publicDocument(validateDocument(input)),q=querySchema.parse(request);
 const matches=doc.nodes.filter(n=>!q.search||(n.label+' '+n.summary).toLowerCase().includes(q.search.toLowerCase()));
 let data:unknown;
 if(q.kind==='summary')data={title:doc.title,summary:doc.summary,revision:doc.revision,readiness:projectReadiness(doc)};
 if(q.kind==='components')data=matches.slice(0,q.limit);
 if(q.kind==='views')data=doc.views.slice(0,q.limit).map(v=>viewSpec(doc,v.id));
 if(q.kind==='evidence'){if(q.nodeId&&!doc.nodes.some(n=>n.id===q.nodeId))throw new Error('Component unavailable in public projection');
  const ids=new Set(q.nodeId?doc.nodes.find(n=>n.id===q.nodeId)!.blockIds:matches.flatMap(n=>n.blockIds));data=doc.blocks.filter(b=>ids.has(b.id)).slice(0,q.limit);}
 if(q.kind==='impact'){if(!q.nodeId)throw new Error('Impact requires nodeId');data=impactFacts(doc,q.nodeId,{direction:q.direction,includeInferred:q.includeInferred,limit:q.limit});}
 if(q.kind==='verification')data={reviewedClaims:doc.observations.slice(0,q.limit),gaps:matches.filter(n=>!doc.observations.some(o=>o.nodeId===n.id)).slice(0,q.limit).map(n=>({nodeId:n.id,state:'UNKNOWN',reason:'No reviewed external claim in the public projection'})),note:'A claim is dated external evidence, never permission or a new test run'};
 if(q.kind==='gaps')data=architectureAudit(doc);
 if(q.kind==='sources')data=doc.sources.slice(0,q.limit);
 if(q.kind==='recipes')data=contextualRecipes(doc,DEFAULT_OPTIONS).slice(0,q.limit);
 if(q.kind==='learning')data=learningPath(doc).slice(0,q.limit);
 if(q.kind==='analysis')data={readiness:projectReadiness(doc),scope:'public-projection',note:'Private generated acquisition/graph receipts are intentionally omitted. No source collector is invoked.'};
 const out={format:'diagramcloud.context/1',scope:'public-projection',projectId:doc.id,projectRevision:doc.revision,data};
 if(new TextEncoder().encode(JSON.stringify(out)).byteLength>1024*1024)throw new Error('Result exceeds 1 MiB; use a narrower query');return out;
}
export function renderPublicView(input:Project,request:unknown){const q=z.object({viewId:z.string().max(120)}).strict().parse(request),doc=publicDocument(validateDocument(input));
 if(!doc.views.some(v=>v.id===q.viewId))throw new Error('View unavailable in public projection');const svg=designSvg(doc,q.viewId);
 if(new TextEncoder().encode(svg).byteLength>1024*1024)throw new Error('Figure exceeds 1 MiB');return svg;}
export function proposePublicDesign(input:Project,request:unknown){const doc=publicDocument(validateDocument(input));const brief=parseDesignBrief(JSON.stringify(request));
 if(brief.projectId!==doc.id)throw new Error('Design proposal project identity differs');
 for(const hint of brief.views){const view=doc.views.find(v=>v.id===hint.viewId);if(!view||(hint.focal??[]).length>2||(hint.focal??[]).some(id=>!view.nodeIds.includes(id)))throw new Error('Design proposal is outside the public view');}
 return {format:'diagramcloud.proposal/1',state:'REQUIRES_AUTHOR_REVIEW',brief};}
export function verificationProposal(input:Project){const doc=publicDocument(validateDocument(input));return {format:'diagramcloud.verification-spec/1',
 projectId:doc.id,projectRevision:doc.revision,state:'PROPOSED',checks:doc.nodes.map(n=>({id:'check-'+n.id,nodeId:n.id,expected:'Source revision and external evidence must be supplied',result:'NOT_RUN'})),
 note:'A proposed check is not a verification result; imported observations require reviewed patches'};}
export function proposePublicVerification(input:Project,request:unknown){return {format:'diagramcloud.proposal/1',state:'REQUIRES_AUTHOR_REVIEW',spec:proposeVerificationSpec(publicDocument(validateDocument(input)),request)};}
export function proposePublicProject(request:unknown){return {format:'diagramcloud.proposal/1',state:'REQUIRES_AUTHOR_REVIEW',brief:validateProjectBrief(request),note:'An explicit project proposal; no acquisition, execution, import or publication is performed.'};}
export function proposePublicEntities(input:Project,request:unknown){const r=z.object({proposal:z.unknown(),selectedSources:z.record(z.string().max(80),z.string().max(131072)).refine(rows=>Object.keys(rows).length<=50,'At most 50 explicitly selected sources')}).strict().parse(request);return stageEntityProposal(publicDocument(validateDocument(input)),r.proposal,r.selectedSources);}
export function proposePublication(input:Project,request:unknown){const doc=publicDocument(validateDocument(input)),r=publicationBriefSchema.omit({format:true}).extend({format:publicationBriefSchema.shape.format.optional(),audience:z.string().max(160).default(''),viewIds:z.array(z.string().max(80)).min(1).max(20)}).strict().parse(request),brief=validatePublicationBrief({...r,format:'diagramcloud.publication-brief/1'},doc);
 return {format:'diagramcloud.publication-proposal/1',state:'REQUIRES_AUTHOR_REVIEW',projectId:doc.id,projectRevision:doc.revision,title:brief.title,viewIds:brief.viewIds,brief,note:'A presentation-only proposal; publishing and sharing remain author decisions.'};}
export function renderPublicArtifact(input:Project,request:unknown){const q=z.object({kind:z.enum(['view','book','delta','quality','candidates']),viewId:z.string().max(80).optional(),before:z.unknown().optional()}).strict().parse(request),doc=publicDocument(validateDocument(input));
 if(q.kind!=='book'&&(!q.viewId||!doc.views.some(v=>v.id===q.viewId)))throw new Error('Render requires a public viewId');
 let result:unknown;
 if(q.kind==='view')result=renderPublicView(doc,{viewId:q.viewId});
 if(q.kind==='book'){if(doc.views.length>20)throw new Error('Book exceeds 20 public views; choose view rendering');result=designBookHtml(doc);}
 if(q.kind==='delta'){const before=publicDocument(validateDocument(q.before));result=deltaSvg(before,doc,q.viewId!);}
 if(q.kind==='quality'){const svg=renderPublicView(doc,{viewId:q.viewId}),geometry=defects(svg,q.viewId!),type=/<svg[^>]*data-design-type="([a-z]+)"/.exec(svg)?.[1]??'architecture';result={viewId:q.viewId,checks:{svgDocument:svg.includes('<svg'),accessibleTitle:svg.includes('<title'),offline:!/<(?:script|foreignObject)\b|(?:href|src)="https?:/i.test(svg)},geometry,semantic:semanticVisualQuality(doc,q.viewId!,type,svg),qualification:geometry.failures.length?'DEFECTS_FOUND':geometry.unresolved||geometry.unresolvedShapes?'PARTIAL_GEOMETRY_CHECK':'GEOMETRY_CHECKED',note:'Existing deterministic text-width/shape geometry budgets. Unresolved transforms remain counted; this is not browser/PowerPoint visual review or release qualification.'};}
 if(q.kind==='candidates')result=compareRenderCandidates(doc,q.viewId!);
 if(new TextEncoder().encode(typeof result==='string'?result:JSON.stringify(result)).byteLength>1024*1024)throw new Error('Render result exceeds 1 MiB; choose a narrower artifact');return result;}
