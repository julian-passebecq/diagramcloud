// Vendored from AtlasNote (MIT, Copyright (c) 2026 Knowledge Atlas contributors), src/cheatsheets/validation.mjs at commit d162b31.
// Only change: ASSET_REGISTRY is an empty registry instead of AtlasNote's icon catalogue (DiagramCloud exports never reference assets).
// Used by tests/atlasnote.test.ts to prove exports pass the validator AtlasNote runs before importing a cheatsheet.
const ASSET_REGISTRY=Object.freeze({});
export const CHEATSHEET_LIMITS=Object.freeze({pages:64,blocks:2000,text:1000000,bytes:4*1024*1024,nodes:80,edges:240});
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const marks=['bold','italic','underline','code','key','highlight'];
const roles=['body','title','section','example','caption','key','warning'];
const fail=(at,message)=>{throw Error('Invalid cheatsheet '+at+': '+message);};
function object(v,at){if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail(at,'plain object required');}
function keys(v,allowed,at){object(v,at);for(const k of Object.keys(v))if(!allowed.includes(k))fail(at,'unsupported field '+k);}
function text(v,at,max=20000){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(at,'invalid text');}
function id(v,at){if(typeof v!=='string'||!ID.test(v))fail(at,'invalid stable ID');}
function number(v,at,lo,hi){if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)fail(at,'number outside '+lo+'..'+hi);}
function array(v,at,min,max){if(!Array.isArray(v)||v.length<min||v.length>max)fail(at,'array size outside '+min+'..'+max);}
function choice(v,allowed,at){if(!allowed.includes(v))fail(at,'unsupported value');}
function rich(v,at){if(typeof v==='string'){text(v,at);return;}array(v,at,0,300);for(const [i,r] of v.entries()){keys(r,['text','marks'],at);text(r.text,at+'.'+i);if(r.marks!==undefined){array(r.marks,at,0,marks.length);if(new Set(r.marks).size!==r.marks.length)fail(at,'repeated mark');for(const m of r.marks)choice(m,marks,at);}}}
function frame(f,at,w,h){keys(f,['x','y','width','height'],at);number(f.x,at,0,w);number(f.y,at,0,h);number(f.width,at,1,w);number(f.height,at,1,h);if(f.x+f.width>w+.001||f.y+f.height>h+.001)fail(at,'frame overflows its fixed page/container');}
function style(s,at){if(s===undefined)return;keys(s,['fontSize','lineHeight','minFontSize','overflow','align'],at);if(s.fontSize!==undefined)number(s.fontSize,at,10,72);if(s.minFontSize!==undefined)number(s.minFontSize,at,10,s.fontSize??72);if(s.lineHeight!==undefined)number(s.lineHeight,at,1,2.5);if(s.overflow!==undefined)choice(s.overflow,['shrink','clip','error'],at);if(s.align!==undefined)choice(s.align,['left','center','right'],at);}
export function visitCheatsheetBlocks(blocks,visit,parents=[]){for(const b of blocks){visit(b,parents);if(b.type==='box'&&b.children)visitCheatsheetBlocks(b.children,visit,[...parents,b.id]);}}
/** Full semantic validation precedes rendering, import, state/backup acceptance.
 * Unknown fields are rejected, never stripped. There is no raw-SVG escape hatch. */
export function validateCheatsheet(doc){
 const seenObjects=new Set();let structural=0;
 function inspect(v,depth=0){if(++structural>100000||depth>30)fail('document','structural limit');if(v&&typeof v==='object'){if(seenObjects.has(v))fail('document','cyclic/shared object is not canonical JSON');seenObjects.add(v);if(!Array.isArray(v))object(v,'document');for(const [k,x] of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))fail('document','reserved key');inspect(x,depth+1);}}else if(v!==null&&!['string','number','boolean'].includes(typeof v))fail('document','JSON values only');}
 inspect(doc);
 if(new TextEncoder().encode(JSON.stringify(doc)).length>CHEATSHEET_LIMITS.bytes)fail('document','4 MiB limit');
 keys(doc,['schemaVersion','id','title','subtitle','pageSize','meta','theme','pages'],'document');choice(doc.schemaVersion,['1.0','1.1'],'version');id(doc.id,'document');text(doc.title,'title',240);if(!doc.title.trim())fail('title','empty');if(doc.subtitle!==undefined)text(doc.subtitle,'subtitle',500);
 keys(doc.pageSize,['width','height'],'pageSize');if(doc.pageSize.width!==1200||doc.pageSize.height!==1600)fail('pageSize','1200 x 1600 required');
 if(doc.meta!==undefined){keys(doc.meta,doc.schemaVersion==='1.1'?['audience','goal','difficulty','provenance','preset']:['difficulty','provenance','preset'],'meta');for(const [k,v] of Object.entries(doc.meta))text(v,'meta.'+k,2000);if(doc.meta.preset!==undefined)choice(doc.meta.preset,['summary','architecture','bilingual','vocabulary'],'preset');if(doc.meta.difficulty!==undefined)choice(doc.meta.difficulty,['intro','intermediate','advanced'],'difficulty');}
 if(doc.theme!==undefined){keys(doc.theme,['name','tokens'],'theme');choice(doc.theme.name,['atlas-calm'],'theme');if(doc.theme.tokens!==undefined){keys(doc.theme.tokens,['paper','ink','primary','secondary','line','code','warning','warningFill'],'tokens');for(const v of Object.values(doc.theme.tokens))if(typeof v!=='string'||!/^#[a-f0-9]{6}$/i.test(v))fail('theme','six-digit hex colors only');}}
 array(doc.pages,'pages',1,CHEATSHEET_LIMITS.pages);const allIds=new Set(),outlineIds=new Set();let count=0,characters=0;
 function unique(v,at){id(v,at);if(allIds.has(v))fail(at,'duplicate ID '+v);allIds.add(v);}
 for(const p of doc.pages){keys(p,['id','title','blocks','frames','outline'],'page');unique(p.id,'page');text(p.title,'page title',240);array(p.blocks,'blocks',1,CHEATSHEET_LIMITS.blocks);object(p.frames,'frames');const pageIds=new Set();
  function block(b,parents=[]){if(++count>CHEATSHEET_LIMITS.blocks)fail('blocks','2000-block limit');object(b,'block');unique(b.id,'block');pageIds.add(b.id);style(b.style,b.id);const f=p.frames[b.id];frame(f,b.id,1200,1600);
   if(parents.length){const parent=p.frames[parents.at(-1)];if(f.x<parent.x||f.y<parent.y||f.x+f.width>parent.x+parent.width+.001||f.y+f.height>parent.y+parent.height+.001)fail(b.id,'child outside box');}
   const allowed={text:['text','role'],list:['items','ordered','gap'],box:['variant','title','text','children'],table:['columns','rows','widths'],code:['code','language','title'],divider:[],diagram:b.family==='graph'?['family','layout','preset','nodes','nodeFrames','edges','caption']:['family','preset','direction','items','link','caption'],drawing:['shapes'],icon:['assetKey','alt'],image:['assetKey','alt']};
   if(!Object.hasOwn(allowed,b.type))fail(b.id,'unknown block kind');keys(b,['id','type','style',...allowed[b.type]],b.id);
   if(b.type==='text'){rich(b.text,b.id);if(b.role!==undefined)choice(b.role,roles,b.id);}
   if(b.type==='list'){array(b.items,b.id,1,60);b.items.forEach(v=>rich(v,b.id));if(b.ordered!==undefined&&typeof b.ordered!=='boolean')fail(b.id,'ordered must be boolean');if(b.gap!==undefined)number(b.gap,b.id,0,60);}
   if(b.type==='code'){text(b.code,b.id,100000);text(b.language,b.id,40);if(b.title!==undefined)text(b.title,b.id,200);}
   if(b.type==='box'){if(b.variant!==undefined)choice(b.variant,['note','warning'],b.id);if(b.title!==undefined)rich(b.title,b.id);if(b.text!==undefined)rich(b.text,b.id);if(b.children!==undefined){array(b.children,b.id,0,60);for(const child of b.children)block(child,[...parents,b.id]);}if(b.text===undefined&&!b.children?.length)fail(b.id,'box needs text or children');}
   if(b.type==='table'){array(b.columns,b.id,1,16);b.columns.forEach(v=>rich(v,b.id));array(b.rows,b.id,1,60);for(const row of b.rows){array(row,b.id,b.columns.length,b.columns.length);row.forEach(v=>rich(v,b.id));}if(b.widths!==undefined){array(b.widths,b.id,b.columns.length,b.columns.length);b.widths.forEach(v=>number(v,b.id,.01,1));if(Math.abs(b.widths.reduce((s,v)=>s+v,0)-1)>.001)fail(b.id,'column proportions must sum to one');}}
   if(b.type==='diagram'){
    choice(b.family,['graph','sequence'],b.id);if(b.caption!==undefined)text(b.caption,b.id,300);
    if(b.family==='sequence'){choice(b.preset,['steps','array','stack','queue','linked_list'],b.id);choice(b.direction,['horizontal','vertical'],b.id);array(b.items,b.id,1,20);b.items.forEach(v=>rich(v,b.id));if(b.link!==undefined)choice(b.link,['arrow','none'],b.id);const contentH=f.height-(b.caption?28:0),gap=b.link==='none'?6:28,vertical=b.direction==='vertical';if((vertical?contentH:f.width)-gap*(b.items.length-1)<b.items.length*32||(vertical?f.width-40:contentH)<32)fail(b.id,'sequence frame too small for node and arrow geometry');}
    else {choice(b.layout,['tree','manual'],b.id);if(b.preset!==undefined)choice(b.preset,['tree','dag','flow'],b.id);array(b.nodes,b.id,1,CHEATSHEET_LIMITS.nodes);array(b.edges,b.id,0,CHEATSHEET_LIMITS.edges);object(b.nodeFrames,b.id);const nodes=new Set();
     for(const n of b.nodes){keys(n,['id','label','shape','assetKey'],b.id);id(n.id,b.id);if(nodes.has(n.id))fail(b.id,'duplicate graph node');nodes.add(n.id);rich(n.label,b.id);if(n.shape!==undefined)choice(n.shape,['roundedRect','rect','circle','diamond'],b.id);if(n.assetKey!==undefined&&ASSET_REGISTRY[n.assetKey]?.kind!=='vector')fail(b.id,'unregistered vector icon');frame(b.nodeFrames[n.id],b.id+'/'+n.id,f.width,f.height-(b.caption?28:0));}
     if(Object.keys(b.nodeFrames).length!==nodes.size)fail(b.id,'orphan graph frame');for(const e of b.edges){keys(e,['from','to','label','dashed'],b.id);if(!nodes.has(e.from)||!nodes.has(e.to)||e.from===e.to)fail(b.id,'invalid edge endpoint');if(e.label!==undefined)text(e.label,b.id,100);if(e.dashed!==undefined&&typeof e.dashed!=='boolean')fail(b.id,'dashed must be boolean');}
    }
   }
   if(b.type==='drawing'){array(b.shapes,b.id,1,200);for(const s of b.shapes){choice(s.type,['line','rect','ellipse'],b.id);keys(s,s.type==='line'?['type','x1','y1','x2','y2']:['type','x','y','width','height'],b.id);if(s.type==='line'){number(s.x1,b.id,0,f.width);number(s.x2,b.id,0,f.width);number(s.y1,b.id,0,f.height);number(s.y2,b.id,0,f.height);}else frame({x:s.x,y:s.y,width:s.width,height:s.height},b.id,f.width,f.height);}}
   if(['icon','image'].includes(b.type)){text(b.alt,b.id,300);if(!Object.hasOwn(ASSET_REGISTRY,b.assetKey))fail(b.id,'asset registry key required, not a URL');if(b.type==='icon'&&ASSET_REGISTRY[b.assetKey].kind!=='vector')fail(b.id,'vector icon required');if(b.type==='image'&&ASSET_REGISTRY[b.assetKey].kind!=='local-image')fail(b.id,'audited local image required');}
   characters+=JSON.stringify(b).length;
  }
  for(const b of p.blocks)block(b);if(Object.keys(p.frames).length!==pageIds.size)fail(p.id,'orphan/missing frame');
  array(p.outline,'outline',0,200);const anchors=new Set();for(const a of p.outline){keys(a,['id','label','blockId'],'outline');id(a.id,'anchor');if(anchors.has(a.id)||outlineIds.has(a.id)||allIds.has(a.id))fail(p.id,'duplicate outline anchor');anchors.add(a.id);outlineIds.add(a.id);text(a.label,'outline',240);if(!pageIds.has(a.blockId))fail(p.id,'outline target missing');}
 }
 for(const anchor of outlineIds)if(allIds.has(anchor))fail('outline','anchor collides with block/page ID');
 if(characters>CHEATSHEET_LIMITS.text)fail('document','text budget');return doc;
}
export function validateCheatsheetPage(page){
 if(page.kind!=='cheatsheet'&&page.cheatsheet===undefined)return;
 if(page.kind!=='cheatsheet'||!page.cheatsheet||page.blocks?.length)fail('page','cheatsheet kind, structured document and empty notebook blocks required together');
 validateCheatsheet(page.cheatsheet);
}
