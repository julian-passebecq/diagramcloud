import {z} from 'zod';
import {blockSchema,type EvidenceBlock} from '../core/model';

const id=z.string().regex(/^[a-z][a-z0-9_.-]{0,79}$/);
const text=z.string().trim().min(1).max(160);
const value=z.union([z.string().max(500),z.number().finite().min(-1e12).max(1e12),z.boolean(),z.null()]);
const relation=z.object({id,title:text,grain:text,coverage:z.enum(['sample','declared-complete']),
 columns:z.array(z.object({id,type:z.enum(['string','number','boolean']),nullable:z.boolean()}).strict()).min(1).max(8),
 rows:z.array(z.object({id,values:z.array(value).max(8)}).strict()).max(200)}).strict();
/** A bounded calculation over supplied rows, not a database/SQL executor or an inferred lineage model. */
export const joinInspectionSchema=z.object({id,title:text,scope:text,provenance:z.enum(['synthetic','source-derived']),sourceIds:z.array(id).max(12),
 left:relation,right:relation,keys:z.array(z.object({left:id,right:id}).strict()).min(1).max(4),kind:z.enum(['inner','left']),
 expectedRightMatches:z.enum(['one','many']),
 measure:z.object({leftColumn:id,unit:text,meaning:text}).strict().optional(),previewLimit:z.number().int().min(1).max(100).default(40)
}).strict();
export type JoinInspectionInput=z.infer<typeof joinInspectionSchema>;
export type JoinCell=string|number|boolean|null;
export type JoinPair={leftRowId:string;rightRowId:string|null;left:JoinCell[];right:JoinCell[]};
const refuse=(message:string):never=>{throw new Error('Join inspection refused: '+message);};
function unique(ids:readonly string[],what:string){if(new Set(ids).size!==ids.length)refuse('duplicate '+what);}
function sum(values:(number|null)[]){return values.length===0?0:values.every(v=>v===null)?null:values.reduce<number>((s,v)=>s+(v??0),0);}
export function inspectJoin(input:unknown){
 const q=joinInspectionSchema.parse(input);
 if(q.left.id===q.right.id)refuse('relation aliases must be distinct, including self-joins');
 unique(q.sourceIds,'source references');
 if(q.provenance==='source-derived'&&!q.sourceIds.length)refuse('source-derived rows need cited source IDs');
 for(const r of [q.left,q.right]){
  unique(r.columns.map(c=>c.id),'column IDs');unique(r.rows.map(r=>r.id),'row IDs');
  for(const row of r.rows){
   if(row.values.length!==r.columns.length)refuse('row width does not match its columns');
   row.values.forEach((v,i)=>{const c=r.columns[i];if(v===null?!c.nullable:typeof v!==c.type)refuse('row values must match explicit types and nullability');});
  }
 }
 unique(q.keys.map(k=>k.left),'left join keys');unique(q.keys.map(k=>k.right),'right join keys');
 const li=q.keys.map(k=>q.left.columns.findIndex(c=>c.id===k.left)),ri=q.keys.map(k=>q.right.columns.findIndex(c=>c.id===k.right));
 if([...li,...ri].some(i=>i<0))refuse('join key is absent');
 if(li.some((i,k)=>q.left.columns[i].type!==q.right.columns[ri[k]].type))refuse('implicit casts or mixed key types are not supported');
 const m=q.measure?q.left.columns.findIndex(c=>c.id===q.measure!.leftColumn):-1;
 if(q.measure&&(m<0||q.left.columns[m].type!=='number'))refuse('measure must name a numeric left column');
 // Typed arrays avoid composite-key delimiter collisions; NULL never equals NULL in this declared equijoin.
 const key=(cells:JoinCell[],indices:number[])=>indices.some(i=>cells[i]===null)?null:JSON.stringify(indices.map(i=>cells[i]));
 const rightByKey=new Map<string,typeof q.right.rows>();
 for(const r of q.right.rows){const k=key(r.values,ri);if(k!==null)rightByKey.set(k,[...(rightByKey.get(k)??[]),r]);}
 const preview:JoinPair[]=[],usedRight=new Set<string>();
 const perLeft=q.left.rows.map(l=>{
  const k=key(l.values,li),matches=k===null?[]:rightByKey.get(k)??[];
  matches.forEach(r=>usedRight.add(r.id));
  const rightRows=matches.length?matches:q.kind==='left'?[null]:[];
  for(const r of rightRows)if(preview.length<q.previewLimit)preview.push({leftRowId:l.id,rightRowId:r?.id??null,left:[...l.values],right:r?[...r.values]:q.right.columns.map(()=>null)});
  return {rowId:l.id,rightRowIds:matches.map(r=>r.id),matches:matches.length,outputRows:rightRows.length};
 });
 const outputRows=perLeft.reduce((s,r)=>s+r.outputRows,0),unmatchedLeft=perLeft.filter(r=>r.matches===0).map(r=>r.rowId),fanout=perLeft.filter(r=>r.matches>1).map(r=>({rowId:r.rowId,matches:r.matches}));
 const before=m<0?null:sum(q.left.rows.map(r=>r.values[m] as number|null));
 const after=m<0?null:sum(q.left.rows.flatMap((r,i)=>Array.from({length:perLeft[i].outputRows},()=>r.values[m] as number|null)));
 if([before,after].some(v=>v!==null&&!Number.isFinite(v)))refuse('aggregate exceeds finite arithmetic bounds');
 const violations=q.expectedRightMatches==='one'?perLeft.filter(r=>r.matches!==1).map(r=>r.rowId):[];
 return {request:q,basis:'CALCULATED_OVER_SUPPLIED_ROWS' as const,scope:q.scope,
  coverage:q.left.coverage==='sample'||q.right.coverage==='sample'?'sample' as const:'declared-complete' as const,
  inputRows:{left:q.left.rows.length,right:q.right.rows.length},outputRows,preview,previewOmitted:outputRows-preview.length,
  perLeft,unmatchedLeft,unmatchedRight:q.right.rows.filter(r=>!usedRight.has(r.id)).map(r=>r.id),fanout,grainViolations:violations,
  measure:q.measure?{...q.measure,before,after,missingInputs:q.left.rows.filter(r=>r.values[m]===null).length}:null,
  limits:['Inner/left equijoin only; no SQL, database, user code or connector is executed.','Exact typed equality; NULL does not match NULL; no implicit casts, collation or time-range join.','Counts and provenance cover the supplied rows only; sample coverage cannot certify production uniqueness.','Amounts use finite JavaScript-number arithmetic, not a decimal accounting engine.','Fanout is a relation property; it violates the grain only when exactly one right match was declared.']};
}
export type JoinInspection=ReturnType<typeof inspectJoin>;
/** Ordinary transformation evidence blocks. Source IDs must also resolve in the destination Project's native validator. */
export function joinInspectionBlocks(result:JoinInspection):EvidenceBlock[]{
 const q=result.request,prefix=q.id;
 // Reserve room for suffixes under the existing native 80-character ID bound.
 if(prefix.length>55)refuse('evidence prefix exceeds 55 characters');
 const common={visibility:'private' as const,sourceIds:q.sourceIds,provenance:q.provenance};
 const table=(suffix:string,title:string,transform:'input'|'output'|'mapping'|'rules',columns:string[],rows:JoinCell[][])=>
  blockSchema.parse({...common,id:`${prefix}.${suffix}`,title,transform,type:'table',columns,rows});
 const resultColumns=['left_row_id','right_row_id',...q.left.columns.map(c=>'L.'+c.id),...q.right.columns.map(c=>'R.'+c.id)];
 return [
  table('left','Left input: '+q.left.title,'input',['row_id',...q.left.columns.map(c=>c.id)],q.left.rows.map(r=>[r.id,...r.values])),
  table('right','Right input: '+q.right.title,'input',['row_id',...q.right.columns.map(c=>c.id)],q.right.rows.map(r=>[r.id,...r.values])),
  blockSchema.parse({...common,id:`${prefix}.logic`,title:'Declared join - display only',transform:'logic',type:'code',language:'sql',code:`-- Not executed. Typed ${q.kind.toUpperCase()} equality over the supplied rows.\n-- NULL never matches NULL.\n${q.keys.map(k=>`L.${k.left} = R.${k.right}`).join('\nAND ')}`}),
  table('output','Result preview with row provenance','output',resultColumns,result.preview.map(r=>[r.leftRowId,r.rightRowId,...r.left,...r.right])),
  table('mapping','Input row to matching output rows','mapping',['Left row ID','Right match IDs','Matches','Output rows'],result.perLeft.map(r=>[r.rowId,r.rightRowIds.join(', ')||'No match',r.matches,r.outputRows])),
  table('rules','Grain, coverage and limits','rules',['Aspect','Value'],[
   ['Left grain',q.left.grain],['Right grain',q.right.grain],['Expected right matches',q.expectedRightMatches],['Coverage',result.coverage],
   ['Calculated output rows',result.outputRows],['Preview rows omitted',result.previewOmitted],['Grain violation row IDs',result.grainViolations.join(', ')||'None within these supplied rows'],
   ['Unmatched left rows',result.unmatchedLeft.join(', ')||'None within these supplied rows'],
   ['Measure before',result.measure?.before??'Not supplied or no non-null values'],['Measure after',result.measure?.after??'Not supplied or no non-null values'],
   ...result.limits.map(v=>['Limit',v] as JoinCell[])
  ])
 ];
}
