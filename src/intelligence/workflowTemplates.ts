import originalBrief from '../../examples/workflows/01-petit-client.project-brief.json';
import sourceCard from '../../examples/workflows/01-petit-client.source.json';
import {validateProjectBrief,type ProjectBrief} from './brief';

/** A static catalogue choice, not a project/instance registry or occurrence store. */
export const privateWorkflowTemplates=[{
 id:'01-petit-client',title:'Petit client sans outils',
 problem:'Explain a small page → API → data request without assuming an implementation.',
 inputs:['A page requests data from an API; the request contract is not supplied.'],
 outputs:['The API returns a result; its format and data schema are not supplied.'],
 constraints:['Synthetic, source-declared definition only. No code executes.', 'Actors, gates, retries, timing and execution outcomes are not supplied.'],
 unknowns:Object.freeze([...originalBrief.questions]),
 labels:['Synthetic','Source-declared','PRIVATE_DRAFT','Occurrence UNKNOWN'],
 source:Object.freeze({...sourceCard.source}),
}] as const;

/** Each explicit load makes a new local instance; the original scope/relation identities remain stable.
 * Provenance fits the existing native summary field. No additional ProjectBrief key or permission is added.
 * idFactory is a test seam for UUID generation, not a host-supplied identity or command.
 */
export function instantiateWorkflowTemplate(templateId:string,idFactory:()=>string=()=>crypto.randomUUID()):ProjectBrief{
 const template=privateWorkflowTemplates.find(t=>t.id===templateId);
 if(!template)throw new Error('Unknown private workflow template');
 const uuid=idFactory();
 if(typeof uuid!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i).test(uuid))throw new Error('Invalid generated local workflow instance identity');
 const original=validateProjectBrief(originalBrief),instanceId='client-'+uuid.replace(/-/g,'').toLowerCase();
 const reference=`Synthetic, source-declared workflow definition; occurrence UNKNOWN. PRIVATE_DRAFT. Reference: ${template.source.archive}/${template.source.entry}; source ProjectBrief ID ${template.source.sourceProjectId}; SHA-256 ${template.source.entrySha256}. New local instance; no execution or observed result is claimed.`;
 return validateProjectBrief({...original,project:{...original.project,id:instanceId,summary:original.project.summary+'\n\n'+reference}});
}
