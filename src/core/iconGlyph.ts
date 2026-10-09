import {iconFor} from './icons';
import type {ProjectNode} from './model';
/** Original DiagramCloud MIT artwork. Trusted geometry, never imported SVG. */
export type GlyphPrimitive={type:'line';x1:number;y1:number;x2:number;y2:number}|{type:'rect';x:number;y:number;w:number;h:number}|{type:'ellipse';cx:number;cy:number;rx:number;ry:number};
export type IconGlyph={label:string;primitives:GlyphPrimitive[]};
const line=(x1:number,y1:number,x2:number,y2:number):GlyphPrimitive=>({type:'line',x1,y1,x2,y2});
const rect=(x:number,y:number,w:number,h:number):GlyphPrimitive=>({type:'rect',x,y,w,h});
const ellipse=(cx:number,cy:number,rx:number,ry=rx):GlyphPrimitive=>({type:'ellipse',cx,cy,rx,ry});
const glyphs:Record<string,GlyphPrimitive[]>={
 source:[ellipse(12,5,8,3),line(4,5,4,18),line(20,5,20,18),ellipse(12,18,8,3)],
 storage:[ellipse(12,5,8,3),line(4,5,4,18),line(20,5,20,18),ellipse(12,18,8,3),ellipse(12,12,8,3)],
 table:[rect(3,4,18,16),line(3,9,21,9),line(3,14,21,14),line(9,9,9,20),line(15,9,15,20)],
 report:[line(4,3,4,21),line(4,21,22,21),line(8,17,8,12),line(13,17,13,6),line(18,17,18,9)],
 function:[line(8,6,2,12),line(2,12,8,18),line(16,6,22,12),line(22,12,16,18),line(14,3,10,21)],
 control:[line(12,2,20,5),line(20,5,20,14),line(20,14,12,22),line(12,22,4,14),line(4,14,4,5),line(4,5,12,2),line(8,11,11,14),line(11,14,16,8)],
 app:[rect(3,3,7,7),rect(14,14,7,7),line(10,6,17,6),line(17,6,17,14),line(14,17,7,17),line(7,17,7,10)],
 physics:[line(3,6,8,3),line(8,3,15,9),line(15,9,21,6),line(3,13,8,10),line(8,10,15,16),line(15,16,21,13),line(3,20,8,17),line(8,17,15,23),line(15,23,21,20)],
 api:[rect(2,4,20,16),line(2,8,22,8),line(7,11,4,14),line(4,14,7,17),line(17,11,20,14),line(20,14,17,17),line(13,10,11,18)],
 job:[rect(3,3,18,18),line(9,7,17,12),line(17,12,9,17),line(9,17,9,7)],
 test:[rect(3,3,18,18),line(6,12,10,16),line(10,16,18,7)],
 ci:[rect(2,8,5,8),rect(17,8,5,8),ellipse(12,12,2),line(7,12,10,12),line(14,12,17,12)],
 git:[ellipse(6,5,2),ellipse(6,19,2),ellipse(18,5,2),line(6,7,6,17),line(6,14,18,10),line(18,10,18,7)],
 owner:[ellipse(12,6,4),line(4,21,4,16),line(4,16,9,12),line(9,12,15,12),line(15,12,20,16),line(20,16,20,21),line(4,21,20,21)],
 document:[rect(5,2,14,20),line(8,7,16,7),line(8,11,16,11),line(8,15,16,15),line(8,19,13,19)],
 decision:[line(12,2,22,12),line(22,12,12,22),line(12,22,2,12),line(2,12,12,2),line(12,6,12,13),ellipse(12,17,.8)],
 artifact:[rect(3,6,18,15),line(3,6,8,2),line(8,2,17,2),line(17,2,21,6),line(3,10,21,10),rect(9,13,6,4)],
};
glyphs.process=glyphs.app;glyphs.model=glyphs.table;
export function semanticGlyph(node:Pick<ProjectNode,'icon'|'kind'>):IconGlyph{
 const entry=iconFor(node.icon),requested=entry.origin==='original'&&entry.id.startsWith('generic-')?entry.id.slice(8):node.kind,key=glyphs[requested]?requested:node.kind;
 return {label:entry.origin==='original'&&entry.id!=='generic'?entry.label:'Generic '+node.kind+' symbol',primitives:glyphs[key]??glyphs.app};
}
/** Only fixed numeric primitives and a validated ink colour enter this markup. */
export function glyphSvg(glyph:IconGlyph,color='#52647a'):string{
 if(!/^#[a-f0-9]{6}$/i.test(color))throw new Error('Glyph ink must be a hexadecimal colour');
 return glyph.primitives.map(p=>p.type==='line'?`<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}"/>`:p.type==='rect'?`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`:`<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}"/>`).join('');
}
