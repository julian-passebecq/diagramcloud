import {Language,Parser} from 'web-tree-sitter';
import runtimeUrl from 'web-tree-sitter/tree-sitter.wasm?url';
import typescriptUrl from '@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm?url';
import tsxUrl from '@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm?url';
import javascriptUrl from '@vscode/tree-sitter-wasm/wasm/tree-sitter-javascript.wasm?url';
import pythonUrl from '@vscode/tree-sitter-wasm/wasm/tree-sitter-python.wasm?url';
import csharpUrl from '@vscode/tree-sitter-wasm/wasm/tree-sitter-c-sharp.wasm?url';
import type {DeepRuntime,DeepLanguage} from './deepAnalysis';
/** Explicit worker caller initializes local bundled grammars; no remote loader. */
export async function browserDeepRuntime():Promise<DeepRuntime>{
 await Parser.init({locateFile:()=>runtimeUrl});const urls:Record<DeepLanguage,string>={typescript:typescriptUrl,tsx:tsxUrl,javascript:javascriptUrl,python:pythonUrl,'c-sharp':csharpUrl},cache=new Map<DeepLanguage,Promise<Language>>();
 return {createParser:()=>new Parser(),language:language=>{if(!cache.has(language))cache.set(language,Language.load(urls[language]));return cache.get(language)!;}};
}
