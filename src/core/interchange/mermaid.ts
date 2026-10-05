import {documentFromGraph,inferKind,inferProvider,plainLabel,type GraphEdge,type GraphNode,type GraphPage,type ImportResult} from './graph';
import type {ProjectEdge,ProjectNode} from '../model';

/**
 * Mermaid adapter for the two diagram types that describe architecture: `flowchart`/`graph` and `architecture-beta`.
 * Keeps nodes, labels, shapes (as component types), links and their labels, subgraphs/groups (as tags) and the
 * direction; drops styling (classDef, style, linkStyle), click handlers and markdown formatting, and lists them.
 * Other Mermaid types (sequence, class, ER, state, Gantt…) are refused with a clear message, never half-imported.
 */
const SHAPES:[string,string,ProjectNode['kind']|undefined][]=[
 ['(((',')))',undefined],['([','])',undefined],['[(',')]','storage'],['[[',']]','function'],['((','))',undefined],['{{','}}','process'],
 ['[/','/]','source'],['[\\','\\]','source'],['[/','\\]','source'],['[\\','/]','source'],['[',']',undefined],['(',')',undefined],['{','}','control'],['>',']',undefined],
];
const NEW_SHAPES:Record<string,ProjectNode['kind']>={cyl:'storage',cylinder:'storage',db:'storage',database:'storage','lin-cyl':'storage','h-cyl':'storage',das:'storage',diam:'control',diamond:'control',decision:'control',
 subproc:'function',subroutine:'function','fr-rect':'function','lean-r':'source','lean-l':'source','in-out':'source',doc:'storage',docs:'storage',document:'storage',hex:'process',hexagon:'process',prepare:'process',stadium:'process',pill:'process',terminal:'process'};
/** A node ID; a hyphen is part of it only when it does not start a link (`my-node-->b`). */
const ID=String.raw`[\p{L}\p{N}_](?:[\p{L}\p{N}_.]|-(?![-.>=]))*`;

type Parsed={nodes:Map<string,GraphNode>;edges:GraphEdge[];groups:string[];lost:Map<string,number>;direction:'LR'|'TB';title?:string};

/** Read one node reference at the start of `s`: `id`, `id[label]`, `id@{ shape: cyl, label: "x" }`, `id:::class`… */
function readNode(s:string,p:Parsed,group:string|undefined):{key:string;rest:string}|undefined{
 const m=s.match(new RegExp(`^\\s*(${ID})`,'u'));if(!m)return undefined;
 const key=m[1];let rest=s.slice(m[0].length),label:string|undefined,kind:ProjectNode['kind']|undefined;
 if(rest.startsWith('@{')){const end=rest.indexOf('}');const body=rest.slice(2,end<0?undefined:end);rest=end<0?'':rest.slice(end+1);
  const shape=body.match(/shape\s*:\s*"?([\w-]+)/)?.[1];const l=body.match(/label\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]??body.match(/label\s*:\s*([^,}]+)/)?.[1];
  if(shape)kind=NEW_SHAPES[shape];if(l)label=l.trim();}
 else for(const [open,close,k] of SHAPES){
  if(!rest.startsWith(open))continue;
  const after=rest.slice(open.length);let body:string,tail:string;
  if(after.startsWith('"')){const q=after.indexOf('"',1);if(q<0)continue;if(!after.slice(q+1).startsWith(close))continue;body=after.slice(1,q);tail=after.slice(q+1+close.length);}
  else{const c=after.indexOf(close);if(c<0)continue;body=after.slice(0,c);tail=after.slice(c+close.length);}
  label=body;kind=k;rest=tail;break;
 }
 // Shape data may also follow a bracket label: `C[Topic]@{ shape: das }`.
 if(rest.startsWith('@{')){const end=rest.indexOf('}');const shape=rest.slice(2,end<0?undefined:end).match(/shape\s*:\s*"?([\w-]+)/)?.[1];if(shape&&NEW_SHAPES[shape])kind=NEW_SHAPES[shape];rest=end<0?'':rest.slice(end+1);}
 const cls=rest.match(/^:::[\w-]+/);if(cls){rest=rest.slice(cls[0].length);p.lost.set('class assignments',(p.lost.get('class assignments')??0)+1);}
 const existing=p.nodes.get(key);
 if(existing){if(label!==undefined)existing.label=plainLabel(label)||key;if(kind)existing.kind=kind;if(group&&!existing.group)existing.group=group;}
 else p.nodes.set(key,{key,label:label!==undefined?plainLabel(label)||key:key,kind,group});
 return {key,rest};
}
/** A list of node references joined by `&`. */
function readNodes(s:string,p:Parsed,group:string|undefined):{keys:string[];rest:string}|undefined{
 const keys:string[]=[];let rest=s;
 for(;;){const n=readNode(rest,p,group);if(!n)return keys.length?{keys,rest}:undefined;keys.push(n.key);rest=n.rest;const amp=rest.match(/^\s*&\s*/);if(!amp)return {keys,rest};rest=rest.slice(amp[0].length);}
}
/** A link at the start of `s`, with its label in either Mermaid form (`-->|text|` or `-- text -->`). */
function readLink(s:string):{label:string;kind:ProjectEdge['kind'];reverse:boolean;rest:string}|undefined{
 // An edge ID (`A e1@--> B`) names the link for styling only.
 const t=s.replace(/^\s+/,'').replace(/^[\p{L}\p{N}_-]+@(?=[-=<.ox])/u,'');
 const withText=t.match(/^(<?)(--|==|-\.)(?!-|>|=|\.)\s*([^\n]*?)\s*(-{2,}>|-{3,}|={2,}>|={3,}|\.-+>|\.-+)(?=\s|[\p{L}\p{N}_"]|$)/u);
 if(withText&&withText[3]&&!/-->|==>|-\.->/.test(withText[3]))return {label:withText[3],kind:withText[2]==='-.'?'dependency':'batch',reverse:false,rest:t.slice(withText[0].length)};
 const m=t.match(/^(<|o(?=-)|x(?=-))?(-{2,}|={2,}|-\.+-)(>|o(?=\s)|x(?=\s))?/);if(!m||m[0].length<2)return undefined;
 let rest=t.slice(m[0].length),label='';
 const pipe=rest.match(/^\s*\|([^|]*)\|/);if(pipe){label=pipe[1];rest=rest.slice(pipe[0].length);}
 return {label,kind:m[2].includes('.')?'dependency':'batch',reverse:false,rest};
}

function parseFlowchart(lines:string[],p:Parsed){
 const stack:string[]=[];
 for(const [n,raw] of lines.entries()){
  const line=raw.trim();if(!line)continue;
  const sub=line.match(/^subgraph\s+(.+)$/);
  if(sub){const def=sub[1].trim();const m=def.match(new RegExp(`^(${ID})\\s*\\[\\s*"?(.*?)"?\\s*\\]$`,'u'));const name=plainLabel(m?m[2]:def.replace(/^"|"$/g,''));stack.push(name);if(!p.groups.includes(name))p.groups.push(name);continue;}
  if(line==='end'){stack.pop();continue;}
  if(/^direction\s/.test(line)){p.lost.set('subgraph direction statements',(p.lost.get('subgraph direction statements')??0)+1);continue;}
  const skip=line.match(/^(classDef|class|style|linkStyle|click|accTitle|accDescr)\b/);if(skip){p.lost.set(`${skip[1]} statements`,(p.lost.get(`${skip[1]} statements`)??0)+1);continue;}
  const group=stack.at(-1);
  let left=readNodes(line,p,group);if(!left){p.lost.set(`unreadable line(s) (first: line ${n+1})`,(p.lost.get(`unreadable line(s) (first: line ${n+1})`)??0)+1);continue;}
  let rest=left.rest;
  for(;;){
   const link=readLink(rest);if(!link)break;
   const right=readNodes(link.rest,p,group);if(!right)break;
   for(const s of left.keys)for(const t of right.keys)p.edges.push({source:s,target:t,label:plainLabel(link.label.trim().replace(/^"|"$/g,'')),kind:link.kind});
   left=right;rest=right.rest;
  }
  if(rest.trim()&&!/^;?\s*$/.test(rest.trim()))p.lost.set('trailing text after a link',(p.lost.get('trailing text after a link')??0)+1);
 }
}

const ARCH_ICON:Record<string,ProjectNode['kind']>={database:'storage',disk:'storage',internet:'source',server:'process',cloud:'process'};
function parseArchitecture(lines:string[],p:Parsed){
 const groupTitle=new Map<string,string>(),pendingParent:[string,string][]=[];
 for(const [n,raw] of lines.entries()){
  const line=raw.trim();if(!line)continue;
  const decl=line.match(new RegExp(`^(group|service|junction)\\s+(${ID})(?:\\(([^)]*)\\))?(?:\\[([^\\]]*)\\])?(?:\\s+in\\s+(${ID}))?\\s*$`,'u'));
  if(decl){const [,what,id,icon,title,parent]=decl;
   if(what==='group'){const name=plainLabel(title??id);groupTitle.set(id,name);p.groups.push(name);if(parent)pendingParent.push([id,parent]);continue;}
   const iconName=icon??'';const label=what==='junction'?'Junction':plainLabel(title??id);
   p.nodes.set(id,{key:id,label,kind:what==='junction'?'control':ARCH_ICON[iconName]??inferKind(`${label} ${iconName}`),provider:inferProvider(`${iconName.replace(/^logos:/,'')} ${label}`),group:parent});
   if(what==='junction')p.lost.set('junctions imported as small control components',(p.lost.get('junctions imported as small control components')??0)+1);continue;}
  const edge=line.match(new RegExp(`^(${ID})(\\{group\\})?(?::([LRTB]))?\\s*(<)?-(-|\\.)(>)?\\s*(?:([LRTB]):)?(${ID})(\\{group\\})?\\s*$`,'u'));
  if(edge){p.edges.push({source:edge[1],target:edge[8],kind:edge[5]==='.'?'dependency':'batch'});if(edge[3]||edge[7])p.lost.set('edge side hints (L/R/T/B)',(p.lost.get('edge side hints (L/R/T/B)')??0)+1);if(edge[2]||edge[9])p.lost.set('group-to-group edges',(p.lost.get('group-to-group edges')??0)+1);continue;}
  p.lost.set(`unreadable line(s) (first: line ${n+1})`,(p.lost.get(`unreadable line(s) (first: line ${n+1})`)??0)+1);
 }
 // Group membership names the group by its title; a service in a nested group keeps the innermost one.
 for(const node of p.nodes.values())if(node.group)node.group=groupTitle.get(node.group)??node.group;
 if(pendingParent.length)p.lost.set('nested group relations (kept as the inner group only)',pendingParent.length);
}

export const looksLikeMermaid=(raw:string)=>/^\s*(---[\s\S]*?---\s*)?(%%[^\n]*\n\s*)*(flowchart|graph|architecture-beta|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|journey|pie|mindmap|timeline|C4\w+|gitGraph|quadrantChart|sankey|xychart|block-beta|requirementDiagram)\b/.test(raw)||/```mermaid/.test(raw);

export function importMermaid(raw:string,fileName:string,options:{idSuffix?:string;now?:Date}={}):ImportResult{
 // A Markdown file: take the first ```mermaid block.
 let src=raw.replace(/^\uFEFF/,'');const fence=src.match(/```mermaid\s*\n([\s\S]*?)```/);if(fence)src=fence[1];
 let title:string|undefined;
 const front=src.match(/^\s*---\s*\n([\s\S]*?)\n\s*---\s*\n/);if(front){title=front[1].match(/^\s*title\s*:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g,'');src=src.slice(front[0].length);}
 const lines=src.replace(/%%\{[\s\S]*?\}%%/g,'').split(/\r?\n/).map(l=>l.replace(/%%.*$/,'')).flatMap(l=>l.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/));
 const head=lines.findIndex(l=>l.trim());if(head<0)throw new Error('This Mermaid text is empty.');
 const header=lines[head].trim(),type=header.split(/\s+/)[0];
 const p:Parsed={nodes:new Map(),edges:[],groups:[],lost:new Map(),direction:'LR',title};
 if(type==='flowchart'||type==='graph'){const dir=header.split(/\s+/)[1]?.toUpperCase();p.direction=dir==='TD'||dir==='TB'||dir==='BT'?'TB':'LR';if(dir==='BT'||dir==='RL')p.lost.set(`reversed direction (${dir}) drawn as ${p.direction==='TB'?'top-to-bottom':'left-to-right'}`,1);parseFlowchart(lines.slice(head+1),p);}
 else if(type==='architecture-beta')parseArchitecture(lines.slice(head+1),p);
 else throw new Error(`Mermaid “${type}” diagrams are not imported. DiagramCloud imports architecture diagrams: flowchart / graph and architecture-beta.`);
 const page:GraphPage={title:title??'',nodes:[...p.nodes.values()],edges:p.edges,groups:p.groups,direction:p.direction};
 const lost=[...p.lost].map(([what,n])=>/imported as|kept as|drawn as/.test(what)?`${n} ${what}.`:`${n} ${what} not imported.`);
 lost.push('Mermaid has no coordinates: DiagramCloud lays the diagram out in layers; styling and Markdown formatting are not imported.');
 return documentFromGraph([page],{format:'mermaid',fileName,title,lost,...options});
}
