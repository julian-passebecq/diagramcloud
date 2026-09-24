import {publicPack,type ExperiencePack,type ExperienceItem,type ExperienceWorkspace} from './model';
export const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const colors=['#2864a8','#188b80','#875bb5','#bb6b24','#516e79','#8c4a63'];
const svg=(body:string,w=640,h=260)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;
const txt=(x:number,y:number,s:unknown,size=12,fill='#475569')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}">${escape(s)}</text>`;
export function chartSvg(p:ExperiencePack,i:Extract<ExperienceItem,{type:'chart'}>):string{
 const table=p.items.find(t=>t.id===i.dataItemId);if(table?.type!=='table'||!table.rows.length)return svg(txt(30,120,'No display data'));
 const li=table.columns.indexOf(i.labelColumn),vi=i.valueColumns.map(x=>table.columns.indexOf(x));const values=table.rows.flatMap(r=>vi.map(v=>Number(r[v])));
 const min=Math.min(0,...values),max=Math.max(1,...values),span=max-min;
 const X=60,Y=38,W=560,H=165,step=W/table.rows.length;
 const yy=(v:number)=>Y+H-(v-min)/span*H,zero=yy(0);
 let out=`<rect width="640" height="260" fill="white"/>${txt(8,18,i.unit,11)}`;
 for(let k=0;k<=4;k++){const v=min+span*k/4,y=yy(v);out+=`<path d="M${X} ${y}H620" stroke="#e4e9ef"/>${txt(5,y+4,Math.round(v*100)/100,11)}`;}
 i.valueColumns.forEach((c,j)=>{out+=`<rect x="${60+j*145}" y="244" width="9" height="9" fill="${colors[j]}"/>${txt(73+j*145,252,c,10)}`;});
 table.rows.forEach((r,k)=>{const x=X+k*step+step/2;out+=txt(x-13,223,String(r[li]).slice(0,16),10);});
 vi.forEach((col,j)=>{const color=colors[j];if(i.chartType==='line'){
  const points=table.rows.map((r,k)=>`${X+k*step+step/2},${yy(Number(r[col]))}`).join(' ');out+=`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"/>`;
  table.rows.forEach((r,k)=>{out+=`<circle cx="${X+k*step+step/2}" cy="${yy(Number(r[col]))}" r="3" fill="${color}"/>`;});
 }else table.rows.forEach((r,k)=>{const width=Math.max(1,step*.72/vi.length),v=Number(r[col]);out+=`<rect x="${X+k*step+step*.14+j*width}" y="${Math.min(zero,yy(v))}" width="${Math.max(1,width-3)}" height="${Math.abs(zero-yy(v))}" rx="2" fill="${color}"/>`;});});return svg(out);
}
export function ganttSvg(i:Extract<ExperienceItem,{type:'gantt'}>):string{
 const start=Math.min(...i.tasks.map(t=>Date.parse(t.start))),end=Math.max(...i.tasks.map(t=>Date.parse(t.end))),duration=Math.max(86400000,end-start),height=60+i.tasks.length*38;
 let out=`<rect width="640" height="${height}" fill="white"/>${txt(180,20,new Date(start).toISOString().slice(0,10),11)}${txt(544,20,new Date(end).toISOString().slice(0,10),11)}`;
 for(let k=0;k<6;k++)out+=`<path d="M${180+k*84} 30V${height-5}" stroke="#e4e9ef"/>`;
 i.tasks.forEach((t,k)=>{const y=45+k*38,x=180+(Date.parse(t.start)-start)/duration*420,w=Math.max(3,(Date.parse(t.end)-Date.parse(t.start))/duration*420);out+=txt(8,y+15,t.label.slice(0,25));out+=`<rect x="${x}" y="${y}" width="${w}" height="21" rx="3" fill="#d6e5f5"/><rect x="${x}" y="${y}" width="${w*t.progress/100}" height="21" rx="3" fill="#2864a8"/>`;});return svg(out,640,height);
}
export function itemBody(p:ExperiencePack,i:ExperienceItem):string{
 switch(i.type){
  case 'code':return `${i.file?`<div class="xp-file">${escape(i.file)}</div>`:''}<pre><code>${escape(i.code)}</code></pre>`;
  case 'table':return `<div class="xp-table-wrap"><table><thead><tr>${i.columns.map(c=>`<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${i.rows.map(r=>`<tr>${r.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  case 'kpi':return `<div class="xp-kpi">${escape(i.value)} <small>${escape(i.unit)}</small></div><p>${escape(i.note)}</p>`;
  case 'chart':return `${chartSvg(p,i)}<small>Display data: ${escape(i.dataItemId)}. No live query.</small>`;
  case 'gantt':return ganttSvg(i);
  case 'image':return `<img src="${i.data}" alt="${escape(i.caption)}"/><p>${escape(i.caption)}</p><small>${escape(i.rights)}</small>`;
  default:return `<p class="xp-note">${escape(i.text)}</p>`;
 }
}
export function itemSvg(p:ExperiencePack,i:ExperienceItem):string{
 if(i.type==='chart')return chartSvg(p,i);if(i.type==='gantt')return ganttSvg(i);
 if(i.type==='image')return svg(`<image href="${i.data}" width="640" height="400" preserveAspectRatio="xMidYMid meet"/>`,640,400);
 const lines=i.type==='code'?i.code.split('\n'):i.type==='table'?[i.columns.join(' | '),...i.rows.map(r=>r.join(' | '))]:i.type==='kpi'?[`${i.value} ${i.unit}`,i.note]:i.text.split('\n');
 const wrapped=lines.flatMap(l=>l.match(/.{1,88}/g)||['']);const h=90+wrapped.length*19;
 return svg(`<rect width="900" height="${h}" rx="12" fill="white" stroke="#d9e2ee"/>${txt(24,32,i.title,20,'#172b45')}${txt(24,54,`${i.type} | ${i.provenance} | ${i.approval}`,11)}${wrapped.map((l,k)=>txt(24,84+k*19,l,13)).join('')}`,900,h);
}
export const workspaceStyles=`
.xp{color:#203147;font:14px/1.5 system-ui,sans-serif;min-width:0}.xp *{box-sizing:border-box}.xp button,.xp select{font:inherit}.xp button{cursor:pointer;border:1px solid #c6d2e0;background:white;color:#20476d;border-radius:6px;padding:6px 10px}.xp button:disabled{opacity:.4;cursor:default}.xp-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:12px 0}.xp-shell{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px}.xp-nav{border-right:1px solid #d8e1eb;padding-right:12px}.xp-nav button{display:block;width:100%;text-align:left;margin:5px 0;overflow-wrap:anywhere}.xp-nav .active{background:#e8f1fb;border-color:#2864a8}.xp-breadcrumb{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.xp-board{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:76px;gap:12px;background:#edf2f7;padding:16px;border-radius:12px}.xp-card{display:flex;flex-direction:column;min-width:0;min-height:0;background:white;border:1px solid #d4dee9;border-radius:9px;overflow:hidden}.xp-card h3{font-size:15px;margin:0}.xp-card-head{padding:12px 14px 8px;border-bottom:1px solid #e7edf3}.xp-card-body{overflow:auto;padding:12px 14px;min-height:0;flex:1}.xp-card-foot{font-size:11px;border-top:1px solid #e7edf3;padding:6px 12px;color:#59708a;display:flex;gap:6px;flex-wrap:wrap}.xp-card-foot button{padding:2px 6px;font-size:11px}.xp-badge{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#59708a}.xp-alert{padding:10px 14px;border-left:3px solid #bb7b27;background:#fff8e9;font-size:12px}.xp small{color:#596b80}.xp-note{white-space:pre-wrap}.xp-file{font-family:monospace;font-size:11px;padding:6px;background:#eaf0f6;overflow-wrap:anywhere}.xp pre{margin:0;padding:12px;background:#16283e;color:#e5eef9;white-space:pre;overflow:auto;font:12px/1.6 ui-monospace,monospace}.xp-table-wrap{overflow:auto}.xp table{border-collapse:collapse;width:100%;font-size:12px}.xp th,.xp td{padding:7px;text-align:left;border-bottom:1px solid #e4eaf1;white-space:nowrap}.xp th{background:#edf3f8}.xp svg,.xp img{max-width:100%;height:auto;display:block}.xp-kpi{font-size:34px;font-weight:650;color:#1f4e78}.xp-kpi small{font-size:16px}.xp-json{width:100%;min-height:240px;font:12px/1.5 monospace;resize:vertical}.xp-selected{outline:2px solid #2864a8}.xp-dialog{width:94vw;max-width:1700px}.xp-source{font:11px/1.4 monospace;overflow-wrap:anywhere}.xp-focus .xp-card{grid-column:1/-1!important;grid-row:auto!important;min-height:220px}.xp-map{display:flex;flex-wrap:wrap;gap:12px}.xp-map button{padding:18px;text-align:left;min-width:180px;max-width:260px;flex:1}.xp-map strong,.xp-map small{display:block}.xp-error{white-space:pre-wrap;color:#9b1c26}.xp-spacer{flex:1}
@media(max-width:800px){.xp-shell{grid-template-columns:1fr}.xp-nav{border:0}.xp-board{display:block;padding:8px}.xp-card{margin-bottom:12px;min-height:220px}.xp-dialog{width:98vw}}
@media print{.xp-nav,.xp-toolbar,.xp-breadcrumb,.xp-card-foot button,.xp-alert{display:none!important}.xp-shell{display:block}.xp-board{display:block;background:white;padding:0}.xp-card{margin:12px 0;break-inside:avoid;overflow:visible}.xp-card-body{overflow:visible}.xp pre{white-space:pre-wrap}.xp table{font-size:10px}.xp th,.xp td{white-space:normal}.xp svg{max-height:300px}.xp-dialog{position:static!important;width:100%!important;max-height:none!important;overflow:visible!important}.modal-heading{display:none!important}}
`;
export function workspaceHtml(input:ExperiencePack,workspaceId:string):string{
 const p=publicPack(input),w=p.workspaces.find(w=>w.id===workspaceId);if(!w)throw new Error('Workspace is not approved for public export');
 const panel=(s:ExperienceWorkspace['placements'][number])=>{const i=p.items.find(i=>i.id===s.itemId)!;return `<article class="xp-card" style="grid-column:${s.x+1}/span ${s.w};grid-row:${s.y+1}/span ${s.h}"><header class="xp-card-head"><h3>${escape(i.title)}</h3><small>${escape(i.provenance)}</small></header><div class="xp-card-body">${itemBody(p,i)}</div></article>`;};
 const srcIds=new Set(w.placements.flatMap(s=>p.items.find(i=>i.id===s.itemId)?.sourceIds||[]));
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(w.title)}</title><style>body{margin:24px;background:white}${workspaceStyles}</style></head><body class="xp"><section data-document-role="page" data-label="${escape(w.title)}"><h1>${escape(w.title)}</h1><p>${escape(w.description)}</p><p>Reconstructed project workspace. Data and code are displayed examples, not live execution or proof of deployment.</p><div class="xp-board">${w.placements.map(panel).join('')}</div><h2>Sources and provenance</h2>${p.sources.filter(s=>srcIds.has(s.id)).map(s=>`<p class="xp-source">${escape(s.title)} - ${escape(s.locator)}${s.page?' - page '+s.page:''}${s.revision?' - revision '+escape(s.revision):''}</p>`).join('')}</section></body></html>`;
}
