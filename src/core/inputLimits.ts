/**
 * Input size limits shared by the App's import dialog, the CLI commands and the local stdio MCP. One module holds the
 * numbers so every path refuses the same file with the same limit; callers check a file's size before reading it whole
 * (or a payload's size before parsing it) and change nothing on refusal.
 */
import {MAX_DOCUMENT_BYTES} from './model';
import {isVisioFile} from './interchange';
import {GRAPH_SNAPSHOT_MAX_BYTES} from '../intelligence/graphSnapshot';
import {EXPLANATION_REQUEST_FILE_LIMIT} from '../intelligence/explanationRequestFiles';

export {MAX_DOCUMENT_BYTES,GRAPH_SNAPSHOT_MAX_BYTES,EXPLANATION_REQUEST_FILE_LIMIT};
export const KiB=1024,MiB=1024*KiB;
/**
 * A binary container (a Visio package, an editable draw.io PNG) holds more than its diagram: images, thumbnails,
 * compression. Its own readers bound what it expands to (12 MiB of draw.io text, 64 MiB of Visio parts), so the file
 * itself is read up to 16 MiB.
 */
export const MAX_PACKAGE_FILE_BYTES=16*MiB;
/** A ProjectBrief and a design brief are read up to 512 KiB (App and CLI alike). */
export const MAX_BRIEF_BYTES=512*KiB;
/** One JSON-RPC line of the local stdio MCP; every tool payload (proposal, brief, earlier document) travels in one. */
export const MAX_MCP_REQUEST_BYTES=1*MiB;
/** A packaging evidence file (`npm run package:candidate -- --evidence`). */
export const MAX_EVIDENCE_FILE_BYTES=1*MiB;
/** The owner viewer HTML and an optional preview packet selected for `npm run concept:host`. */
export const MAX_CONCEPT_VIEWER_BYTES=8*MiB,MAX_CONCEPT_PACKET_BYTES=32*MiB;
/** A linked-reading options file (`scripts/export-linked-reading.ts`). */
export const MAX_READING_OPTIONS_BYTES=64*KiB;

export type InputLimit={kind:string;bytes:number};
export const DOCUMENT_INPUT:InputLimit={kind:'JSON document',bytes:MAX_DOCUMENT_BYTES};

/** The size limit for a file picked in the JSON / AI import dialog, chosen from its name. */
export function importFileLimit(fileName:string):InputLimit{
 const lower=fileName.toLowerCase();
 if(isVisioFile(lower))return {kind:'Visio drawing',bytes:MAX_PACKAGE_FILE_BYTES};
 if(lower.endsWith('.png'))return {kind:'draw.io PNG',bytes:MAX_PACKAGE_FILE_BYTES};
 // JSON, SVG, draw.io XML and Mermaid are read as text: the text is the document (or becomes it), so the
 // 12 MiB UTF-8 document limit applies to the file itself.
 if(lower.endsWith('.json'))return DOCUMENT_INPUT;
 if(/\.(drawio|xml)$/.test(lower)||lower.endsWith('.drawio.svg'))return {kind:'draw.io diagram',bytes:MAX_DOCUMENT_BYTES};
 if(/\.(mmd|mermaid|md)$/.test(lower))return {kind:'Mermaid diagram',bytes:MAX_DOCUMENT_BYTES};
 return {kind:'document',bytes:MAX_DOCUMENT_BYTES};
}

/** "12 MiB", "16.5 MiB", "512 KiB": one decimal at most. */
export function formatBytes(bytes:number):string{
 return bytes>=MiB?`${Math.round(bytes/MiB*10)/10} MiB`:bytes>=KiB?`${Math.round(bytes/KiB*10)/10} KiB`:`${bytes} bytes`;
}

export type LimitWording={verb:string;outcome:string};
/** The App's import dialog: the file is imported, and nothing was read. */
export const IMPORT_WORDING:LimitWording={verb:'imported',outcome:'Nothing was read or imported.'};
/** A CLI command or MCP startup: the file is read, and no output was written. */
export const CLI_WORDING:LimitWording={verb:'read',outcome:'Nothing was read or written.'};

/** The refusal every path prints: the file, its size, its kind and the limit, and that nothing happened. */
export function inputLimitMessage(name:string,size:number,limit:InputLimit,wording:LimitWording=IMPORT_WORDING):string{
 return `${name} is ${formatBytes(size)}: a ${limit.kind} is ${wording.verb} up to ${formatBytes(limit.bytes)}. ${wording.outcome}`;
}

/** Thrown when an input is above its limit; callers report its message and write nothing. */
export class InputLimitError extends Error{
 constructor(readonly input:string,readonly size:number,readonly limit:InputLimit,wording:LimitWording=CLI_WORDING){super(inputLimitMessage(input,size,limit,wording));this.name='InputLimitError';}
}

/** Throws before anything is read when the file is above its limit; the caller shows the message and changes nothing. */
export function checkImportFileSize(file:{name:string;size:number}):void{
 const limit=importFileLimit(file.name);
 if(file.size>limit.bytes)throw new Error(inputLimitMessage(file.name,file.size,limit));
}

/** Checks a payload already in memory (MCP argument, pasted text) before it is parsed. */
export function checkPayloadSize(name:string,text:string,limit:InputLimit):void{
 const size=new TextEncoder().encode(text).byteLength;
 if(size>limit.bytes)throw new InputLimitError(name,size,limit,{verb:'accepted',outcome:'Nothing was parsed or written.'});
}
