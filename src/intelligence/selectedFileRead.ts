import {SECRET_FILE} from '../core/scan/scanner';
import {secretInText} from '../core/secrets';
/** Classification comes from the reader's explicit error name, never its private text.
 * A generic read failure does not establish that access was denied. */
export function selectedReadFailureCause(error:unknown):'access-denied'|undefined{
 return error instanceof Error&&['NotAllowedError','SecurityError'].includes(error.name)?'access-denied':undefined;
}
export class SelectedTextReadError extends Error{
 readonly gapCause?:'access-denied';
 constructor(path:string,error:unknown){super('Selected file read failed: '+path);this.gapCause=selectedReadFailureCause(error);}
}
/** Safe caller-selected metadata only; underlying permission errors are private. */
export async function readSelectedText(file:{size:number;arrayBuffer:()=>Promise<ArrayBuffer>},path:string,signal?:AbortSignal):Promise<string>{
 if(!path||path.length>500||/^(?:\/|[a-z]:)/i.test(path)||/[\\\u0000-\u001f]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||SECRET_FILE.test(path)||secretInText(path))throw new Error('Selected file path refused before reading');
 const abort=()=>{if(signal?.aborted)throw new DOMException('Selected file read cancelled','AbortError');};abort();let buffer:ArrayBuffer;
 try{buffer=await file.arrayBuffer();}catch(e){if(signal?.aborted||(e instanceof Error&&e.name==='AbortError'))throw new DOMException('Selected file read cancelled','AbortError');throw new SelectedTextReadError(path,e);}
 abort();if(buffer.byteLength!==file.size)throw new Error('Selected file changed while reading: '+path);
 try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{throw new Error('Selected file is not valid UTF-8 text: '+path);}
}
