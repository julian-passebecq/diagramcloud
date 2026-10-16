import {createHash} from 'node:crypto';
import {samples} from '../../src/data/samples';
import {classifyPatterns,contextualRecipes,recommendRecipes,patternInputExplanation,matchesCatalogueEntry,patternCatalog,recipeRegistry} from '../../src/intelligence/recipes';
import {DEFAULT_OPTIONS,PURPOSES} from '../../src/intelligence/types';
/** Legacy recognition output digests. Recorded BEFORE the R4 catalogue extension; any change to a matcher result changes a digest. */
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function matcherSnapshot(){
 const fixtures=Object.fromEntries(samples.map(p=>[p.id,digest({
  patterns:classifyPatterns(p),
  recipes:PURPOSES.flatMap(purpose=>(['quick','standard'] as const).map(depth=>[purpose,depth,recommendRecipes(p,{...DEFAULT_OPTIONS,purpose,depth}),contextualRecipes(p,{...DEFAULT_OPTIONS,purpose,depth},{archetypes:['data']})])),
  inputs:patternCatalog.map(row=>[patternInputExplanation(p,row.id),patternInputExplanation(p,row.id,{publicMode:true})])
 })]));
 const browse=['','medallion','spark','event','zzz'].map(q=>[q,...(['all','supplied','not-supplied'] as const).map(g=>[...recipeRegistry,...patternCatalog].filter(row=>matchesCatalogueEntry(row,q,g)).map(row=>row.id))]);
 return {registries:digest({patternCatalog,recipeRegistry}),browse:digest(browse),fixtures};
}
