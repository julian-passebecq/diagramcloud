import {validatePublicationBrief,type PublicationBrief} from '../intelligence/publicationBrief';
import {svgDiagram} from './diagram';
import {styledSvg} from './styled';
import type {Project,EvidenceBlock} from '../core/model';
import {publicDocument} from '../core/operations';
import {viewSpec,PERSPECTIVE_LABEL,type ViewSpec} from '../core/viewspec';
import {xml} from './diagram';
import {orderedViews} from './drawio';
import {editorialSvg} from './styled';
import {DESIGN_TYPE_LABEL,designSvg,resolveDesignType} from './design';
import {publicationPages,publicationPageProject,scopePublicationSvg} from './publicationPages';
import {rasterAvailable} from './rasterDimensions';

/**
 * Technical Manual publication preset: one static HTML file that reads on screen and prints to PDF (one section per
 * view, page breaks, running header). Built from publicDocument and the view spec, so the manual and every other
 * export say the same thing. The cover carries what a reader needs to trust it: snapshot, revision vector, generated
 * time, audience, provenance and omissions. No script, no network, system fonts.
 */
const BASIS_LABEL:Record<string,string>={'static-source':'read from source',planned:'planned',unknown:'unknown',unspecified:'not stated'};
const cell=(v:unknown)=>v===null||v===undefined?'':xml(v);
const table=(head:string[],rows:unknown[][],label:string)=>rows.length?`<table aria-label="${xml(label)}"><thead><tr>${head.map(h=>`<th>${xml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p class="muted">None.</p>';
const PROVENANCE:Record<string,string>={synthetic:'Synthetic example',source:'From a source','source-derived':'Derived from a source',authored:'Authored'};

function block(b:EvidenceBlock,d:Project):string{
 const head=`<h4 id="block-${xml(b.id)}">${xml(b.title||b.id)} <span class="tag">${xml(PROVENANCE[b.provenance]??b.provenance)}</span></h4>`;
 switch(b.type){
  case 'text':return `${head}<p>${xml(b.text)}</p>`;
  case 'code':return `${head}<pre><code data-language="${xml(b.language)}">${xml(b.code)}</code></pre><p class="muted">Displayed code, not executed.</p>`;
  case 'table':return head+table(b.columns,b.rows,b.title||b.id);
  case 'metrics':return head+table(['Measure','Value','Note'],b.items.map(i=>[i.label,i.value,i.note]),b.title||b.id);
  case 'image':{const asset=d.assets.find(a=>a.id===b.assetId);return asset?`${head}<figure class="evidence-image">${rasterAvailable(asset.data)?`<img src="${xml(asset.data)}" alt="${xml(b.caption||asset.name)}">`:'<p class="muted">Image unavailable: raster container or dimensions are invalid. Caption and recorded rights retained.</p>'}<figcaption>${b.caption?`${xml(b.caption)} · `:''}${xml(asset.name)}<br>Recorded rights: ${xml(asset.rights||'Not supplied.')}</figcaption></figure>`:`${head}<p class="muted">Image unavailable in this public projection.</p>`;}
 }
}

/** A view with a Diagram Design hint is printed as that figure (dark falls back to light on paper); others get the numbered editorial figure. */
function figure(d:Project,spec:ViewSpec,index:number,now:Date,profile?:PublicationBrief['profile']):string{
 if(profile==='business')return '<p class="muted">Business sheet: supplied contributions and architecture below; runtime outcomes require external evidence.</p>';
 if(profile==='classic'||profile==='blueprint')return `<figure>${profile==='classic'?svgDiagram(d,spec.viewId,false):styledSvg(d,spec.viewId,'blueprint',now)}<figcaption>Figure ${index+1}. ${xml(spec.title)} · ${profile}. Planned/static facts remain distinct from observations.</figcaption></figure>`;
 if(profile==='editorial')return `<figure>${editorialSvg(d,spec.viewId,now).replace(/ed-arrow/g,`ed-arrow-${index}`)}<figcaption>Figure ${index+1}. ${xml(spec.title)} · Editorial.</figcaption></figure>`;
 const hint=publicDocument(d).views.find(v=>v.id===spec.viewId)?.design;
 if(profile==='design'&&!hint)return `<figure>${designSvg(d,spec.viewId,{type:'architecture',theme:'light',now})}<figcaption>Figure ${index+1}. ${xml(spec.title)} · Architecture, the selected default design figure.</figcaption></figure>`;
 if(hint){const type=resolveDesignType(d,spec.viewId,hint.type);
  return `<figure>${designSvg(d,spec.viewId,{type,theme:hint.theme==='editorial'?'editorial':'light',now})}<figcaption>Figure ${index+1}. ${xml(spec.title)}. ${xml(DESIGN_TYPE_LABEL[type])} figure, as chosen for this view; the tables below list every component and connection.</figcaption></figure>`;}
 return `<figure>${editorialSvg(d,spec.viewId,now).replace(/ed-arrow/g,`ed-arrow-${index}`)}<figcaption>Figure ${index+1}. ${xml(spec.title)}. Numbers match the component table.</figcaption></figure>`;
}

function section(d:Project,spec:ViewSpec,index:number,now:Date,brief?:PublicationBrief,selectedViewIds?:string[]):string{
 const label=(id:string)=>spec.nodes.find(n=>n.id===id)?.label??id;
 const trail=spec.path.map(p=>xml(p.title)).join(' › ');
 const pages=publicationPages(d,spec.viewId,selectedViewIds,{profile:brief?.profile,paper:brief?.paper});
 const contextEdges=brief?.profile==='business'?spec.edges:pages.contextEdges;
 const pageOf=(id:string)=>pages.pages.findIndex(p=>p.nodeIds.includes(id))+1;
 const pagedFigure=pages.dense?`<p class="omission">${xml(pages.reason)} All ${spec.nodes.length} public components are shown across ${pages.pages.length} pages. ${brief?.profile==='business'?0:pages.ledger.edges.shown.length} connections are drawn; ${contextEdges.length} are collapsed into the keyed context table. Zero public components or connections omitted by pagination. ${brief?.profile==='business'?'The selected business profile uses textual component and connection tables.':'Dense pages use the selected profile; a specialized design hint falls back to Architecture for bounded membership.'}</p>${pages.details.length?`<p>Existing child details (preferred): ${pages.details.map(detail=>detail.selected?`<a href="#view-${xml(detail.viewId)}">${xml(detail.title)}</a>`:`${xml(detail.title)} (outside the selected chapters; not expanded)`).join('; ')}.</p>`:''}${pages.pages.map((page,j)=>{const projected=publicationPageProject(d,pages,j),pageSpec=viewSpec(projected,spec.viewId,{now});return `<article class="publication-page" data-publication-page="${j+1}" aria-label="${xml(spec.title)} page ${j+1}"><h4>Page ${j+1} of ${pages.pages.length} · ${xml(spec.title)}</h4>${scopePublicationSvg(figure(projected,pageSpec,index,now,brief?.profile??(d.views.find(v=>v.id===spec.viewId)?.design?'design':'editorial')),`chapter-${index}-page-${j}`)}<p class="muted">Shown component IDs: ${page.nodeIds.map(xml).join(', ')||'none'}. Drawn connection IDs: ${page.edgeIds.map(xml).join(', ')||'none'}. ${spec.nodes.length-page.nodeIds.length} components are on other pages; connections absent from this figure remain in the full connection table.</p></article>`;}).join('')}<h3>Connections across pages and deferred bands</h3>${table(['Connection ID','From ID / page','To ID / page','Label','Type','Basis','Amount','Unit','Provenance'],contextEdges.map(e=>[e.id,`${e.from} / ${pageOf(e.from)}`,`${e.to} / ${pageOf(e.to)}`,e.label,e.kind,BASIS_LABEL[e.basis??'unspecified'],e.quantity?.value,e.quantity?.unit,e.quantity?.provenance]),`Keyed connection context of ${spec.title}`)}`:figure(d,spec,index,now,brief?.profile);
 return `<section class="view" id="view-${xml(spec.viewId)}" aria-labelledby="h-${xml(spec.viewId)}">
<p class="eyebrow">${index+1} · ${xml(PERSPECTIVE_LABEL[spec.perspective])} perspective · view <code>${xml(spec.viewId)}</code></p>
<h2 id="h-${xml(spec.viewId)}">${xml(spec.title)}</h2>
${spec.path.length>1?`<p class="trail">Reached from: ${trail}</p>`:''}${spec.purpose?`<p>${xml(spec.purpose)}</p>`:''}
${pagedFigure}
<h3>Components</h3>${brief?.detail==='overview'?table(['Component','Basis'],spec.nodes.map(n=>[n.label,BASIS_LABEL[n.basis??'unspecified']]),`Components of ${spec.title}`):table(['#','ID','Component','Type','Provider','Basis','Confidence','Opens','Backed by'],spec.nodes.map((n,i)=>[i+1,n.id,n.label,n.kind,n.provider,BASIS_LABEL[n.basis??'unspecified'],n.confidence??'',n.opens?d.views.find(v=>v.id===n.opens)?.title??n.opens:'',[n.sourceRefs.length?`${n.sourceRefs.length} source(s)`:'',n.evidenceRefs.length?`${n.evidenceRefs.length} evidence block(s)`:''].filter(Boolean).join(', ')||'—']),`Components of ${spec.title}`)}
<h3>Connections</h3>${pages.dense?table(['ID','From','To','Label','Type','Basis','Amount','Unit','Provenance'],spec.edges.map(e=>[e.id,label(e.from),label(e.to),e.label,e.kind,BASIS_LABEL[e.basis??'unspecified'],e.quantity?.value,e.quantity?.unit,e.quantity?.provenance]),`Connections of ${spec.title}`):table(['From','To','Label','Type','Basis'],spec.edges.map(e=>[label(e.from),label(e.to),e.label,e.kind,BASIS_LABEL[e.basis??'unspecified']]),`Connections of ${spec.title}`)}
${spec.nodes.some(n=>n.observation)?`<h3>Observed</h3>${table(['Component','Claim','Source app','Observed','Source revision'],spec.nodes.filter(n=>n.observation).map(n=>[n.label,n.observation!.claim,n.observation!.sourceApp,n.observation!.observedAt.slice(0,10),n.observation!.sourceRevision]),`Observations in ${spec.title}`)}`:''}
${spec.omissions.length?`<p class="omission">${spec.omissions.map(xml).join(' ')}</p>`:''}
</section>`;
}

export function technicalManualHtml(input:Project,options:{now?:Date;viewIds?:string[];brief?:PublicationBrief}={}):string{
 const now=options.now??new Date(),d=publicDocument(input),allViews=orderedViews(d),brief=options.brief?validatePublicationBrief(options.brief,input):undefined;
 if(brief)options={...options,viewIds:brief.viewIds};
 if(options.viewIds?.some(id=>!allViews.some(v=>v.id===id)))throw new Error('Curated manual references an unavailable public view');
 const views=options.viewIds?allViews.filter(v=>options.viewIds!.includes(v.id)):allViews;
 // From the input: the spec builds the public document itself and can then say what it removed.
 const specs=views.map(v=>viewSpec(input,v.id,{now}));
 const snap=d.atlas?.snapshots.find(s=>s.id===d.atlas!.activeSnapshotId);
 const usedBlocks=new Set(specs.flatMap(s=>s.nodes.flatMap(n=>n.evidenceRefs))),blocks=brief&&brief.detail!=='full'?[]:d.blocks.filter(b=>usedBlocks.has(b.id));
 const usedSources=new Set([...specs.flatMap(spec=>spec.nodes.flatMap(n=>n.sourceRefs)),...blocks.flatMap(b=>b.sourceIds)]),selectedSources=options.viewIds?d.sources.filter(s=>usedSources.has(s.id)):d.sources;
 const omitted=[...new Set(specs.flatMap(s=>s.omissions))];
 if(options.viewIds&&allViews.length>views.length)omitted.push(`${allViews.length-views.length} public view(s) omitted by the selected publication brief.`);
 const fullViews=input.views.length-d.views.length;if(fullViews>0)omitted.unshift(`${fullViews} private or unreachable view(s) removed.`);
 const bases=[...new Map(specs.flatMap(s=>s.nodes).map(n=>[n.id,n])).values()].reduce<Record<string,number>>((a,n)=>{a[n.basis??'unspecified']=(a[n.basis??'unspecified']??0)+1;return a;},{});
 const generated=now.toISOString().replace('T',' ').slice(0,16)+' UTC';
 const cover=`<header class="cover">
<p class="eyebrow">Technical manual</p><h1>${xml(brief?.title||d.title)}</h1>${brief?.audience?`<p>Audience: ${xml(brief.audience)} · detail ${brief.detail} · profile ${brief.profile}</p>`:''}${d.summary?`<p class="lead">${xml(d.summary)}</p>`:''}
<table class="facts" aria-label="Publication record"><tbody>
<tr><th>Project ID</th><td><code>${xml(d.id)}</code> · document revision ${d.revision}</td></tr>
<tr><th>Snapshot</th><td>${snap?`<code>${xml(snap.id)}</code> captured ${xml(snap.capturedAt.slice(0,16).replace('T',' '))} UTC`:'No project atlas: this document has no snapshot.'}</td></tr>
<tr><th>Revision vector</th><td>${snap?.repositories.length?snap.repositories.map(r=>`${xml(r.title)} <code>${xml(r.revision?r.revision.slice(0,12):'unknown')}</code>${r.ref?` (${xml(r.ref)})`:''} · ${xml(r.scanStatus)}`).join('<br>'):'Not recorded.'}</td></tr>
<tr><th>Generated</th><td>${generated}</td></tr>
<tr><th>Audience</th><td>Public: built from the public document; private items are removed, not hidden.</td></tr>
<tr><th>Provenance</th><td>${xml(d.provenance||'Not stated.')}</td></tr>
<tr><th>Basis of components</th><td>${Object.entries(bases).map(([b,n])=>`${n} ${xml(BASIS_LABEL[b])}`).join(' · ')||'—'}. Planned is intent, read from source is static evidence; neither is runtime proof.</td></tr>
<tr><th>Omissions</th><td>${omitted.length?omitted.map(xml).join('<br>'):'None.'}</td></tr>
</tbody></table></header>`;
 const contents=`<nav class="contents" aria-label="Contents"><h2>Contents</h2><ol>${specs.map(s=>`<li><a href="#view-${xml(s.viewId)}">${xml(s.title)}</a> <span class="muted">${xml(PERSPECTIVE_LABEL[s.perspective])} · ${s.nodes.length} components</span></li>`).join('')}${blocks.length?'<li><a href="#evidence">Evidence</a></li>':''}${selectedSources.length?'<li><a href="#sources">Sources</a></li>':''}</ol></nav>`;
 const evidence=blocks.length?`<section class="appendix" id="evidence" aria-labelledby="h-evidence"><h2 id="h-evidence">Evidence</h2><p class="muted">Synthetic examples stay labelled as such; they never support an observed claim.</p>${blocks.map(b=>block(b,d)).join('')}</section>`:'';
 const sources=selectedSources.length?`<section class="appendix" id="sources" aria-labelledby="h-sources"><h2 id="h-sources">Sources</h2>${table(['ID','Title','Location','Link'],selectedSources.map(s=>[s.id,s.title,s.location,s.url??'']),'Sources')}</section>`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="generator" content="DiagramCloud technical manual"><title>${xml(d.title)} · Technical manual</title><style>
:root{--ink:#16233a;--muted:#5b6b84;--rule:#d6dde8;--paper:#fff;--wash:#f4f6fa;--accent:#1f4fa3}
@media (prefers-color-scheme:dark){:root{--ink:#e6ecf5;--muted:#9fb0c8;--rule:#33415a;--paper:#121a28;--wash:#1a2436;--accent:#8fb4ff}figure svg{background:#fff;border-radius:4px}}
*{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink);font:15px/1.55 Arial,Helvetica,'Liberation Sans',sans-serif}
main{max-width:1040px;margin:0 auto;padding:24px 16px 64px}header.cover,nav.contents,section{background:var(--paper);border:1px solid var(--rule);border-radius:8px;padding:28px clamp(16px,4vw,40px);margin:0 0 20px}
h1{font:700 34px/1.15 Georgia,'Times New Roman',serif;margin:6px 0 10px}h2{font:700 24px/1.2 Georgia,'Times New Roman',serif;margin:4px 0 10px}h3{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:22px 0 8px}h4{margin:18px 0 6px}
.eyebrow{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin:0}.lead{font-size:17px}.muted{color:var(--muted)}.trail{color:var(--muted);font-size:13px}
.tag{font:600 11px Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border:1px solid var(--rule);border-radius:10px;padding:1px 8px;margin-left:6px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0;display:block;overflow-x:auto}th,td{border-bottom:1px solid var(--rule);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600;white-space:nowrap}
.facts{display:table}.facts th{width:180px}code{font:12.5px Consolas,'Courier New',monospace}pre{background:var(--wash);border:1px solid var(--rule);border-radius:6px;padding:12px;overflow-x:auto;white-space:pre}
figure{margin:14px 0}figure svg{display:block;width:100%;height:auto;max-height:640px}figcaption{font-size:12.5px;color:var(--muted);margin-top:6px}
.evidence-image img{display:block;max-width:100%;width:auto;height:auto;max-height:640px;object-fit:contain}
.omission{border-left:3px solid var(--accent);padding:6px 12px;background:var(--wash);font-size:13px}
nav.contents ol{padding-left:22px}nav.contents a{color:var(--accent)}footer{color:var(--muted);font-size:12px;text-align:center}
@page{size:${brief?.paper==='letter'?'letter':brief?.paper==='screen'?'auto':'A4'};margin:16mm 14mm}
@media print{body{background:#fff;color:#000;font-size:11pt}main{max-width:none;padding:0}header.cover,nav.contents,section{border:0;padding:0;margin:0;border-radius:0}
 header.cover,nav.contents{break-after:page}section.view,section.appendix{break-before:page}figure,table,pre{break-inside:avoid}table{display:table;overflow:visible}figure svg{max-height:none}a{color:inherit;text-decoration:none}}
${specs.some(s=>s.nodes.length>40||s.edges.length>100)?'.publication-page{break-inside:avoid;margin-bottom:24px}.publication-page figure svg{max-height:none}@media print{.publication-page+.publication-page{break-before:page}.publication-page figure svg{max-height:220mm}}':''}
</style>${brief?`<body data-publication-detail="${brief.detail}" data-publication-profile="${brief.profile}" data-publication-paper="${brief.paper}">`:'<body>'}<main>${cover}${contents}${specs.map((s,i)=>section(d,s,i,now,brief,views.map(v=>v.id))).join('\n')}${brief?.storyIndices.length?`<section class="appendix"><h2>Selected authored story</h2>${brief.storyIndices.map(i=>d.story[i]).map(step=>`<article><h3>${xml(step.title)}</h3><p>${xml(step.narration)}</p><a href="#view-${xml(step.viewId)}">Open supplied view</a></article>`).join('')}</section>`:''}${evidence}${sources}
<footer>Generated by DiagramCloud on ${generated} from ${xml(d.id)} revision ${d.revision}. Explanatory documentation: planned or designed unless an observation is shown; not live telemetry.</footer></main></body></html>`;
}
