import {validateLearningCatalogue, learningSourceSchema, type LearningSource} from '../../src/intelligence/learning/catalogue';
import {WORLD_DATA_CASES, WORLD_DATA_SOURCES, worldDataCardEntries} from '../../src/intelligence/learning/practicalCards';
import {validateDocument, type Project} from '../../src/core/model';
import {linkedReadingKey, type LinkedReadingOptions} from '../../src/core/linkedReading';

/** The six world-data candidates in the EXISTING learning schema. The card data lives in the App
 * catalogue module (`src/intelligence/learning/practicalCards.ts`); nothing here is adopted, matched
 * to a client, executed, or made into a new reference-family identifier. */
export const practicalSources: LearningSource[] = WORLD_DATA_SOURCES.map(row => learningSourceSchema.parse(row));
const cases = WORLD_DATA_CASES;

export function buildPracticalPatternCandidates() {
  return {entries: validateLearningCatalogue(worldDataCardEntries(), practicalSources), sources: practicalSources};
}

export function buildPracticalPatternProject(): {project: Project; reading: LinkedReadingOptions} {
 buildPracticalPatternCandidates();
 const p=validateDocument({schemaVersion:1,id:'practical-data-patterns',title:'Practical data patterns: decisions before tools',category:'Reference',rootViewId:'overview',summary:'Six original source-cited teaching cases; no cloud execution or claim of applicability to a client.',nodes:[],edges:[],views:[{id:'overview',title:'Patterns and decision questions',nodeIds:[],edgeIds:[],positions:{},visibility:'public'}],blocks:[],sources:[],story:[],observations:[]});
 p.sources=practicalSources.map((s,i)=>({id:'s.'+i,title:s.title,url:s.url,location:s.retrievedOn+'; '+s.limits,visibility:'public'}));
 const refs=(ids:readonly string[])=>ids.map(id=>'s.'+practicalSources.findIndex(s=>s.id===id));const chapters:LinkedReadingOptions['chapters']=[];
 for(const [index,c]of cases.entries()){
  const sourceIds=refs(c.sources),entryId='topic.'+c.id;
  const brief={id:'b.'+c.id,title:c.question,type:'text',text:c.definition+'\n\nHow to test the choice:\n'+c.steps.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\nResult: '+c.output+'\n\nLimits: '+c.limits.join(' ')+'\n\nFailure mode: '+c.failure,sourceIds,visibility:'public',provenance:'reference'} as const;
  const alternatives={id:'a.'+c.id,title:'Alternatives are candidates, not decisions',type:'table',columns:['Option','When useful','Status'],rows:c.alternatives.map(([a,b])=>[a,b,'Candidate, not selected']),sourceIds,visibility:'public',provenance:'author'} as const;
  p.blocks.push(brief as any,alternatives as any);
  const ids=[entryId,c.id+'.input',c.id+'.contract',c.id+'.result'];
  for(const [i,id]of ids.entries())p.nodes.push({id,label:[c.title,'Inputs and prerequisites','Decision and test contract','Result and remaining evidence'][i],kind:i===0?'model':i===1?'source':i===2?'process':'report',provider:'Pattern',icon:'generic',summary:[c.definition,c.input,c.steps.join(' '),c.output][i].slice(0,500),role:'Reference explanation; source documentation and authored reasoning are distinct.',status:'idle',basis:'planned',sourceIds,blockIds:[brief.id,alternatives.id],tags:['pattern-candidate'],visibility:'public',...i===0?{childViewId:'v.'+c.id}:{}});
  const root=p.views[0];root.nodeIds.push(entryId);root.positions[entryId]={x:(index%2)*340,y:Math.floor(index/2)*180};
  const common={nodeIds:ids.slice(1),edgeIds:[] as string[],positions:Object.fromEntries(ids.slice(1).map((id,i)=>[id,{x:i*310,y:0}])),visibility:'public' as const};
  p.views.push({id:'v.'+c.id,title:c.a,description:c.question,...common});
  const rightId='detail.'+c.id;const nav='nav.'+c.id;const item={...p.nodes.find(n=>n.id===entryId)!,id:nav,label:'Related view: '+c.b,childViewId:rightId};p.nodes.push(item);root.nodeIds.push(nav);root.positions[nav]={x:(index%2)*340+160,y:Math.floor(index/2)*180+80};
  p.views.push({id:rightId,title:c.b,description:c.failure,...common});
  chapters.push({id:c.id,leftViewId:'v.'+c.id,rightViewId:rightId,leftDesign:'architecture',rightDesign:'layers',anchorNodeId:entryId});
 }
 const project=validateDocument(p);return {project,reading:{projectId:project.id,sourceKey:linkedReadingKey(project),theme:'editorial',chapters}};
}
