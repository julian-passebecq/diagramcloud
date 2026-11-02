import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {samples} from '../../src/data/samples';
import {classifyPatterns,contextualRecipes,recommendRecipes,patternInputExplanation,matchesCatalogueEntry,patternCatalog,recipeRegistry} from '../../src/intelligence/recipes';
import {DEFAULT_OPTIONS,PURPOSES} from '../../src/intelligence/types';
/** Legacy recognition output digests. Recorded BEFORE the R4 catalogue extension; any change to a matcher result changes a digest. */
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function matcherSnapshot(){
 // This is a regression baseline for the original fixture set, not a freeze on
 // adding projects to the gallery. Keep every recorded fixture and digest intact;
 // a removed fixture is an error rather than silently shrinking the baseline.
 const recorded=JSON.parse(readFileSync(new URL('../fixtures/catalogue-matcher-snapshot.json',import.meta.url),'utf8')) as {fixtures:Record<string,string>};
 const legacySamples=Object.keys(recorded.fixtures).map(id=>{
  const project=samples.find(p=>p.id===id);
  if(!project)throw new Error(`Recorded matcher fixture is missing: ${id}`);
  return project;
 });
 const fixtures=Object.fromEntries(legacySamples.map(p=>[p.id,digest({
  patterns:classifyPatterns(p),
  recipes:PURPOSES.flatMap(purpose=>(['quick','standard'] as const).map(depth=>[purpose,depth,recommendRecipes(p,{...DEFAULT_OPTIONS,purpose,depth}),contextualRecipes(p,{...DEFAULT_OPTIONS,purpose,depth},{archetypes:['data']})])),
  inputs:patternCatalog.map(row=>[patternInputExplanation(p,row.id),patternInputExplanation(p,row.id,{publicMode:true})])
 })]));
 const browse=['','medallion','spark','event','zzz'].map(q=>[q,...(['all','supplied','not-supplied'] as const).map(g=>[...recipeRegistry,...patternCatalog].filter(row=>matchesCatalogueEntry(row,q,g)).map(row=>row.id))]);
 return {registries:digest({patternCatalog,recipeRegistry}),browse:digest(browse),fixtures};
}
