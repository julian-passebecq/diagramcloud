import type {ModelItem} from './semantic';

/**
 * Edits for semantic-model items. Pure: each function returns a new item plus a label for the undo history, or
 * throws a message fit for the user. Renames rewrite every "Table.Column" reference and measure table; removals
 * also drop the relationships that depended on what was removed. validatePack still runs on commit.
 */
export type ModelEdit={item:ModelItem;label:string};
type Table=ModelItem['tables'][number];
type Column=Table['columns'][number];
export type TableKind=Table['kind'];
export type ColumnKey=Column['key'];
export type Cardinality=ModelItem['relationships'][number]['cardinality'];

const copy=(m:ModelItem)=>structuredClone(m);
const clean=(s:string)=>s.trim();
const tableOf=(ref:string)=>ref.slice(0,ref.indexOf('.')),columnOf=(ref:string)=>ref.slice(ref.indexOf('.')+1);
function table(m:ModelItem,name:string):Table{const t=m.tables.find(x=>x.name===name);if(!t)throw new Error(`Table ${name} no longer exists.`);return t;}
function tableName(m:ModelItem,raw:string,except?:string):string{
 const name=clean(raw);
 if(!name)throw new Error('A table needs a name.');
 if(name.includes('.'))throw new Error('Table names cannot contain a dot (relationships use Table.Column).');
 if(name.length>80)throw new Error('Table names are limited to 80 characters.');
 if(m.tables.some(t=>t.name===name&&t.name!==except))throw new Error(`There is already a table called ${name}.`);
 return name;
}
function columnName(t:Table,raw:string,except?:string):string{
 const name=clean(raw);
 if(!name)throw new Error('A column needs a name.');
 if(name.length>80)throw new Error('Column names are limited to 80 characters.');
 if(t.columns.some(c=>c.name===name&&c.name!==except))throw new Error(`${t.name} already has a column called ${name}.`);
 return name;
}
const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;

export function addTable(m:ModelItem,raw:string,kind:TableKind):ModelEdit{
 if(m.tables.length>=40)throw new Error('A model can hold at most 40 tables.');
 const next=copy(m),name=tableName(m,raw);
 // A new table gets a key column so it can take part in a relationship straight away.
 next.tables.push({name,kind,columns:[{name:`${name.replace(/^(Dim|Fact)_?/,'')||name}Key`,type:'int',key:kind==='fact'?'fk':'pk'}]});
 return {item:next,label:`Added table ${name}`};
}
export function renameTable(m:ModelItem,from:string,raw:string):ModelEdit{
 const to=tableName(m,raw,from);if(to===from)return {item:m,label:''};
 const next=copy(m);table(next,from).name=to;
 const re=(ref:string)=>tableOf(ref)===from?`${to}.${columnOf(ref)}`:ref;
 next.relationships=next.relationships.map(r=>({...r,from:re(r.from),to:re(r.to)}));
 next.measures=next.measures.map(x=>x.table===from?{...x,table:to}:x);
 return {item:next,label:`Renamed table ${from} → ${to}`};
}
export function setTableKind(m:ModelItem,name:string,kind:TableKind):ModelEdit{
 const next=copy(m);table(next,name).kind=kind;return {item:next,label:`${name} is now a ${kind} table`};
}
export function removeTable(m:ModelItem,name:string):ModelEdit{
 if(m.tables.length<=1)throw new Error('A model needs at least one table.');
 const next=copy(m);table(next,name);
 const dropped=next.relationships.filter(r=>tableOf(r.from)===name||tableOf(r.to)===name).length;
 next.tables=next.tables.filter(t=>t.name!==name);
 next.relationships=next.relationships.filter(r=>tableOf(r.from)!==name&&tableOf(r.to)!==name);
 next.measures=next.measures.map(x=>x.table===name?{name:x.name,...(x.format?{format:x.format}:{})}:x);
 return {item:next,label:`Removed table ${name}${dropped?` and ${plural(dropped,'relationship')}`:''}`};
}

export function addColumn(m:ModelItem,tableName_:string,raw:string,type:string,key:ColumnKey):ModelEdit{
 const next=copy(m),t=table(next,tableName_);
 if(t.columns.length>=60)throw new Error(`${t.name} already has the maximum of 60 columns.`);
 const name=columnName(t,raw);t.columns.push({name,type:clean(type).slice(0,30),...(key?{key}:{})});
 return {item:next,label:`Added column ${t.name}.${name}`};
}
export function renameColumn(m:ModelItem,tableName_:string,from:string,raw:string):ModelEdit{
 const t0=table(m,tableName_),to=columnName(t0,raw,from);if(to===from)return {item:m,label:''};
 const next=copy(m),t=table(next,tableName_);t.columns.find(c=>c.name===from)!.name=to;
 const re=(ref:string)=>ref===`${tableName_}.${from}`?`${tableName_}.${to}`:ref;
 next.relationships=next.relationships.map(r=>({...r,from:re(r.from),to:re(r.to)}));
 return {item:next,label:`Renamed column ${tableName_}.${from} → ${to}`};
}
export function setColumn(m:ModelItem,tableName_:string,column:string,patch:{type?:string;key?:ColumnKey|null}):ModelEdit{
 const next=copy(m),c=table(next,tableName_).columns.find(x=>x.name===column);if(!c)throw new Error(`Column ${tableName_}.${column} no longer exists.`);
 if(patch.type!==undefined)c.type=clean(patch.type).slice(0,30);
 if(patch.key!==undefined){if(patch.key)c.key=patch.key;else delete c.key;}
 return {item:next,label:`Changed column ${tableName_}.${column}`};
}
export function removeColumn(m:ModelItem,tableName_:string,column:string):ModelEdit{
 const next=copy(m),t=table(next,tableName_),ref=`${tableName_}.${column}`;
 const dropped=next.relationships.filter(r=>r.from===ref||r.to===ref).length;
 t.columns=t.columns.filter(c=>c.name!==column);
 next.relationships=next.relationships.filter(r=>r.from!==ref&&r.to!==ref);
 return {item:next,label:`Removed column ${ref}${dropped?` and ${plural(dropped,'relationship')}`:''}`};
}

export function addRelationship(m:ModelItem,from:string,to:string,cardinality:Cardinality):ModelEdit{
 const exists=(ref:string)=>m.tables.some(t=>t.name===tableOf(ref)&&t.columns.some(c=>c.name===columnOf(ref)));
 if(!exists(from)||!exists(to))throw new Error('Pick an existing column on both sides.');
 if(tableOf(from)===tableOf(to))throw new Error('A relationship joins two different tables.');
 if(m.relationships.some(r=>r.from===from&&r.to===to||r.from===to&&r.to===from))throw new Error(`${from} and ${to} are already related.`);
 if(m.relationships.length>=120)throw new Error('A model can hold at most 120 relationships.');
 const next=copy(m);
 // A second active path between the same two tables would be ambiguous, so it starts inactive (as in Power BI).
 const active=!m.relationships.some(r=>r.active&&[tableOf(r.from),tableOf(r.to)].sort().join()===[tableOf(from),tableOf(to)].sort().join());
 next.relationships.push({from,to,cardinality,active});
 return {item:next,label:`Related ${from} → ${to}${active?'':' (inactive)'}`};
}
export function setRelationship(m:ModelItem,index:number,patch:{cardinality?:Cardinality;active?:boolean}):ModelEdit{
 const next=copy(m),r=next.relationships[index];if(!r)throw new Error('That relationship no longer exists.');
 Object.assign(r,patch);return {item:next,label:`Changed relationship ${r.from} → ${r.to}`};
}
export function removeRelationship(m:ModelItem,index:number):ModelEdit{
 const r=m.relationships[index];if(!r)throw new Error('That relationship no longer exists.');
 const next=copy(m);next.relationships.splice(index,1);return {item:next,label:`Removed relationship ${r.from} → ${r.to}`};
}

export function addMeasure(m:ModelItem,raw:string,home?:string):ModelEdit{
 const name=clean(raw);
 if(!name)throw new Error('A measure needs a name.');
 if(name.length>120)throw new Error('Measure names are limited to 120 characters.');
 if(m.measures.some(x=>x.name===name))throw new Error(`There is already a measure called ${name}.`);
 if(m.measures.length>=100)throw new Error('A model can hold at most 100 measures.');
 if(home)table(m,home);
 const next=copy(m);next.measures.push({name,...(home?{table:home}:{})});return {item:next,label:`Added measure ${name}`};
}
export function removeMeasure(m:ModelItem,name:string):ModelEdit{
 const next=copy(m);next.measures=next.measures.filter(x=>x.name!==name);return {item:next,label:`Removed measure ${name}`};
}

/** All "Table.Column" references, keys first, for relationship pickers. */
export function columnRefs(m:ModelItem):string[]{
 return m.tables.flatMap(t=>[...t.columns].sort((a,b)=>(a.key?0:1)-(b.key?0:1)).map(c=>`${t.name}.${c.name}`));
}
