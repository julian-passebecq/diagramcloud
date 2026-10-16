import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {svgDiagram} from '../src/export/diagram';
import {styledSvg} from '../src/export/styled';
import {designSvg} from '../src/export/design';
import {parseDocument,type Project} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {samples} from '../src/data/samples';
import {contosoForecasting} from '../src/data/contosoForecasting';
import {publicationPages,publicationPageProject} from '../src/export/publicationPages';
import {figureLines,fitDefects} from './helpers/figureFit';
import {denseFixture} from './helpers/denseFixture';

/** Every header, label and footer line of the figures a manual prints stays inside the figure: a cut line is a lost fact. */
const NOW=new Date('2026-10-07T09:00:00Z');

test('figure fit: the checker measures each wrapped line, resolves translate() and sees a footer cut by the viewBox',()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120"><g font-family="Arial"><text x="30" y="20" font-size="10"><tspan x="30">Short line</tspan><tspan x="30" dy="14">Second short line</tspan></text><g transform="translate(200,0)"><text x="10" y="60" font-size="10">Shifted label that runs past the edge</text></g><text x="30" y="100" font-size="10">Static explanatory view · No live telemetry · Details retained in DiagramCloud metadata</text></g></svg>';
 const {lines,unresolved}=figureLines(svg);
 assert.equal(unresolved,0);assert.deepEqual(lines.map(l=>l.s),['Short line','Second short line','Shifted label that runs past the edge','Static explanatory view · No live telemetry · Details retained in DiagramCloud metadata']);
 assert.equal(lines[2].x,210);
 const f=fitDefects(svg,'self').failures;
 assert.equal(f.length,2,f.join('\n'));assert.ok(f.some(s=>s.includes('Shifted label')));assert.ok(f.some(s=>s.includes('Static explanatory view')));
});

test('figure fit: a one-component publication page keeps the whole classic footer and title inside the figure',()=>{
 const d=denseFixture();
 for(const paper of ['A4','letter'] as const){
  const plan=publicationPages(d,'root',['root'],{profile:'classic',paper});assert.equal(plan.dense,true);
  const single=plan.pages.findIndex(p=>p.nodeIds.length===1);assert.ok(single>=0,'the fixture leaves one component on its own page');
  const svg=svgDiagram(publicationPageProject(d,plan,single),'root',false),{lines}=figureLines(svg);
  assert.ok(lines.some(l=>l.s==='Static explanatory view · No live telemetry · Details retained in DiagramCloud metadata'),'footer printed whole on one line');
  assert.deepEqual(fitDefects(svg,`classic page ${single+1} ${paper}`).failures,[]);
 }
 // A title or credit longer than the widest frame wraps instead of being cut or sliced.
 const long=publicDocument(d),title='Synthetic '+'very long figure title '.repeat(6);
 const svg=svgDiagram({...long,views:long.views.map(v=>({...v,title,nodeIds:['n8'],edgeIds:[]}))},'root',false);
 assert.deepEqual(fitDefects(svg,'long title').failures,[]);
 assert.equal(figureLines(svg).lines.filter(l=>l.size===20).map(l=>l.s).join(' '),title.trim());
});

test('figure fit: every classic, blueprint, editorial and architecture figure line stays inside its viewBox, on views and dense pages',()=>{
 const failures:string[]=[];let figures=0,lines=0,unresolved=0;
 // DIAGRAMCLOUD_QUALITY_DOCS=a.json,b.json adds local documents (for example a private Galaxy atlas) without committing them.
 const extra=(process.env.DIAGRAMCLOUD_QUALITY_DOCS??'').split(',').filter(Boolean).map(p=>parseDocument(readFileSync(p,'utf8')));
 const docs:Project[]=[contosoForecasting(),...samples,...extra];
 const d=denseFixture();for(const paper of ['A4','letter'] as const){const plan=publicationPages(d,'root',['root'],{profile:'classic',paper});plan.pages.forEach((_,i)=>docs.push(publicationPageProject(d,plan,i)));}
 for(const doc of docs)for(const v of publicDocument(doc).views){
  const figs:[string,string][]=[['classic',svgDiagram(doc,v.id,false)],['blueprint',styledSvg(doc,v.id,'blueprint',NOW)],['editorial',styledSvg(doc,v.id,'editorial',NOW)],['architecture',designSvg(doc,v.id,{type:'architecture',theme:'light',now:NOW})]];
  for(const [kind,svg] of figs){const r=fitDefects(svg,`${kind}/${doc.id}/${v.id}`);figures++;lines+=r.lines;unresolved+=r.unresolved;failures.push(...r.failures);}
 }
 assert.equal(unresolved,0,`${unresolved} text(s) under a transform the fit check cannot resolve`);
 assert.ok(lines>figures*3,`${lines} lines in ${figures} figures`);
 assert.equal(failures.length,0,`${failures.length} line(s) outside their figure:\n${failures.slice(0,200).join('\n')}`);
});
