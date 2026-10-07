import type {DesignTheme,DesignType,Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {orderedViews} from '../drawio';
import {xml} from '../diagram';
import {DESIGN_TYPE_LABEL,designSvg,resolveDesignType} from './index';

/**
 * Figure book: one static HTML page with every public view (drilldown order) drawn as its Diagram Design figure, from
 * the view's hint unless a type or theme is forced. Offline (CSP default-src 'none', no script, system fonts); every
 * figure is the same SVG the figure export produces, so its title, description and IDs stay unique per view.
 */
export function designBookHtml(input:Project,options:{type?:DesignType;theme?:DesignTheme;now?:Date}={}):string{
 const now=options.now??new Date(),d=publicDocument(input),views=orderedViews(d);
 const figures=views.map((v,i)=>{const type=resolveDesignType(input,v.id,options.type);
  return `<section id="fig-${xml(v.id)}" aria-labelledby="h-${xml(v.id)}"><h2 id="h-${xml(v.id)}"><span>${String(i+1).padStart(2,'0')}</span> ${xml(v.title)}</h2>${designSvg(input,v.id,{type,theme:options.theme,now})}<p class="cap">${xml(DESIGN_TYPE_LABEL[type])} · view <code>${xml(v.id)}</code></p></section>`;}).join('\n');
 const toc=views.map((v,i)=>`<li><a href="#fig-${xml(v.id)}">${String(i+1).padStart(2,'0')} · ${xml(v.title)}</a></li>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="generator" content="DiagramCloud Diagram Design figure book"><title>${xml(d.title)} · Figures</title><style>
:root{color-scheme:light dark;--paper:#f5f5f5;--ink:#2d3142;--muted:#4f5d75;--accent:#eb6c36;--rule:rgba(45,49,66,.12)}
@media (prefers-color-scheme:dark){:root{--paper:#23263a;--ink:#f5f5f5;--muted:#bfc0c0;--rule:rgba(245,245,245,.12)}}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif}
main{max-width:1500px;margin:0 auto;padding:40px 16px}
header p{color:var(--muted);max-width:70ch}h1{font:400 40px/1.1 'Iowan Old Style',Georgia,serif;margin:0 0 8px}
.eyebrow{font:600 11px ui-monospace,Consolas,monospace;letter-spacing:.14em;color:var(--accent);text-transform:uppercase}
nav ol{columns:2;list-style:none;padding-left:0;color:var(--muted)}nav a{color:inherit}
section{margin:48px 0;border-top:1px solid var(--rule);padding-top:24px}h2{font:600 18px system-ui,sans-serif}h2 span{font:600 12px ui-monospace,monospace;color:var(--accent);margin-right:8px}
section svg{display:block;width:100%;height:auto;border-radius:8px;border:1px solid var(--rule)}.cap{font:12px ui-monospace,monospace;color:var(--muted)}
footer{color:var(--muted);font-size:12px;border-top:1px solid var(--rule);padding-top:16px}
@media print{section{break-inside:avoid;page-break-inside:avoid}nav{display:none}}
</style></head><body><main>
<header><p class="eyebrow">Diagram Design · figure book</p><h1>${xml(d.title)}</h1>${d.summary?`<p>${xml(d.summary)}</p>`:''}</header>
<nav aria-label="Figures"><ol>${toc}</ol></nav>
${figures}
<footer>${views.length} public view(s) · generated ${now.toISOString().slice(0,16).replace('T',' ')} UTC · public content only · visual grammar adapted from diagram-design (MIT).</footer>
</main></body></html>
`;
}
