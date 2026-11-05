/**
 * Node side of `src/core/inputLimits.ts` for the CLI commands and the local stdio MCP: stat the selected file, refuse
 * it before reading when it is above its limit (naming the limit), then read the same descriptor and re-check the bytes
 * read. Callers read every input before they create an output, so a refusal writes nothing.
 */
import {closeSync,fstatSync,openSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {InputLimitError,type InputLimit} from '../../src/core/inputLimits';

export {InputLimitError};

/** Reads a regular file of at most `limit.bytes`; throws InputLimitError (nothing read) when it is larger. */
export function readBoundedBytes(path:string,limit:InputLimit):Buffer{
 const fd=openSync(resolve(path),'r');
 try{
  const stat=fstatSync(fd);
  if(!stat.isFile())throw new Error(`${path} is not a regular file. Nothing was read or written.`);
  if(stat.size>limit.bytes)throw new InputLimitError(path,stat.size,limit);
  const bytes=readFileSync(fd);
  // The file may grow between the stat and the read.
  if(bytes.length>limit.bytes)throw new InputLimitError(path,bytes.length,limit);
  return bytes;
 }finally{closeSync(fd);}
}

/** Same as readBoundedBytes, decoded as UTF-8. */
export function readBoundedText(path:string,limit:InputLimit):string{return readBoundedBytes(path,limit).toString('utf8');}
