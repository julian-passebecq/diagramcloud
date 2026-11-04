import {readFileSync} from 'node:fs';
import type {PathOrFileDescriptor} from 'node:fs';

/** Reads a text document with CRLF normalised to LF, so tests give the same result on Windows checkouts with core.autocrlf=true. The files themselves are never changed. */
export const readText=(path:PathOrFileDescriptor|URL):string=>readFileSync(path as PathOrFileDescriptor,'utf8').replace(/\r\n/g,'\n');
