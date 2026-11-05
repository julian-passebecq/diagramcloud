import {MAX_DOCUMENT_BYTES} from '../core/model';
import {isVisioFile} from '../core/interchange';

const MiB=1024*1024;
/**
 * A binary container (a Visio package, an editable draw.io PNG) holds more than its diagram: images, thumbnails,
 * compression. Its own readers bound what it expands to (12 MiB of draw.io text, 64 MiB of Visio parts), so the file
 * itself is read up to 16 MiB.
 */
export const MAX_PACKAGE_FILE_BYTES=16*MiB;

export type ImportFileLimit={kind:string;bytes:number};

/** The size limit for a file picked in the JSON / AI import dialog, chosen from its name. */
export function importFileLimit(fileName:string):ImportFileLimit{
 const lower=fileName.toLowerCase();
 if(isVisioFile(lower))return {kind:'Visio drawing',bytes:MAX_PACKAGE_FILE_BYTES};
 if(lower.endsWith('.png'))return {kind:'draw.io PNG',bytes:MAX_PACKAGE_FILE_BYTES};
 // JSON, SVG, draw.io XML and Mermaid are read as text: the text is the document (or becomes it), so the
 // 12 MiB UTF-8 document limit applies to the file itself.
 if(lower.endsWith('.json'))return {kind:'JSON document',bytes:MAX_DOCUMENT_BYTES};
 if(/\.(drawio|xml)$/.test(lower)||lower.endsWith('.drawio.svg'))return {kind:'draw.io diagram',bytes:MAX_DOCUMENT_BYTES};
 if(/\.(mmd|mermaid|md)$/.test(lower))return {kind:'Mermaid diagram',bytes:MAX_DOCUMENT_BYTES};
 return {kind:'document',bytes:MAX_DOCUMENT_BYTES};
}

const mib=(bytes:number)=>`${Math.round(bytes/MiB*10)/10} MiB`;

/** Throws before anything is read when the file is above its limit; the caller shows the message and changes nothing. */
export function checkImportFileSize(file:{name:string;size:number}):void{
 const limit=importFileLimit(file.name);
 if(file.size>limit.bytes)throw new Error(`${file.name} is ${mib(file.size)}: a ${limit.kind} is imported up to ${mib(limit.bytes)}. Nothing was read or imported.`);
}
