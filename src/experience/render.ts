import {publicPack,type ExperiencePack,type ExperienceItem,type ExperienceWorkspace} from './model';
import {MODEL_HEADER,MODEL_ROW,modelLayout,type ModelItem} from './semantic';

/**
 * One HTML renderer for the in-app report view and the exported mini document, so the export is what
 * the user saw. Everything interpolated is escaped; no script is emitted (tabs are CSS-only radios).
 */
export const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const attr=(s:string)=>s.replace(/[^a-zA-Z0-9_-]/g,'-');
const colors=['#1f5fa8','#34a3d8','#1f9e79','#e0892c','#8a63c9','#cf4a5c'];
export const fmt=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:Math.abs(n)<1?3:Math.abs(n)<10?2:Math.abs(n)<1000?1:0});
const svg=(body:string,w:number,h:number)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" class="xp-svg">${body}</svg>`;
const txt=(x:number,y:number,s:unknown,size=11,fill='#52637a',anchor='start',weight=400)=>`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Segoe UI,Arial,sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${escape(s)}</text>`;
export const clip=(s:unknown,max:number)=>{const v=String(s??'');return v.length>max?v.slice(0,max-1)+'…':v;};

export type RenderOptions={cols?:number;uid?:string};
/** Drawing width from the panel's grid span, so small panels get proportionally larger text. */
const sizeFor=(cols=12)=>cols>=9?{w:760,h:280}:cols>=6?{w:540,h:270}:cols>=4?{w:400,h:250}:{w:300,h:250};

function niceTicks(min:number,max:number,count=4){
 if(min===max){max=min+1;}
 const raw=(max-min)/count,mag=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw)!;
 const lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step,ticks:number[]=[];
 for(let v=lo;v<=hi+step/2;v+=step)ticks.push(Math.round(v*1e6)/1e6);
 return {lo,hi,ticks};
}
function tableFor(p:ExperiencePack,i:Extract<ExperienceItem,{type:'chart'}>){
 const table=p.items.find(t=>t.id===i.dataItemId);
 if(table?.type!=='table'||!table.rows.length)return null;
 return {rows:table.rows,label:table.columns.indexOf(i.labelColumn),values:i.valueColumns.map(c=>table.columns.indexOf(c))};
}
const legend=(names:string[],x:number,y:number,w:number)=>{let out='',cx=x,cy=y;for(const [k,n] of names.entries()){const len=12+Math.min(22,n.length)*6.2+16;if(cx+len>x+w){cx=x;cy+=16;}out+=`<rect x="${cx}" y="${cy-8}" width="9" height="9" rx="2" fill="${colors[k%colors.length]}"/>${txt(cx+13,cy,clip(n,22),10)}`;cx+=len;}return out;};

export function chartSvg(p:ExperiencePack,i:Extract<ExperienceItem,{type:'chart'}>,opts:RenderOptions={}):string{
 const {w,h}=sizeFor(opts.cols),t=tableFor(p,i);
 if(!t)return svg(txt(20,40,'No display data'),w,80);
 if(i.chartType==='donut')return donutSvg(i,t,w,h);
 if(i.chartType==='hbar')return hbarSvg(i,t,w);
 if(i.chartType==='scatter')return scatterSvg(i,t,w,h);
 const names=i.valueColumns,stacked=i.chartType==='stacked';
 const totals=t.rows.map(r=>t.values.reduce((s,v)=>s+Number(r[v]),0));
 const values=stacked?[...totals,...t.rows.flatMap(r=>t.values.map(v=>Number(r[v])))]:t.rows.flatMap(r=>t.values.map(v=>Number(r[v])));
 const {lo,hi,ticks}=niceTicks(Math.min(0,...values),Math.max(0,...values));
 const L=48,R=12,T=names.length>1?30:18,B=34,W=w-L-R,H=h-T-B,step=W/t.rows.length,yy=(v:number)=>T+H-(v-lo)/(hi-lo)*H,zero=yy(0);
 let out=`<rect width="${w}" height="${h}" fill="white"/>`;
 if(names.length>1)out+=legend(names,L,14,W);
 for(const v of ticks)out+=`<path d="M${L} ${yy(v).toFixed(1)}H${w-R}" stroke="#e6ebf1"/>${txt(L-6,yy(v)+4,fmt(v),10,'#6b7b90','end')}`;
 const labelW=Math.min(90,Math.max(...t.rows.map(r=>String(r[t.label]).length))*6.4+10),every=Math.ceil(t.rows.length/Math.max(1,Math.floor(W/labelW)));
 t.rows.forEach((r,k)=>{if(k%every===0)out+=txt(L+k*step+step/2,h-B+16,clip(r[t.label],Math.max(4,Math.floor(step*every/6.5))),10,'#52637a','middle');});
 if(i.chartType==='line'){
  t.values.forEach((col,j)=>{const pts=t.rows.map((r,k)=>[L+k*step+step/2,yy(Number(r[col]))]);const color=colors[j%colors.length];
   if(t.values.length===1)out+=`<path d="M${pts[0][0]} ${zero}L${pts.map(q=>q.join(' ')).join('L')}L${pts.at(-1)![0]} ${zero}Z" fill="${color}" opacity=".12"/>`;
   out+=`<polyline points="${pts.map(q=>q.map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
   pts.forEach(q=>{out+=`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.2" fill="white" stroke="${color}" stroke-width="2"/>`;});});
 }else t.rows.forEach((r,k)=>{
  if(stacked){let acc=0;t.values.forEach((col,j)=>{const v=Number(r[col]),y0=yy(acc),y1=yy(acc+v);acc+=v;out+=`<rect x="${(L+k*step+step*.18).toFixed(1)}" y="${Math.min(y0,y1).toFixed(1)}" width="${(step*.64).toFixed(1)}" height="${Math.abs(y0-y1).toFixed(1)}" fill="${colors[j%colors.length]}"/>`;});
   if(t.rows.length<=14)out+=txt(L+k*step+step/2,yy(totals[k])-5,fmt(totals[k]),10,'#34465e','middle',600);return;}
  const bw=step*.7/t.values.length;
  t.values.forEach((col,j)=>{const v=Number(r[col]),x=L+k*step+step*.15+j*bw;out+=`<rect x="${x.toFixed(1)}" y="${Math.min(zero,yy(v)).toFixed(1)}" width="${Math.max(1,bw-2).toFixed(1)}" height="${Math.abs(zero-yy(v)).toFixed(1)}" rx="2" fill="${colors[j%colors.length]}"/>`;
   if(t.values.length===1&&t.rows.length<=14)out+=txt(x+bw/2-1,yy(v)-5,fmt(v),10,'#34465e','middle',600);});
 });
 return svg(out,w,h);
}
function hbarSvg(i:Extract<ExperienceItem,{type:'chart'}>,t:NonNullable<ReturnType<typeof tableFor>>,w:number){
 if(t.values.length===2)return rangeSvg(i,t,w);
 const col=t.values[0],vals=t.rows.map(r=>Number(r[col])),{hi}=niceTicks(0,Math.max(0,...vals));
 const L=Math.min(160,14+Math.max(...t.rows.map(r=>String(r[t.label]).length))*7),R=50,row=28,h=16+t.rows.length*row;
 let out=`<rect width="${w}" height="${h}" fill="white"/>`;
 t.rows.forEach((r,k)=>{const y=8+k*row,len=Math.max(1,(Number(r[col])/hi)*(w-L-R));out+=txt(L-8,y+15,clip(r[t.label],24),12,'#34465e','end')+`<rect x="${L}" y="${y+3}" width="${len.toFixed(1)}" height="${row-9}" rx="3" fill="${colors[0]}"/>`+txt(L+len+6,y+15,fmt(Number(r[col])),11.5,'#34465e','start',600);});
 return svg(out,w,h);
}
/** Two value columns = low/high range per row around zero, e.g. a sensitivity tornado. */
function rangeSvg(i:Extract<ExperienceItem,{type:'chart'}>,t:NonNullable<ReturnType<typeof tableFor>>,w:number){
 const [a,b]=t.values,lows=t.rows.map(r=>Math.min(Number(r[a]),Number(r[b]))),highs=t.rows.map(r=>Math.max(Number(r[a]),Number(r[b])));
 const {lo,hi,ticks}=niceTicks(Math.min(0,...lows),Math.max(0,...highs));
 const L=Math.min(160,14+Math.max(...t.rows.map(r=>String(r[t.label]).length))*7),R=90,row=26,top=10,h=top+t.rows.length*row+26,xx=(v:number)=>L+(v-lo)/(hi-lo)*(w-L-R);
 let out=`<rect width="${w}" height="${h}" fill="white"/>`;
 for(const v of ticks)out+=`<path d="M${xx(v).toFixed(1)} ${top}V${h-22}" stroke="${v===0?'#8795a8':'#edf1f5'}"/>`+txt(xx(v),h-8,fmt(v),10,'#6b7b90','middle');
 t.rows.forEach((r,k)=>{const y=top+k*row,x0=xx(lows[k]),x1=xx(highs[k]),z=xx(0);
  out+=txt(L-8,y+16,clip(r[t.label],24),12,'#34465e','end');
  out+=`<rect x="${Math.min(x0,z).toFixed(1)}" y="${y+4}" width="${(z-Math.min(x0,z)).toFixed(1)}" height="${row-9}" fill="${colors[1]}"/><rect x="${z.toFixed(1)}" y="${y+4}" width="${Math.max(0,x1-z).toFixed(1)}" height="${row-9}" fill="${colors[0]}"/>`;
  out+=txt(w-R+10,y+16,`${fmt(lows[k])} / ${highs[k]>0?'+':''}${fmt(highs[k])}`,11,'#34465e','start',600);});
 return svg(out,w,h);
}
function donutSvg(i:Extract<ExperienceItem,{type:'chart'}>,t:NonNullable<ReturnType<typeof tableFor>>,w:number,h0:number){
 const col=t.values[0],vals=t.rows.map(r=>Math.max(0,Number(r[col]))),total=vals.reduce((a,b)=>a+b,0)||1,narrow=w<=420;
 const R=narrow?Math.min(92,w/2-24):Math.min(h0/2-14,w*.2),h=narrow?2*R+34+t.rows.length*21:h0,cx=narrow?w/2:R+22,cy=narrow?R+14:h/2,r0=R*.58;
 let out=`<rect width="${w}" height="${h}" fill="white"/>`,a=-Math.PI/2;
 vals.forEach((v,k)=>{const b=a+v/total*Math.PI*2,large=b-a>Math.PI?1:0,p=(ang:number,rad:number)=>`${(cx+Math.cos(ang)*rad).toFixed(2)} ${(cy+Math.sin(ang)*rad).toFixed(2)}`;
  out+=v>=total?`<circle cx="${cx}" cy="${cy}" r="${(R+r0)/2}" fill="none" stroke="${colors[k%colors.length]}" stroke-width="${R-r0}"/>`:`<path d="M${p(a,R)}A${R} ${R} 0 ${large} 1 ${p(b,R)}L${p(b,r0)}A${r0} ${r0} 0 ${large} 0 ${p(a,r0)}Z" fill="${colors[k%colors.length]}" stroke="white" stroke-width="1.5"/>`;a=b;});
 out+=txt(cx,cy+3,fmt(total),20,'#1b2b45','middle',700)+txt(cx,cy+20,i.unit?clip(i.unit,18):'total',11,'#6b7b90','middle');
 const lx=narrow?16:cx+R+26;t.rows.forEach((r,k)=>{const y=narrow?2*R+44+k*21:cy-(t.rows.length*22)/2+k*22+14;out+=`<rect x="${lx}" y="${y-10}" width="11" height="11" rx="2" fill="${colors[k%colors.length]}"/>`+txt(lx+18,y,clip(r[t.label],22),12,'#34465e')+txt(w-12,y,`${fmt(vals[k])} · ${Math.round(vals[k]/total*100)}%`,11.5,'#52637a','end');});
 return svg(out,w,h);
}
function scatterSvg(i:Extract<ExperienceItem,{type:'chart'}>,t:NonNullable<ReturnType<typeof tableFor>>,w:number,h:number){
 const [xc,yc]=t.values,xs=t.rows.map(r=>Number(r[xc])),ys=t.rows.map(r=>Number(r[yc]));
 const X=niceTicks(Math.min(0,...xs),Math.max(...xs)),Y=niceTicks(Math.min(0,...ys),Math.max(...ys)),cats=[...new Set(t.rows.map(r=>String(r[t.label])))];
 const L=48,R=12,T=cats.length>1?30:14,B=36,W=w-L-R,H=h-T-B,xx=(v:number)=>L+(v-X.lo)/(X.hi-X.lo)*W,yy=(v:number)=>T+H-(v-Y.lo)/(Y.hi-Y.lo)*H;
 let out=`<rect width="${w}" height="${h}" fill="white"/>`;if(cats.length>1)out+=legend(cats.slice(0,6),L,14,W);
 for(const v of Y.ticks)out+=`<path d="M${L} ${yy(v).toFixed(1)}H${w-R}" stroke="#e6ebf1"/>${txt(L-6,yy(v)+4,fmt(v),10,'#6b7b90','end')}`;
 for(const v of X.ticks)out+=txt(xx(v),T+H+15,fmt(v),10,'#6b7b90','middle');
 out+=txt(L+W/2,h-4,i.valueColumns[0],10,'#52637a','middle')+txt(L,T-4>10?T-4:10,i.valueColumns[1],10,'#52637a');
 t.rows.forEach((r,k)=>{const c=cats.indexOf(String(r[t.label]));out+=`<circle cx="${xx(xs[k]).toFixed(1)}" cy="${yy(ys[k]).toFixed(1)}" r="4.5" fill="${c<6?colors[c]:'#9aa7b8'}" fill-opacity=".85" stroke="white"/>`;});
 return svg(out,w,h);
}

export const MODEL_KIND_COLOR={fact:'13294A',dimension:'1F5FA8',bridge:'8A63C9',other:'5A6B80'} as const;
/** Star-schema diagram from the shared layout: header per table, keys first, relationship lines with cardinality. */
export function modelSvg(i:ModelItem,opts:RenderOptions={}):string{
 const L=modelLayout(i,Math.max(560,sizeFor(opts.cols).w));
 let out=`<rect width="${L.w}" height="${L.h}" fill="white"/>`;
 for(const l of L.links){const dx=l.x2-l.x1,dy=l.y2-l.y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,ox=-uy*7,oy=ux*7;
  out+=`<path d="M${l.x1.toFixed(1)} ${l.y1.toFixed(1)}L${l.x2.toFixed(1)} ${l.y2.toFixed(1)}" stroke="#8795a8" stroke-width="1.2"${l.active?'':' stroke-dasharray="4 3"'}/>`;
  out+=txt(l.x1+ux*11+ox,l.y1+uy*11+oy+3,l.fromMark,10,'#34465e','middle',700)+txt(l.x2-ux*11+ox,l.y2-uy*11+oy+3,l.toMark,10,'#34465e','middle',700);}
 for(const b of L.boxes){const color='#'+MODEL_KIND_COLOR[b.kind];
  out+=`<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h}" rx="5" fill="white" stroke="#cbd6e4"/><path d="M${b.x.toFixed(1)} ${(b.y+5).toFixed(1)}a5 5 0 0 1 5-5h${(b.w-10).toFixed(1)}a5 5 0 0 1 5 5v${MODEL_HEADER-5}h-${b.w.toFixed(1)}z" fill="${color}"/>`;
  out+=txt(b.x+8,b.y+16,clip(b.name,Math.floor(b.w/6.6)),11,'#ffffff','start',700)+txt(b.x+b.w-6,b.y+16,b.kind==='fact'?'FACT':b.kind==='dimension'?'DIM':b.kind.toUpperCase(),7.5,'#c9d7ea','end',600);
  b.rows.forEach((r,k)=>{const y=b.y+MODEL_HEADER+MODEL_ROW*(k+1)-3;out+=txt(b.x+8,y,clip(r.name,Math.floor((b.w-30)/5.6)),9.5,r.key?'#13294a':'#52637a','start',r.key?700:400)+(r.key?txt(b.x+b.w-6,y,r.key.toUpperCase(),7.5,r.key==='pk'?'#b3263b':'#1f5fa8','end',700):'');});
  if(b.more)out+=txt(b.x+8,b.y+MODEL_HEADER+MODEL_ROW*(b.rows.length+1)-3,`… ${b.more} more`,9,'#8795a8','start');}
 return svg(out,L.w,L.h);
}
export function ganttSvg(i:Extract<ExperienceItem,{type:'gantt'}>,opts:RenderOptions={}):string{
 const DAY=86400000,w=Math.max(560,sizeFor(opts.cols).w),dates=[...i.tasks.flatMap(t=>[Date.parse(t.start),Date.parse(t.end)]),...i.milestones.map(m=>Date.parse(m.date))];
 const first=new Date(Math.min(...dates)),start=Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),1),endRaw=new Date(Math.max(...dates)+DAY),end=Date.UTC(endRaw.getUTCFullYear(),endRaw.getUTCMonth()+1,1);
 const groups=[...new Set(i.tasks.map(t=>t.group).filter((g):g is string=>!!g))],L=Math.min(200,24+Math.max(...i.tasks.map(t=>t.label.length))*6.3),R=40,top=i.milestones.length?52:34,row=26,h=top+i.tasks.length*row+(groups.length?30:10);
 const xx=(ms:number)=>L+(ms-start)/(end-start)*(w-L-R),months=Math.round((end-start)/(30.44*DAY)),quarterly=months>14;
 let out=`<rect width="${w}" height="${h}" fill="white"/>`;
 for(let d=new Date(start);d.getTime()<end;d.setUTCMonth(d.getUTCMonth()+(quarterly?3:1))){
  const x=xx(d.getTime()),m=d.getUTCMonth();out+=`<path d="M${x.toFixed(1)} ${top-8}V${top+i.tasks.length*row}" stroke="${m===0?'#c7d2df':'#edf1f5'}"/>`;
  out+=txt(x+3,top-12,quarterly?`Q${Math.floor(m/3)+1}${m===0||d.getTime()===start?` ${d.getUTCFullYear()}`:''}`:`${d.toLocaleString('en-US',{month:'short',timeZone:'UTC'})}${m===0||d.getTime()===start?` ${d.getUTCFullYear()}`:''}`,9.5,'#6b7b90');}
 const pos=new Map<string,{x0:number;x1:number;y:number}>();
 i.tasks.forEach((t,k)=>{const y=top+k*row,x0=xx(Date.parse(t.start)),x1=Math.max(x0+3,xx(Date.parse(t.end)+DAY)),g=t.group?groups.indexOf(t.group):0,color=colors[g%colors.length];
  if(t.id)pos.set(t.id,{x0,x1,y:y+row/2});
  if(k%2===0)out+=`<rect x="0" y="${y}" width="${w}" height="${row}" fill="#f7f9fc"/>`;
  out+=txt(10,y+17,clip(t.label,34),11,'#2a3b52')+`<rect x="${x0.toFixed(1)}" y="${y+6}" width="${(x1-x0).toFixed(1)}" height="${row-12}" rx="3" fill="${color}" opacity=".28"/><rect x="${x0.toFixed(1)}" y="${y+6}" width="${((x1-x0)*t.progress/100).toFixed(1)}" height="${row-12}" rx="3" fill="${color}"/>`+txt(x1+5,y+17,`${Math.round(t.progress)}%`,9.5,'#52637a');});
 for(const t of i.tasks)for(const d of t.dependsOn??[]){const a=pos.get(d),b=t.id?pos.get(t.id):undefined;if(!a||!b)continue;/* Drop from the predecessor's bottom edge so the line never crosses its % label. */const sx=Math.max(a.x0+2,a.x1-5);out+=`<path d="M${sx.toFixed(1)} ${a.y+row/2-6}V${b.y}H${(b.x0-2).toFixed(1)}" fill="none" stroke="#8795a8" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#xp-arrow)"/>`;}
 i.milestones.forEach((m,k)=>{const x=xx(Date.parse(m.date));out+=`<path d="M${x.toFixed(1)} ${top-4}V${top+i.tasks.length*row}" stroke="#1b2b45" stroke-dasharray="4 3" opacity=".5"/><path d="M${x.toFixed(1)} ${top-40+(k%2)*10}l5 5l-5 5l-5-5z" fill="#1b2b45"/>`+(()=>{const label=`${clip(m.label,26)} · ${m.date}`,right=x+8+label.length*5.6>w-4;return txt(right?x-8:x+8,top-31+(k%2)*10,label,9.5,'#1b2b45',right?'end':'start',600);})();});
 if(groups.length)out+=legend(groups,10,h-10,w-20);
 return svg(`<defs><marker id="xp-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6z" fill="#8795a8"/></marker></defs>${out}`,w,h);
}

const STATUS:[RegExp,string][]=[[/^(success|succeeded|done|ok|passed|complete|completed|ready|approved)$/i,'good'],[/^(fail|failed|error|blocked|rejected|missing)$/i,'bad'],[/^(in progress|running|pending|partial|attention|review|needs review)$/i,'warn']];
export const PLAIN_NUMBER_COLUMN=/(key|id|year|code|rank)$/i;
export const statusClass=(v:unknown)=>STATUS.find(([re])=>re.test(String(v).trim()))?.[1]??'neutral';
function tableHtml(i:Extract<ExperienceItem,{type:'table'}>){
 // Identifier-like numbers (DateKey 20250101, Rank 3) are shown as-is, not with thousands separators.
 const status=i.statusColumn?i.columns.indexOf(i.statusColumn):-1,plain=i.columns.map(c=>PLAIN_NUMBER_COLUMN.test(c.trim()));
 const cell=(c:unknown,k:number)=>k===status?`<td><span class="xp-status xp-${statusClass(c)}">${escape(c)}</span></td>`:typeof c==='number'?`<td class="xp-num${c<0?' xp-neg':''}">${escape(plain[k]?String(c):fmt(c))}</td>`:`<td>${escape(c)}</td>`;
 const numeric=i.columns.map((_,k)=>i.rows.length>0&&i.rows.every(r=>typeof r[k]==='number'||r[k]===null));
 return `<div class="xp-table-wrap"><table><thead><tr>${i.columns.map((c,k)=>`<th${numeric[k]?' class="xp-num"':''}>${escape(c)}</th>`).join('')}</tr></thead><tbody>${i.rows.map(r=>`<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const ARROW={up:'▲',down:'▼',flat:'▬'} as const;

export function itemBody(p:ExperiencePack,i:ExperienceItem,opts:RenderOptions={}):string{
 switch(i.type){
  case 'code':return `${i.file?`<div class="xp-file">${escape(i.file)}</div>`:''}<pre class="xp-code"><code>${escape(i.code).split('\n').map(l=>`<span class="xp-line">${l||' '}</span>`).join('')}</code></pre>`;
  case 'table':return tableHtml(i);
  case 'kpi':{const tone=i.tone??(i.trend==='up'?'good':i.trend==='down'?'bad':'neutral');return `<div class="xp-kpi-tile"><div class="xp-kpi"><span class="xp-kpi-value">${escape(i.value)}</span> <small>${escape(i.unit)}</small></div>${i.delta||i.trend?`<div class="xp-delta xp-${tone}">${i.trend?`<span aria-hidden="true">${ARROW[i.trend]}</span> `:''}${escape(i.delta??'')}${i.comparison?` <span class="xp-muted">${escape(i.comparison)}</span>`:''}</div>`:''}${i.note?`<p class="xp-kpi-note">${escape(i.note)}</p>`:''}</div>`;}
  case 'chart':return `${chartSvg(p,i,opts)}${i.unit?`<small class="xp-caption">${escape(i.unit)}</small>`:''}`;
  case 'gantt':return ganttSvg(i,opts);
  case 'image':return `<img src="${i.data}" alt="${escape(i.caption)}"/><p class="xp-caption">${escape(i.caption)}</p><small class="xp-caption">${escape(i.rights)}</small>`;
  case 'filters':return `<div class="xp-filters">${i.fields.map(f=>`<div class="xp-filter"><span>${escape(f.label)}</span><div class="xp-select">${escape(f.value)}<i aria-hidden="true">▾</i></div></div>`).join('')}</div><small class="xp-caption">Displayed view state · not a live filter</small>`;
  case 'callouts':return `<div class="xp-callouts">${i.entries.map(e=>`<div class="xp-callout xp-${e.tone}"><b aria-hidden="true">${e.tone==='good'?'✓':e.tone==='bad'?'!':e.tone==='neutral'?'•':'i'}</b><div><strong>${escape(e.title)}</strong><p>${escape(e.text)}</p></div></div>`).join('')}</div>`;
  case 'steps':return `<ol class="xp-steps">${i.steps.map((s,k)=>`<li><span class="xp-step-n">${k+1}</span><div><strong>${escape(s.title)}</strong>${s.caption?`<small>${escape(s.caption)}</small>`:''}</div></li>`).join('')}</ol>`;
  case 'tabs':{const uid=attr(`${opts.uid??'tabs'}-${i.id}`),children=i.itemIds.map(id=>p.items.find(x=>x.id===id)).filter((x):x is ExperienceItem=>!!x&&x.type!=='tabs');
   return `<div class="xp-tabs">${children.map((c,k)=>`<input type="radio" name="${uid}" id="${uid}-${k}"${k===0?' checked':''}><label for="${uid}-${k}">${escape(c.title)}</label>`).join('')}<div class="xp-tab-panels">${children.map(c=>`<section data-tab-title="${escape(c.title)}">${itemBody(p,c,opts)}</section>`).join('')}</div></div>`;}
  case 'model':return `${modelSvg(i,opts)}${i.measures.length?`<div class="xp-measures"><span>Measures</span>${i.measures.map(m=>`<code title="${escape(m.table??'')}">Σ ${escape(m.name)}</code>`).join('')}</div>`:''}<small class="xp-caption">${i.tables.length} tables · ${i.relationships.length} relationships · lines run from the many side to the one side; dashed = inactive</small>`;
  case 'formula':return `<div class="xp-formula${[...i.expression].length>28?' xp-formula-long':''}">${escape(i.expression)}</div>${i.symbols.length?`<dl class="xp-symbols">${i.symbols.map(s=>`<dt>${escape(s.symbol)}</dt><dd>${escape(s.meaning)}</dd>`).join('')}</dl>`:''}`;
  default:return `<p class="xp-note">${escape(i.text)}</p>`;
 }
}
export function itemSvg(p:ExperiencePack,i:ExperienceItem):string{
 if(i.type==='chart')return chartSvg(p,i,{cols:12});if(i.type==='model')return modelSvg(i,{cols:12});if(i.type==='gantt')return ganttSvg(i,{cols:12});
 if(i.type==='image')return svg(`<image href="${i.data}" width="640" height="400" preserveAspectRatio="xMidYMid meet"/>`,640,400);
 const lines=i.type==='code'?i.code.split('\n'):i.type==='table'?[i.columns.join(' | '),...i.rows.map(r=>r.join(' | '))]:i.type==='kpi'?[`${i.value} ${i.unit}`,[i.trend?ARROW[i.trend]:'',i.delta,i.comparison].filter(Boolean).join(' '),i.note]
  :i.type==='filters'?i.fields.map(f=>`${f.label}: ${f.value}`):i.type==='callouts'?i.entries.flatMap(e=>[e.title,e.text,'']):i.type==='steps'?i.steps.map((s,k)=>`${k+1}. ${s.title}${s.caption?` — ${s.caption}`:''}`):i.type==='tabs'?i.itemIds.map(id=>`Tab: ${p.items.find(x=>x.id===id)?.title??id}`):i.type==='formula'?[i.expression,'',...i.symbols.map(s=>`${s.symbol}: ${s.meaning}`)]:i.text.split('\n');
 const wrapped=lines.flatMap(l=>l.match(/.{1,88}/g)||['']);const h=90+wrapped.length*19;
 return svg(`<rect width="900" height="${h}" rx="12" fill="white" stroke="#d9e2ee"/>${txt(24,32,i.title,20,'#172b45')}${txt(24,54,`${i.type} | ${i.provenance} | ${i.approval}`,11)}${wrapped.map((l,k)=>txt(24,84+k*19,l,13)).join('')}`,900,h);
}

export const PROVENANCE_NOTE:Record<ExperienceItem['provenance'],string>={synthetic:'Invented example values',reconstruction:'Reconstructed from the portfolio, not a capture','source-derived':'Derived from a cited source',author:'Authored explanation'};
/** The report screen: context rail + title + panel grid + provenance footer. Used in-app and in exports. */
export function reportScreenHtml(p:ExperiencePack,w:ExperienceWorkspace,trail:string[]=[]):string{
 const placed=w.placements.map(s=>({s,i:p.items.find(i=>i.id===s.itemId)})).filter((x):x is {s:typeof x.s;i:ExperienceItem}=>!!x.i);
 const srcIds=new Set(placed.flatMap(({i})=>[...i.sourceIds,...(i.type==='tabs'?i.itemIds.flatMap(id=>p.items.find(x=>x.id===id)?.sourceIds??[]):[])]));
 const sources=p.sources.filter(s=>srcIds.has(s.id)),kinds=[...new Set(placed.map(({i})=>i.provenance))];
 const panel=({s,i}:typeof placed[number])=>`<article class="xp-panel xp-kind-${i.type}" data-testid="item-${escape(i.id)}" style="grid-column:${s.x+1}/span ${s.w};grid-row:${s.y+1}/span ${s.h}"><header class="xp-panel-head"><h3>${escape(i.title)}</h3><span class="xp-chip xp-prov-${i.provenance}" title="${escape(PROVENANCE_NOTE[i.provenance])}">${escape(i.provenance)}</span></header><div class="xp-panel-body">${itemBody(p,i,{cols:s.w,uid:s.id})}</div></article>`;
 const rail=[
  trail.length?`<div class="xp-rail-block"><div class="xp-rail-h">Scope</div>${trail.map((t,k)=>`<div class="xp-rail-line${k===trail.length-1?' xp-strong':''}">${escape(t)}</div>`).join('')}</div>`:'',
  ...w.context.map(c=>`<div class="xp-rail-block"><div class="xp-rail-h">${escape(c.heading)}</div>${c.lines.map(l=>`<div class="xp-rail-line">${escape(l)}</div>`).join('')}</div>`),
  sources.length?`<div class="xp-rail-block"><div class="xp-rail-h">Sources</div>${sources.map(s=>`<div class="xp-rail-line">${escape(s.title)}${s.page?` · p.${s.page}`:''}</div>`).join('')}</div>`:''
 ].join('');
 return `<div class="xp-screen xp-accent-${w.accent}"><aside class="xp-rail">${rail}</aside><div class="xp-screen-main"><div class="xp-report" data-testid="experience-board">${placed.map(panel).join('')}</div><footer class="xp-screen-foot">${kinds.map(k=>`<span class="xp-chip xp-prov-${k}">${escape(k)}</span> ${escape(PROVENANCE_NOTE[k])}`).join(' · ')}. Displayed data and code; nothing on this screen is a live query or proof of deployment.${sources.length?` Sources: ${sources.map(s=>`${escape(s.title)}${s.page?` p.${s.page}`:''}${s.revision?` (${escape(s.revision)})`:''}`).join('; ')}.`:''}</footer></div></div>`;
}

export const workspaceStyles=`
.xp{color:#203147;font:14px/1.5 'Segoe UI',system-ui,sans-serif;min-width:0}.xp *{box-sizing:border-box}.xp button,.xp select{font:inherit}.xp button{cursor:pointer;border:1px solid #c6d2e0;background:white;color:#20476d;border-radius:6px;padding:6px 10px}.xp button:disabled{opacity:.4;cursor:default}.xp-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:12px 0}.xp-shell{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;min-width:0}.xp-nav{position:relative;z-index:2;background:white;border-right:1px solid #d8e1eb;padding-right:12px}.xp-shell>section{position:relative;z-index:1;min-width:0;overflow:hidden}.xp-shell .diagram-section{min-width:0}.xp-shell .canvas-frame{min-width:0;overflow:hidden}.xp-nav button{display:block;width:100%;text-align:left;margin:5px 0;overflow-wrap:anywhere}.xp-nav .active{background:#e8f1fb;border-color:#2864a8}.xp-breadcrumb{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.xp-board{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:76px;gap:12px;background:#edf2f7;padding:16px;border-radius:12px}.xp-card{display:flex;flex-direction:column;min-width:0;min-height:0;background:white;border:1px solid #d4dee9;border-radius:9px;overflow:hidden}.xp-card h3{font-size:15px;margin:0}.xp-card-head{padding:12px 14px 8px;border-bottom:1px solid #e7edf3}.xp-card-body{overflow:auto;padding:12px 14px;min-height:0;flex:1}.xp-card-foot{font-size:11px;border-top:1px solid #e7edf3;padding:6px 12px;color:#59708a;display:flex;gap:5px;flex-wrap:wrap;align-items:center}.xp-card-foot button{padding:2px 6px;font-size:11px}.xp-badge,.xp-source{font-size:10px;color:#607890;text-transform:uppercase;letter-spacing:.3px}.xp-source{text-transform:none;font-family:ui-monospace,monospace;overflow-wrap:anywhere}.xp-selected{outline:3px solid #2864a8}.xp-card{position:relative}.xp-card-head{padding-right:40px!important}.xp .xp-grip{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;padding:0;border:1px solid #d4dee9;border-radius:6px;background:#f5f8fc;color:#52637a;font-size:14px;line-height:1;cursor:grab;touch-action:none}.xp .xp-grip:active{cursor:grabbing}.xp .xp-resize{position:absolute;right:0;bottom:0;z-index:2;width:18px;height:18px;padding:0;border:0;border-radius:0 0 9px 0;background:linear-gradient(135deg,transparent 55%,#9fb2c8 55%,#9fb2c8 65%,transparent 65%,transparent 75%,#9fb2c8 75%);cursor:nwse-resize;touch-action:none}.xp .xp-grip:focus-visible,.xp .xp-resize:focus-visible{outline:3px solid #4c82e5;outline-offset:1px}.xp-ghost{z-index:5;pointer-events:none;border:2px dashed #2864a8;background:#2864a81f;border-radius:9px;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;font-size:12px;font-weight:600;color:#20476d}.xp-ghost-bad{border-color:#b3263b;background:#b3263b1a;color:#8a1c2c}.xp-dragging{opacity:.5}.xp-layout-status{margin:6px 0;font-size:12px;color:#20476d}.xp-focus{grid-auto-rows:minmax(76px,auto)}.xp-focus .xp-card{grid-column:1/-1!important;grid-row:auto!important;min-height:500px}.xp-alert{background:#fff8e1;border:1px solid #f0d58a;border-radius:8px;padding:10px 12px;font-size:12px}.xp-error{white-space:pre-wrap;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;padding:10px;border-radius:8px}.xp-json{width:100%;min-height:220px;font:12px/1.5 ui-monospace,monospace;border:1px solid #c6d2e0;border-radius:8px;padding:10px}.xp-spacer{flex:1}
.xp pre{margin:0;background:#0f1d33;color:#d7e5fb;border-radius:7px;padding:10px 0;font:12px/1.65 'Cascadia Code',Consolas,ui-monospace,monospace;overflow:auto;counter-reset:ln}.xp-line{display:block;padding:0 14px 0 0;white-space:pre}.xp-line::before{counter-increment:ln;content:counter(ln);display:inline-block;width:34px;margin-right:12px;text-align:right;color:#5d7392}.xp-file{font:11px ui-monospace,monospace;color:#5b6f88;margin-bottom:6px}
.xp table{border-collapse:collapse;width:100%;font-size:12px}.xp th{background:#f2f6fa;color:#4e6179;font-weight:600;text-align:left;white-space:nowrap}.xp th,.xp td{border-bottom:1px solid #e8edf3;padding:6px 9px;vertical-align:top}.xp tbody tr:hover{background:#f7fafd}.xp .xp-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.xp-table-wrap{overflow:auto}
.xp-status{display:inline-flex;align-items:center;gap:5px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap}.xp-status::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}.xp-status.xp-good{background:#e5f5ee;color:#16774f}.xp-status.xp-bad{background:#fde9ec;color:#b3263b}.xp-status.xp-warn{background:#fff4dc;color:#9a6508}.xp-status.xp-neutral{background:#eef1f5;color:#5a6b80}
.xp-kpi-tile{display:flex;flex-direction:column;gap:4px}.xp-kpi{font-size:30px;font-weight:700;line-height:1.1;color:#13294a;letter-spacing:-.5px}.xp-kpi small{font-size:13px;font-weight:500;color:#5b6f88;letter-spacing:0}.xp-delta{font-size:12px;font-weight:600}.xp-delta.xp-good{color:#16774f}.xp-delta.xp-bad{color:#b3263b}.xp-delta.xp-neutral{color:#5a6b80}.xp-muted{color:#6b7b90;font-weight:400}.xp-kpi-note{font-size:11px;color:#6b7b90;margin:4px 0 0}
.xp small{color:#596b80}.xp img{max-width:100%;height:auto;display:block}.xp-note{white-space:pre-wrap;margin:0;font-size:13px;line-height:1.65}.xp-caption{display:block;font-size:11px;color:#6b7b90;margin-top:4px}.xp-svg{display:block;width:100%;height:auto}
.xp-filters{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px 12px}.xp-filter span{display:block;font-size:11px;color:#5b6f88;margin-bottom:3px}.xp-select{display:flex;justify-content:space-between;align-items:center;border:1px solid #cdd8e5;border-radius:5px;padding:4px 8px;font-size:12px;background:#fbfcfe}.xp-select i{font-style:normal;color:#7a8ba0;font-size:10px}
.xp-callouts{display:flex;flex-direction:column;gap:10px}.xp-callout{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:8px;background:#f5f8fc;border-left:3px solid #1f5fa8}.xp-callout>b{flex-shrink:0;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#1f5fa8;color:white;font-size:12px}.xp-callout strong{font-size:13px}.xp-callout p{margin:2px 0 0;font-size:12px;color:#4e6179}.xp-callout.xp-good{border-color:#16774f}.xp-callout.xp-good>b{background:#16774f}.xp-callout.xp-bad{border-color:#b3263b}.xp-callout.xp-bad>b{background:#b3263b}.xp-callout.xp-neutral{border-color:#7a8ba0}.xp-callout.xp-neutral>b{background:#7a8ba0}
.xp-measures{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-top:8px;font-size:11px}.xp-measures>span{font-weight:700;color:#4e6179;margin-right:4px}.xp-measures code{font:11px 'Segoe UI',sans-serif;background:#eef4fb;color:#13294a;border-radius:4px;padding:2px 7px}.xp-formula{font:italic 600 24px/1.4 Cambria,'Times New Roman',serif;color:#13294a;background:#eef4fb;border-radius:8px;padding:14px 18px;text-align:center;letter-spacing:.5px;overflow-wrap:anywhere}.xp-formula-long{font-size:17px}.xp-neg{color:#b3263b}.xp-symbols{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin:12px 4px 0;font-size:12px}.xp-symbols dt{font:italic 600 14px Cambria,'Times New Roman',serif;color:#13294a}.xp-symbols dd{margin:0;color:#4e6179}.xp-steps{list-style:none;margin:0;padding:0;display:flex;gap:6px;flex-wrap:wrap}.xp-steps li{flex:1 1 140px;display:flex;gap:9px;align-items:center;padding:10px 16px 10px 12px;background:#eef4fb;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%,12px 50%);min-height:58px}.xp-steps li:first-child{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)}.xp-step-n{flex-shrink:0;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#1f5fa8;color:white;font-weight:700;font-size:12px}.xp-steps strong{display:block;font-size:13px}.xp-steps small{display:block;font-size:11px;color:#5b6f88;line-height:1.35}
.xp-tabs{position:relative}.xp-tabs>input{position:absolute;opacity:0;pointer-events:none}.xp-tabs>label{display:inline-block;padding:6px 12px;margin:0 2px 8px 0;border:1px solid #d4dee9;border-radius:6px 6px 0 0;border-bottom-width:2px;font-size:12px;cursor:pointer;background:#f5f8fc;color:#4e6179}.xp-tabs>input:checked+label{background:white;color:#13294a;font-weight:600;border-bottom-color:#1f5fa8}.xp-tabs>input:focus-visible+label{outline:3px solid #4c82e5;outline-offset:1px}.xp-tab-panels>section{display:none}
${[1,2,3,4,5,6].map(k=>`.xp-tabs>input:nth-of-type(${k}):checked~.xp-tab-panels>section:nth-of-type(${k})`).join(',')}{display:block}
.xp-screen{display:grid;grid-template-columns:210px minmax(0,1fr);background:#eef2f7;border-radius:12px;overflow:hidden;border:1px solid #d6dfea;--accent:#3fb4e8}.xp-accent-teal{--accent:#2bb3a3}.xp-accent-orange{--accent:#f28c28}.xp-accent-violet{--accent:#9b7be0}
.xp-rail{background:#0f2748;color:#dbe6f5;padding:18px 16px;font-size:12px}.xp-rail-block{padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid #ffffff1f}.xp-rail-block:last-child{border:0}.xp-rail-h{font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:6px}.xp-rail-line{line-height:1.55;overflow-wrap:anywhere}.xp-rail-line.xp-strong{color:white;font-weight:700;font-size:15px;line-height:1.3;margin-top:3px}
.xp-shell.xp-reporting{grid-template-columns:minmax(0,1fr)}.xp-shell.xp-reporting>.xp-nav{display:none}.xp-screen-main{min-width:0;padding:14px}.xp-report{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:minmax(54px,auto);gap:12px}.xp-panel{display:flex;flex-direction:column;min-width:0;background:white;border:1px solid #dbe3ed;border-radius:10px;box-shadow:0 1px 3px #1a33570d}.xp-panel-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 8px;padding:10px 14px 4px}.xp-panel-head h3{margin:0;flex:1 1 8em;min-width:0;font-size:13.5px;font-weight:700;color:#13294a}.xp-panel-head .xp-chip{flex-shrink:0}.xp-panel-body{padding:6px 14px 12px;min-width:0;flex:1}.xp-kind-kpi .xp-panel-body{display:flex;align-items:center}
.xp-chip{display:inline-block;font-size:9.5px;letter-spacing:.3px;text-transform:uppercase;padding:1px 6px;border-radius:4px;background:#eef1f5;color:#5a6b80;white-space:nowrap;cursor:help}.xp-prov-synthetic{background:#fff1dd;color:#945b0c}.xp-prov-reconstruction{background:#f1eafd;color:#6541a8}.xp-prov-source-derived{background:#e2f3ef;color:#17705c}
.xp-screen-foot{font-size:11px;color:#5b6f88;padding:12px 2px 0;line-height:1.6}
.xp-screen-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:4px 0 12px}.xp-screen-head h2{margin:2px 0 4px;font-size:24px;letter-spacing:-.4px;color:#13294a}.xp-screen-head p{margin:0;color:#5b6f88;max-width:760px}.xp-eyebrow{font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:#6b7b90;font-weight:600}
@media(max-width:1100px){.xp-screen{grid-template-columns:1fr}.xp-rail{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:2px 20px;padding:14px 16px}.xp-rail-block{border:0;margin:0;padding-bottom:8px}}
@media(max-width:800px){.xp-shell{grid-template-columns:1fr}.xp-nav{border:0}.xp-board,.xp-report{display:block;padding:8px}.xp-card,.xp-panel{margin-bottom:12px;min-height:120px}.xp-screen{grid-template-columns:1fr}.xp-screen-head{flex-direction:column}.xp-dialog{width:98vw}}
@media print{.xp-nav,.xp-toolbar,.xp-breadcrumb,.xp-card-foot button,.xp-alert,.xp-head-actions{display:none!important}.xp-shell{display:block}.xp-board{display:block;background:white;padding:0}.xp-card{margin:12px 0;break-inside:avoid;overflow:visible}.xp-card-body{overflow:visible}.xp pre{white-space:pre-wrap}.xp table{font-size:10px}.xp th,.xp td{white-space:normal}.xp svg{max-height:300px}.xp-panel{break-inside:avoid}.xp-tab-panels>section{display:block!important;margin-bottom:10px}.xp-tab-panels>section::before{content:attr(data-tab-title);display:block;font-weight:700;font-size:12px;margin:4px 0}.xp-tabs>label{display:none}.xp-screen{-webkit-print-color-adjust:exact;print-color-adjust:exact}.xp-dialog{position:static!important;width:100%!important;max-height:none!important;overflow:visible!important}.modal-heading{display:none!important}}
`;
export function workspaceHtml(input:ExperiencePack,workspaceId:string,trail:string[]=[]):string{
 const p=publicPack(input),w=p.workspaces.find(w=>w.id===workspaceId);if(!w)throw new Error('Workspace is not approved for public export');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(w.title)}</title><style>body{margin:24px;background:white}${workspaceStyles}</style></head><body class="xp"><section data-document-role="page" data-label="${escape(w.title)}"><header class="xp-screen-head"><div><div class="xp-eyebrow">${escape(trail.join(' › ')||p.title)}</div><h1 style="margin:2px 0 4px;font-size:26px;color:#13294a">${escape(w.title)}</h1><p>${escape(w.description)}</p></div></header>${reportScreenHtml(p,w,trail)}</section></body></html>`;
}
