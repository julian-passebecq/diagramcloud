import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import {samples} from '../src/data/samples';
import {clone,validateDocument,type DesignType,type Project} from '../src/core/model';
import {svgDiagram,xml} from '../src/export/diagram';
import {blueprintSvg,editorialSvg} from '../src/export/styled';
import {DESIGN_TYPE_LABEL,designSvg} from '../src/export/design/index';
import {drawioDiagram} from '../src/export/drawio';
import {technicalManualHtml} from '../src/export/manual';
import {buildDeck,projectPlan} from '../src/export/deck';
import {addArchitectureSlides} from '../src/export/pptx';
import {buildDesignDeck} from '../src/export/design/slides';
import {parseXml} from '../src/core/interchange/xml';

/** Characters XML 1.0 forbids (C0 controls other than tab, LF, CR; U+FFFE/U+FFFF) and unpaired surrogates. */
const FORBIDDEN=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const NOW=new Date('2026-11-04T09:00:00Z'),PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** samples[0] with a control character in a public root-view label, an edge label and the project summary, plus a lone surrogate. */
function hostile():Project{
 const d=clone(samples[0]),root=d.views.find(v=>v.id===d.rootViewId)!;
 const node=d.nodes.find(n=>root.nodeIds.includes(n.id)&&n.visibility==='public')!;node.label='Bad\u0001label';node.summary='lone \uD800 surrogate';
 const edge=d.edges.find(e=>root.edgeIds.includes(e.id));if(edge)edge.label='x\u001Fy';
 d.title='Title\u000B with VT';d.summary='Summary \u0008 with BS';
 assert.doesNotThrow(()=>validateDocument(d),'the model accepts these characters, so the exporters must cope');
 return d;
}
function wellFormed(name:string,out:string){
 const m=FORBIDDEN.exec(out);
 assert.equal(m,null,`${name} contains U+${m?.[0].charCodeAt(0).toString(16).padStart(4,'0').toUpperCase()} at ${m?.index}`);
}

test('xml() replaces characters XML 1.0 forbids and keeps tab, newline, CR and astral characters',()=>{
 assert.equal(xml('a\u0001b\u001F<c>\uD800d\uFFFE'),'a\uFFFDb\uFFFD&lt;c&gt;\uFFFDd\uFFFD');
 assert.equal(xml('t\tn\nr\r 😀 é'),'t\tn\nr\r 😀 é');
});

test('SVG, styled, design kit, draw.io and manual exports stay well-formed XML with control characters in labels',()=>{
 const d=hostile(),v=d.rootViewId;
 const svgs:[string,string][]=[['classic svg',svgDiagram(d,v,true)],['blueprint',blueprintSvg(d,v,NOW)],['editorial',editorialSvg(d,v,NOW)],
  ...(Object.keys(DESIGN_TYPE_LABEL) as DesignType[]).filter(t=>t!=='auto').map(t=>[`design ${t}`,designSvg(d,v,{type:t})] as [string,string])];
 for(const [name,svg] of svgs){wellFormed(name,svg);assert.ok(parseXml(svg).children.length,`${name} parses`);}
 const drawio=drawioDiagram(d,NOW);wellFormed('drawio',drawio);assert.ok(parseXml(drawio).children.length);
 assert.match(drawio,/Bad\uFFFDlabel/,'the label survives with a replacement character');
 wellFormed('manual',technicalManualHtml(d,{now:NOW}));
});

test('PPTX decks (architecture, project deck, design deck) carry no XML-forbidden character',async()=>{
 const d=hostile();
 const parts=async(pptx:InstanceType<typeof PptxGenJS>)=>{const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer);
  return Promise.all(Object.keys(zip.files).filter(n=>n.endsWith('.xml')).map(async n=>[n,await zip.file(n)!.async('string')] as const));};
 const arch=new PptxGenJS();await addArchitectureSlides(arch,d,{cover:true,evidence:true,sources:true,realization:true,firstViewSlide:2});
 const {pptx:deck}=await buildDeck(PptxGenJS,projectPlan(d));
 const {pptx:design}=await buildDesignDeck(PptxGenJS,d,{now:NOW,raster:async()=>PNG});
 for(const [label,p] of [['architecture',arch],['deck',deck],['design deck',design]] as const)for(const [n,x] of await parts(p))wellFormed(`${label} ${n}`,x);
});
