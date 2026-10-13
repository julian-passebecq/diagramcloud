import test from 'node:test';
import assert from 'node:assert/strict';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import {documentSchema,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {ICON_REGISTRY} from '../src/core/icons';
import {semanticGlyph,glyphSvg} from '../src/core/iconGlyph';
import {buildScene} from '../src/export/scene';
import {svgDiagram} from '../src/export/diagram';
import {addArchitectureSlides} from '../src/export/pptx';
import {assetFidelity} from '../src/export/assetFidelity';
import {planAssets} from '../src/intelligence/assets';
import {customIconData} from './helpers/customIcon';
import {rasterDimensions,rasterAvailable} from '../src/export/rasterDimensions';
export const customProject=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-custom-icons',title:'Synthetic custom artwork',rootViewId:'root',nodes:[{id:'api',label:'Synthetic API',kind:'app',icon:'generic-api',customIconAssetId:'wide'},{id:'job',label:'Synthetic job',kind:'process',icon:'generic-job'}],edges:[],views:[{id:'root',title:'Synthetic artwork',nodeIds:['api','job'],edgeIds:[],positions:{api:{x:0,y:0},job:{x:300,y:0}}}],assets:[{id:'wide',name:'Synthetic wide bands',data:customIconData(),rights:'Original synthetic test fixture by DiagramCloud; MIT. No vendor artwork.',visibility:'public'}]});
test('malformed optional PNG JPEG and WebP remain author assets but never block factual SVG or PowerPoint',async()=>{
 const raw=(format:string,bytes:Buffer)=>`data:image/${format};base64,${bytes.toString('base64')}`;
 const png=Buffer.from(customIconData().split(',')[1],'base64'),oversized=Buffer.from(png);oversized.writeUInt32BE(100000,16);oversized.writeUInt32BE(100000,20);
 const malformedChunk=Buffer.from(png);malformedChunk.writeUInt32BE(0xffffffff,33);
 const webp=Buffer.alloc(30);webp.write('RIFF');webp.writeUInt32LE(0xffffffff,4);webp.write('WEBPVP8X',8);webp.writeUInt32LE(10,16);
 for(const data of [raw('png',Buffer.from([0,0,0])),raw('png',oversized),raw('png',malformedChunk),raw('jpeg',Buffer.from([255,216,255,192,255,255,8,0,80,1,64,255,217])),raw('webp',webp)]){
  const p=customProject();p.assets[0].data=data;validateDocument(p);const before=JSON.stringify(p),safe=publicDocument(p),scene=buildScene(safe,safe.views[0]);assert.equal(scene.nodes[0].customIcon,undefined);assert.ok(scene.nodes[0].genericIcon);assert.equal(rasterAvailable(data),false);assert.throws(()=>rasterDimensions(data));
  const svg=svgDiagram(p,'root',false);assert.ok(svg.includes('Synthetic API'));assert.ok(!svg.includes(data));const ledger=assetFidelity(p,'root','classic').entries[0];assert.equal(ledger.rendered,'semantic-symbol');assert.match(ledger.reason,/unavailable/);assert.equal(ledger.customAssetId,'wide');assert.match(planAssets(p,ICON_REGISTRY).requirements[0].reason,/unavailable/);
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';await addArchitectureSlides(pptx,safe,{cover:false,evidence:false,sources:false,firstViewSlide:1});const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),xml=await zip.file('ppt/slides/slide1.xml')!.async('string'),notes=await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string');assert.ok(xml.includes('Synthetic API'));assert.ok(!xml.includes('<p:pic>'));assert.match(notes,/unavailable/);assert.equal(JSON.stringify(p),before);
 }
});
test('semantic icon catalog is deterministic original theme-safe geometry and supports unknown older icon IDs',()=>{
 for(const id of ['generic-api','generic-job','generic-test','generic-ci','generic-git','generic-owner','generic-document','generic-decision','generic-artifact']){const entry=ICON_REGISTRY.find(e=>e.id===id)!;assert.equal(entry.origin,'original');const a=semanticGlyph({icon:id,kind:'process'});assert.deepEqual(a,semanticGlyph({icon:id,kind:'process'}));assert.ok(a.primitives.length);assert.ok(!glyphSvg(a).includes('image'));for(const p of a.primitives)for(const v of Object.values(p))if(typeof v==='number')assert.ok(v>=0&&v<=24);}
 assert.deepEqual(semanticGlyph({icon:'missing-old-icon',kind:'storage'}),semanticGlyph({icon:'generic',kind:'storage'}));const old=customProject();delete old.nodes[0].customIconAssetId;assert.doesNotThrow(()=>validateDocument(old));assert.ok(buildScene(old,old.views[0]).nodes.every(n=>n.genericIcon));
});
test('custom project icon reference requires a real asset and rights, public closure retains unattached public artwork',()=>{
 const p=customProject();assert.equal(p.blocks.length,0);assert.equal(publicDocument(p).assets.length,1);assert.equal(publicDocument(p).nodes[0].customIconAssetId,'wide');assert.throws(()=>validateDocument({...p,assets:[]}));const bad=structuredClone(p);bad.assets[0].rights='  ';assert.throws(()=>validateDocument(bad),/rights/);
 p.assets[0].visibility='private';p.assets[0].name='PRIVATE_CUSTOM_NAME';p.assets[0].rights='PRIVATE_CUSTOM_RIGHTS';const safe=publicDocument(p);assert.equal(safe.assets.length,0);assert.equal(safe.nodes[0].customIconAssetId,undefined);const svg=svgDiagram(p,p.rootViewId);for(const sentinel of ['PRIVATE_CUSTOM_NAME','PRIVATE_CUSTOM_RIGHTS',customIconData()])assert.ok(!svg.includes(sentinel));assert.ok(buildScene(safe,safe.views[0]).nodes[0].genericIcon);
});
test('Classic SVG and selected-view asset plan preserve public custom rights and an explicit renderer fidelity ledger',()=>{
 const p=customProject(),svg=svgDiagram(p,p.rootViewId,false),plan=planAssets(p,ICON_REGISTRY,{viewId:'root'});assert.ok(svg.includes('preserveAspectRatio="xMidYMid meet"'));assert.ok(svg.includes(customIconData()));assert.ok(svg.includes('Original synthetic test fixture'));assert.ok(svg.includes('Generic job symbol'));assert.equal(plan.requirements[0].origin,'project-asset');assert.equal(plan.requirements[0].customAssetId,'wide');assert.equal(plan.requirements[0].blocksRendering,false);assert.equal(assetFidelity(p,'root','classic').entries[0].rendered,'project-asset');assert.equal(assetFidelity(p,'root','design').entries[0].rendered,'semantic-label');assert.throws(()=>planAssets(p,ICON_REGISTRY,{viewId:'unknown'}),/Unknown/);
});
test('editable PowerPoint contains wide custom artwork at its aspect ratio with rights and original fallback shapes',async()=>{
 const p=publicDocument(customProject()),pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';await addArchitectureSlides(pptx,p,{cover:false,evidence:false,sources:false,firstViewSlide:1});const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),slide=await zip.file('ppt/slides/slide1.xml')!.async('string'),picture=/<p:pic>[\s\S]*?<\/p:pic>/.exec(slide)![0],ext=/<a:ext cx="(\d+)" cy="(\d+)"/.exec(picture)!;assert.ok(Math.abs(Number(ext[1])/Number(ext[2])-4)<.02,'4:1 source remains 4:1, not stretched square');assert.ok(picture.includes('Synthetic wide bands'));assert.ok(slide.includes('Synthetic job'));assert.ok(slide.includes('prst="line"'));const notes=await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string');assert.ok(notes.includes('Original synthetic test fixture'));const media=Object.keys(zip.files).filter(name=>/^ppt\/media\/.*\.png$/.test(name));assert.equal(media.length,1);assert.deepEqual(await zip.file(media[0])!.async('nodebuffer'),Buffer.from(customIconData().split(',')[1],'base64'));
});
test('a custom raster embed failure after successful header sizing draws editable fallback and corrects deck fidelity',async()=>{
 const p=publicDocument(customProject()),pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';const addSlide=pptx.addSlide.bind(pptx);pptx.addSlide=()=>{const slide=addSlide();slide.addImage=()=>{throw new Error('Synthetic image encoder rejection');};return slide;};await addArchitectureSlides(pptx,p,{cover:false,evidence:false,sources:false,firstViewSlide:1});const zip=await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}) as Buffer),xml=await zip.file('ppt/slides/slide1.xml')!.async('string'),notes=await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string');assert.ok(xml.includes('Synthetic API'));assert.ok(xml.includes('prst="line"'));assert.ok(!xml.includes('<p:pic>'));assert.match(notes,/Custom raster could not be embedded/);assert.ok(!notes.includes('Contained without cropping or distortion.'));
});
