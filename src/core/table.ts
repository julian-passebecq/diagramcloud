import {blockSchema,type EvidenceBlock} from './model';

/**
 * Table evidence authoring. The editor works on a string-cell draft; only a draft that passes blockSchema becomes a
 * block. Kept free of React so the rules are unit-tested and shared by the add and edit paths. This is an
 * example-rows editor, not a spreadsheet: no formulas, no execution, bounded size.
 */
export type TableBlock=Extract<EvidenceBlock,{type:'table'}>;
export type Cell=TableBlock['rows'][number][number];
export type TableDraft={title:string;provenance:EvidenceBlock['provenance'];sourceIds:string[];visibility:EvidenceBlock['visibility'];transform?:EvidenceBlock['transform'];columns:string[];rows:string[][]};
export const MAX_COLUMNS=20,MAX_ROWS=500,MAX_CELL=2000;

/** How a stored cell is shown in an input: null is an empty input. */
export const cellText=(c:Cell)=>c===null?'':String(c);
/** How an input becomes a stored cell: empty is null, a plain number is a number, true/false are booleans, anything else stays text. */
export function parseCell(text:string):Cell{
 const t=text.trim();
 if(!t)return null;
 if(/^-?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/.test(t))return Number(t);
 if(t==='true'||t==='false')return t==='true';
 return text.slice(0,MAX_CELL);
}

export function emptyTable():TableDraft{return {title:'',provenance:'synthetic',sourceIds:[],visibility:'public',columns:['Column 1','Column 2'],rows:[['','']]};}
export function draftOfTable(b:TableBlock):TableDraft{
 return {title:b.title,provenance:b.provenance,sourceIds:[...b.sourceIds],visibility:b.visibility,...(b.transform?{transform:b.transform}:{}),columns:[...b.columns],rows:b.rows.map(r=>r.map(cellText))};
}

const move=<T,>(list:T[],from:number,to:number):T[]=>{if(to<0||to>=list.length||from===to)return list;const out=[...list],[x]=out.splice(from,1);out.splice(to,0,x);return out;};
/** Pure edits; each returns a new draft and refuses to cross the limits. */
export const tableOps={
 addRow:(d:TableDraft,at=d.rows.length):TableDraft=>d.rows.length>=MAX_ROWS?d:{...d,rows:[...d.rows.slice(0,at),d.columns.map(()=>''),...d.rows.slice(at)]},
 removeRow:(d:TableDraft,i:number):TableDraft=>({...d,rows:d.rows.filter((_,n)=>n!==i)}),
 moveRow:(d:TableDraft,i:number,delta:number):TableDraft=>({...d,rows:move(d.rows,i,i+delta)}),
 addColumn:(d:TableDraft,name=`Column ${d.columns.length+1}`,at=d.columns.length):TableDraft=>d.columns.length>=MAX_COLUMNS?d:{...d,columns:[...d.columns.slice(0,at),name,...d.columns.slice(at)],rows:d.rows.map(r=>[...r.slice(0,at),'',...r.slice(at)])},
 removeColumn:(d:TableDraft,j:number):TableDraft=>d.columns.length<=1?d:{...d,columns:d.columns.filter((_,n)=>n!==j),rows:d.rows.map(r=>r.filter((_,n)=>n!==j))},
 renameColumn:(d:TableDraft,j:number,name:string):TableDraft=>({...d,columns:d.columns.map((c,n)=>n===j?name:c)}),
 moveColumn:(d:TableDraft,j:number,delta:number):TableDraft=>j+delta<0||j+delta>=d.columns.length?d:{...d,columns:move(d.columns,j,j+delta),rows:d.rows.map(r=>move(r,j,j+delta))},
 setCell:(d:TableDraft,i:number,j:number,text:string):TableDraft=>({...d,rows:d.rows.map((r,n)=>n===i?r.map((c,m)=>m===j?text.slice(0,MAX_CELL):c):r)})
};

/**
 * Rows pasted from a spreadsheet (tab-separated) or a simple CSV line list. The first line becomes the header when
 * `header` is set. Quotes are honoured for CSV; nothing is evaluated.
 */
export function parseDelimited(text:string,header:boolean):{columns:string[];rows:string[][]}{
 const lines=text.replace(/\r\n?/g,'\n').split('\n').filter(l=>l.trim());
 if(!lines.length)throw new Error('Paste at least one row.');
 const tab=lines[0].includes('\t');
 const split=(l:string)=>{if(tab)return l.split('\t');const out:string[]=[];let cur='',q=false;for(let i=0;i<l.length;i++){const c=l[i];if(q){if(c==='"'&&l[i+1]==='"'){cur+='"';i++;}else if(c==='"')q=false;else cur+=c;}else if(c==='"')q=true;else if(c===','){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;};
 const grid=lines.map(split),width=Math.max(...grid.map(r=>r.length));
 if(width>MAX_COLUMNS)throw new Error(`At most ${MAX_COLUMNS} columns.`);
 const pad=(r:string[])=>[...r,...Array(width-r.length).fill('')].map(c=>c.trim());
 const columns=header?pad(grid[0]).map((c,j)=>c||`Column ${j+1}`):Array.from({length:width},(_,j)=>`Column ${j+1}`);
 const rows=(header?grid.slice(1):grid).map(pad);
 if(rows.length>MAX_ROWS)throw new Error(`At most ${MAX_ROWS} rows.`);
 return {columns,rows};
}

/** Trims names, drops rows left completely empty, and refuses blank or duplicate column names. */
export function tableBlock(d:TableDraft,base:Pick<TableBlock,'id'>):TableBlock{
 const columns=d.columns.map(c=>c.trim());
 columns.forEach((c,j)=>{if(!c)throw new Error(`Column ${j+1}: give it a name.`);if(c.length>160)throw new Error(`Column ${j+1}: names are limited to 160 characters.`);});
 const dup=columns.find((c,j)=>columns.indexOf(c)!==j);if(dup)throw new Error(`Two columns are called “${dup}”. Column names must be distinct.`);
 if(columns.length>MAX_COLUMNS)throw new Error(`At most ${MAX_COLUMNS} columns.`);
 const rows=d.rows.filter(r=>r.some(c=>c.trim())).map(r=>columns.map((_,j)=>parseCell(r[j]??'')));
 if(rows.length>MAX_ROWS)throw new Error(`At most ${MAX_ROWS} rows.`);
 return blockSchema.parse({id:base.id,title:d.title.trim(),type:'table',provenance:d.provenance,sourceIds:d.sourceIds,visibility:d.visibility,...(d.transform?{transform:d.transform}:{}),columns,rows}) as TableBlock;
}

/** A nudge, not a block: example rows without a source read as real data unless they are marked synthetic. */
export function tableWarning(d:Pick<TableDraft,'provenance'|'sourceIds'>):string|null{
 if(d.provenance==='synthetic'||d.sourceIds.length)return null;
 return d.provenance==='source-derived'?'Source-derived rows should link the source they came from.':'These rows are not linked to a source. Mark illustrative rows as synthetic, or link the source they came from.';
}
