import {z} from 'zod';
import {validateDocument,type Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {viewSpec} from '../core/viewspec';
import {projectReadiness} from './readiness';
import {impactFacts} from './recipes';
import {designSvg} from '../export/design';
import {parseDesignBrief} from '../core/designBrief';
export const querySchema=z.object({kind:z.enum(['summary','components','evidence','impact','views','verification']),
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
 if(q.kind==='impact'){if(!q.nodeId)throw new Error('Impact requires nodeId');data=impactFacts(doc,q.nodeId,{direction:'downstream',includeInferred:false,limit:q.limit});}
 if(q.kind==='verification')data={reviewedClaims:doc.observations.slice(0,q.limit),gaps:matches.filter(n=>!doc.observations.some(o=>o.nodeId===n.id)).slice(0,q.limit).map(n=>({nodeId:n.id,state:'UNKNOWN',reason:'No reviewed external claim in the public projection'})),note:'A claim is dated external evidence, never permission or a new test run'};
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
