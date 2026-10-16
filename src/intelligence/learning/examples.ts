import {z} from 'zod';
import {validateDocument,type Project} from '../../core/model';
import {compileProjectBrief} from '../brief';
import {warehouseBrief,ragBrief,agentsBrief,syntheticTables} from './exampleData';
/** Synthetic teaching examples compiled through the native ProjectBrief compiler and validateDocument. Each result is a NEW candidate: import it through the ordinary review. */
export const LEARNING_EXAMPLES=[
 {id:'warehouse',brief:warehouseBrief,lessonIds:['star-grain','scd-history']},
 {id:'rag',brief:ragBrief,lessonIds:['rag-pipeline']},
 {id:'agents',brief:agentsBrief,lessonIds:['workflow-agent']}
] as const;
export const LEARNING_EXAMPLE_PROVENANCE='Synthetic learning example compiled from an authored ProjectBrief (R4 packet, authored-synthetic). Declarations only: no deployment, observed execution or owner project mapping.';
export function learningExampleId(id:string){return 'lesson-example-'+id;}
/** The compiled document keeps every native declaration; only identity and labels change, then it is validated again. */
export function compileLearningExample(id:string):Project{
 const example=LEARNING_EXAMPLES.find(row=>row.id===id);if(!example)throw new Error('Unknown learning example');
 const doc=structuredClone(compileProjectBrief(example.brief).document);
 doc.id=learningExampleId(example.id);doc.title=('Learning example · '+doc.title).slice(0,160);doc.category='Reference';doc.tags=[...new Set([...doc.tags,'Synthetic','Learning example'])];doc.provenance=LEARNING_EXAMPLE_PROVENANCE;
 doc.sources=doc.sources.map(source=>source.id==='project-brief-source'?{...source,title:'Authored synthetic ProjectBrief',location:'R4 learning packet example; synthetic teaching declaration, not an owner source or runtime receipt.'}:source);
 doc.blocks=doc.blocks.map(block=>({...block,provenance:'synthetic'}));
 return validateDocument(doc);
}
export function learningExamplesForLesson(lessonId:string){return LEARNING_EXAMPLES.filter(row=>(row.lessonIds as readonly string[]).includes(lessonId)).map(row=>row.id);}

const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tablesSchema=z.object({provenance:z.literal('authored-synthetic'),sales:z.array(z.object({line:z.string(),quantity:z.number().int().nonnegative(),unitPrice:z.number().nonnegative()}).strict()).min(1),expectedSales:z.number(),
 customerVersions:z.array(z.object({customer:z.string(),region:z.string(),from:day,to:day}).strict()).min(1),salesDates:z.array(day).min(1),expectedRegions:z.array(z.string()),intervalSemantics:z.literal('from inclusive; to exclusive; exactly one matching version required')}).strict();
export type TemporalMatch={date:string;state:'matched';region:string}|{date:string;state:'no-version'|'ambiguous';regions:string[]};
/** Half-open interval lookup: from inclusive, to exclusive. Zero or several matching versions stay visible instead of picking one. */
export function temporalJoin(versions:{region:string;from:string;to:string}[],dates:string[]):TemporalMatch[]{
 return dates.map(date=>{const regions=versions.filter(v=>v.from<=date&&date<v.to).map(v=>v.region);return regions.length===1?{date,state:'matched',region:regions[0]}:{date,state:regions.length?'ambiguous':'no-version',regions};});
}
/** The packet SCD/grain exercise, computed rather than asserted. Fixture arithmetic, not business evidence. */
export function scdExercise(input:unknown=syntheticTables){
 const tables=tablesSchema.parse(input),total=tables.sales.reduce((sum,row)=>sum+row.quantity*row.unitPrice,0);
 const matches=temporalJoin(tables.customerVersions,tables.salesDates);
 return {provenance:tables.provenance,rows:tables.sales.length,sales:total,salesAsExpected:total===tables.expectedSales,matches,
  regionsAsExpected:matches.length===tables.expectedRegions.length&&matches.every((m,i)=>m.state==='matched'&&m.region===tables.expectedRegions[i]),intervalSemantics:tables.intervalSemantics};
}
export type GrainFact={line:string;customer:string;date:string;amount:number};
export type GrainDimensionRow={customer:string;region:string;from:string;to:string};
export type GrainCheck={provenance:'authored-synthetic';grain:string;join:string;factRows:number;joinedRows:number;before:number;after:number;state:'clean'|'double-counting'|'dropped-rows';multiplied:{line:string;matches:number}[];dropped:string[];report:string};
/** Grain check: each fact row must keep exactly one dimension row. A join that returns several rows for one fact multiplies the measure
 * (double counting) and is reported with the totals before and after; a fact with none is reported as dropped. Never silently deduplicated. */
export function grainCheck(facts:readonly GrainFact[],dimension:readonly GrainDimensionRow[],join:{label:string;matches:(fact:GrainFact,row:GrainDimensionRow)=>boolean},grain='order line'):GrainCheck{
 const per=facts.map(fact=>({fact,rows:dimension.filter(row=>join.matches(fact,row))})),sum=(rows:readonly GrainFact[])=>rows.reduce((total,row)=>total+row.amount,0);
 const before=sum(facts),after=sum(per.flatMap(p=>p.rows.map(()=>p.fact))),joinedRows=per.reduce((n,p)=>n+p.rows.length,0);
 const multiplied=per.filter(p=>p.rows.length>1).map(p=>({line:p.fact.line,matches:p.rows.length})),dropped=per.filter(p=>!p.rows.length).map(p=>p.fact.line);
 const state=multiplied.length?'double-counting':dropped.length?'dropped-rows':'clean',head=`Joining ${facts.length} ${grain} rows ${join.label} returns ${joinedRows} rows`;
 const report=state==='double-counting'?`Double counting: ${head}; the total changes from ${before} to ${after}. ${multiplied.map(m=>m.line+' matches '+m.matches+' dimension rows').join('; ')}.`
  :state==='dropped-rows'?`Dropped rows: ${head}; the total changes from ${before} to ${after}. No dimension row for ${dropped.join(', ')}.`:`Grain kept: ${head}; the total stays ${before}.`;
 return {provenance:'authored-synthetic',grain,join:join.label,factRows:facts.length,joinedRows,before,after,state,multiplied,dropped,report};
}
/** The packet order-line fixture under two joins: on the customer key alone (the SCD dimension has two versions of C1, so every line is
 * counted twice) and on the key plus the half-open validity interval (one version per line, total 35). Fixture arithmetic, not business evidence. */
export function grainExercise(input:unknown=syntheticTables){
 const tables=tablesSchema.parse(input),customers=[...new Set(tables.customerVersions.map(v=>v.customer))];
 if(customers.length!==1||tables.salesDates.length!==tables.sales.length)throw new Error('The synthetic grain exercise needs one customer and one sale date per order line');
 const facts=tables.sales.map((row,i)=>({line:row.line,customer:customers[0],date:tables.salesDates[i],amount:row.quantity*row.unitPrice}));
 return {expectedSales:tables.expectedSales,
  naive:grainCheck(facts,tables.customerVersions,{label:'to the customer dimension on the customer key alone',matches:(fact,row)=>fact.customer===row.customer}),
  temporal:grainCheck(facts,tables.customerVersions,{label:'to the customer dimension on the customer key and the sale date within the validity interval',matches:(fact,row)=>fact.customer===row.customer&&row.from<=fact.date&&fact.date<row.to})};
}
