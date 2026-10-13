import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdirSync,copyFileSync,readFileSync,writeFileSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
/** Bundled stdio/CLI runtime plus an exact, local grammar allowlist. No fonts,
 * source inputs, credentials or runtime downloads are included. */
export async function bundleClients(directory:string){
 mkdirSync(directory);await build({entryPoints:['scripts/intelligence.ts','scripts/intelligence-mcp.ts'],outdir:directory,bundle:true,platform:'node',format:'esm',target:'node22',outExtension:{'.js':'.mjs'},banner:{js:'import {createRequire as diagramcloudCreateRequire} from "node:module";const require=diagramcloudCreateRequire(import.meta.url);'}});
 const grammarDirectory=join(directory,'grammars');mkdirSync(grammarDirectory);const grammars=[];
 for(const name of ['tree-sitter.wasm','tree-sitter-typescript.wasm','tree-sitter-tsx.wasm','tree-sitter-javascript.wasm','tree-sitter-python.wasm','tree-sitter-c-sharp.wasm']){
  const source=require.resolve(name==='tree-sitter.wasm'?'web-tree-sitter/tree-sitter.wasm':'@vscode/tree-sitter-wasm/wasm/'+name),target=join(grammarDirectory,name);copyFileSync(source,target,constants.COPYFILE_EXCL);grammars.push({name,package:name==='tree-sitter.wasm'?'web-tree-sitter@0.25.10':'@vscode/tree-sitter-wasm@0.3.1',sha256:createHash('sha256').update(readFileSync(source)).digest('hex'),bytes:readFileSync(source).length});
 }
 writeFileSync(join(grammarDirectory,'identity.json'),JSON.stringify({format:'diagramcloud.grammar-identity/1',license:'MIT',grammars},null,2)+'\n',{flag:'wx'});
 for(const [source,target] of [['node_modules/web-tree-sitter/LICENSE','tree-sitter-LICENSE'],['node_modules/@vscode/tree-sitter-wasm/LICENSE','vscode-grammars-LICENSE']])copyFileSync(source,join(grammarDirectory,target),constants.COPYFILE_EXCL);
 return grammars;
}
