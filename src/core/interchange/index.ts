import {drawioFromPng,importDrawio,looksLikeDrawio} from './drawio';
import {importMermaid,looksLikeMermaid} from './mermaid';
import type {ImportResult} from './graph';

export {FORMAT_LABEL,type ImportReport,type ImportResult} from './graph';
export {looksLikeDrawio,looksLikeMermaid};

/** File types the import button accepts besides DiagramCloud JSON/SVG. */
export const INTERCHANGE_ACCEPT='.drawio,.xml,.drawio.svg,.drawio.png,.png,.mmd,.mermaid,.md';

/** Diagram text DiagramCloud can convert (draw.io XML, an editable draw.io SVG, Mermaid), or null for JSON and anything else. */
export function interchangeFormat(raw:string):'drawio'|'mermaid'|null{
 const t=raw.trimStart();if(t.startsWith('{')||t.startsWith('['))return null;
 if(looksLikeDrawio(t))return 'drawio';
 if(looksLikeMermaid(t))return 'mermaid';
 return null;
}

/** Convert draw.io or Mermaid text into a new, validated DiagramCloud project plus a report of what was kept and lost. */
export async function importDiagram(raw:string,fileName:string,options:{idSuffix?:string;now?:Date}={}):Promise<ImportResult>{
 const format=interchangeFormat(raw);
 if(format==='drawio')return importDrawio(raw,fileName,options);
 if(format==='mermaid')return importMermaid(raw,fileName,options);
 throw new Error('Not a draw.io or Mermaid diagram.');
}

/** Bytes of an editable draw.io PNG export to its embedded diagram text. */
export async function diagramTextFromPng(bytes:Uint8Array):Promise<string>{return drawioFromPng(bytes);}
