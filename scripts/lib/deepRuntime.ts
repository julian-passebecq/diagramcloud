import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Language,Parser} from 'web-tree-sitter';
import type {DeepLanguage,DeepRuntime} from '../../src/intelligence/deepAnalysis';
const require=createRequire(import.meta.url);
/** Only installed or packaged grammar resources. Caller input is never a module
 * location and grammar loading never follows source references. */
export async function nodeDeepRuntime():Promise<DeepRuntime>{
 const packaged=(name:string)=>fileURLToPath(new URL('./grammars/'+name,import.meta.url));
 const locate=(name:string)=>{const local=packaged(name);return existsSync(local)?local:require.resolve(name==='tree-sitter.wasm'?'web-tree-sitter/tree-sitter.wasm':'@vscode/tree-sitter-wasm/wasm/'+name);};
 await Parser.init({locateFile:()=>locate('tree-sitter.wasm')});const cache=new Map<DeepLanguage,Promise<Language>>();
 return {createParser:()=>new Parser(),language:language=>{if(!cache.has(language))cache.set(language,Language.load(locate('tree-sitter-'+language+'.wasm')));return cache.get(language)!;}};
}
