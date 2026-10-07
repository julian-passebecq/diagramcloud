import type PptxGenJS from 'pptxgenjs';
import type {DesignTheme,DesignType,Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {orderedViews} from '../drawio';
import {DESIGN_TYPE_LABEL,designSvg,resolveDesignType} from './index';

/** Rasterises one figure (an SVG string) to a PNG data URL; the browser passes pngFromSvg, tests pass a stub. */
export type FigureRaster=(svg:string)=>Promise<string>;
export type DesignDeckOptions={type?:DesignType;theme?:DesignTheme;now?:Date;raster:FigureRaster};
const W=13.333,H=7.5,MAX_SLIDES=81;

/** The figure's own aspect ratio, from its viewBox (every Diagram Design SVG has one). */
export function figureSize(svg:string):{w:number;h:number}{
 const m=/viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);if(!m)throw new Error('A Diagram Design figure has no viewBox');return {w:Number(m[1]),h:Number(m[2])};
}

/**
 * Diagram Design deck: a cover, then one slide per public view (drilldown order) with its Diagram Design figure as a
 * picture fitted to the slide, the figure's own title and description as alt text, and a caption naming the figure
 * type and view. Built from publicDocument and the same SVG as the figure export, so nothing private reaches a slide or
 * its notes. Pictures, not native shapes: the editable architecture deck stays the "Editable PowerPoint" export.
 */
export async function buildDesignDeck(PptxCtor:typeof PptxGenJS,input:Project,options:DesignDeckOptions):Promise<{pptx:PptxGenJS;slides:number}>{
 const now=options.now??new Date(),d=publicDocument(input),views=orderedViews(d);
 if(!views.length)throw new Error('Nothing public to export yet: no public view.');
 if(views.length+1>MAX_SLIDES)throw new Error(`This deck would have ${views.length+1} slides (limit ${MAX_SLIDES}).`);
 const pptx=new PptxCtor();pptx.layout='LAYOUT_WIDE';pptx.title=`${d.title} · Figures`;pptx.subject='Diagram Design figures';pptx.author='DiagramCloud';pptx.company='DiagramCloud';
 const cover=pptx.addSlide();cover.background={color:'F5F5F5'};
 cover.addText('DIAGRAM DESIGN · FIGURES',{x:.7,y:.8,w:11.9,h:.4,fontFace:'Consolas',fontSize:12,bold:true,color:'EB6C36',charSpacing:2,margin:0});
 cover.addText(d.title,{x:.7,y:1.4,w:11.9,h:1.4,fontFace:'Georgia',fontSize:40,color:'2D3142',margin:0,valign:'top',fit:'shrink'});
 if(d.summary)cover.addText(d.summary.slice(0,600),{x:.7,y:3.1,w:11.9,h:2.2,fontSize:16,color:'4F5D75',margin:0,valign:'top',fit:'shrink'});
 cover.addText(`${views.length} public view(s) · ${now.toISOString().slice(0,10)} · public content only · visual grammar adapted from diagram-design (MIT)`,{x:.7,y:6.6,w:11.9,h:.4,fontSize:10,color:'7A8399',margin:0});
 for(const [i,v] of views.entries()){
  const type=resolveDesignType(input,v.id,options.type),svg=designSvg(input,v.id,{type,theme:options.theme,now}),size=figureSize(svg),png=await options.raster(svg);
  const alt=[/<title id="[^"]*">([^<]*)<\/title>/.exec(svg)?.[1],/<desc id="[^"]*">([^<]*)<\/desc>/.exec(svg)?.[1]].filter(Boolean).join('. ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  const slide=pptx.addSlide(),boxW=W-.8,boxH=H-1.15,scale=Math.min(boxW/size.w,boxH/size.h),w=size.w*scale,h=size.h*scale;
  const dark=/data-theme="dark"/.test(svg);slide.background={color:dark?'2D3142':'F5F5F5'};
  slide.addImage({data:png,x:(W-w)/2,y:.35+(boxH-h)/2,w,h,altText:alt.slice(0,1000)});
  slide.addText(`${String(i+1).padStart(2,'0')} · ${DESIGN_TYPE_LABEL[type]} · view ${v.id}`,{x:.4,y:H-.65,w:W-.8,h:.35,fontFace:'Consolas',fontSize:9,color:dark?'BFC0C0':'7A8399',margin:0});
 }
 return {pptx,slides:views.length+1};
}

/** Browser download of the Diagram Design deck. */
export async function downloadDesignDeck(input:Project,fileName:string,options:DesignDeckOptions):Promise<number>{
 const {default:PptxGenJS}=await import('pptxgenjs'),{pptx,slides}=await buildDesignDeck(PptxGenJS,input,options);
 await pptx.writeFile({fileName});return slides;
}
