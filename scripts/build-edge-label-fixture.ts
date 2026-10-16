/** INTERNAL Canvas QA build/serve only. Never a Studio route or independent SDK consumer result. */
import {build,preview} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve,relative,sep,isAbsolute} from 'node:path';
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=resolve('.'),ignored=resolve(root,'.local/v2-edge-label'),outDir=resolve(ignored,'internal-canvas-build');
if(!outDir.startsWith(ignored+sep)||!ignored.startsWith(root+sep))throw new Error('Internal QA output must stay in its ignored directory.');
if(process.argv.slice(2).some(argument=>argument!=='--serve'))throw new Error('Only --serve is supported.');
const result=await build({root,configFile:false,publicDir:false,plugins:[react()],base:'./',build:{outDir,copyPublicDir:false,emptyOutDir:false,sourcemap:true,rollupOptions:{input:resolve(root,'tests/fixtures/edge-label/consumer.html')}}});
const modules=new Set<string>();for(const bundle of Array.isArray(result)?result:[result])if('output' in bundle)for(const chunk of bundle.output)if(chunk.type==='chunk')for(const id of chunk.moduleIds){const absolute=resolve(id.replace(/^\0/,'').replace(/^\/@fs\//,'').split('?')[0]),local=relative(root,absolute);if(!local||isAbsolute(local)||local==='..'||local.startsWith('..'+sep)||local.split(sep).includes('node_modules'))continue;try{if((await stat(absolute)).isFile())modules.add(local.split(sep).join('/'));}catch{/* Virtual modules are not workspace files. */}}
for(const path of ['tests/fixtures/edge-label/consumer.tsx','src/ui/Canvas.tsx','src/ui/SceneEdge.tsx'])if(!modules.has(path))throw new Error('Internal Canvas QA graph incomplete.');
if([...modules].some(path=>/^(?:src\/(?:App\.tsx|main\.tsx|data\/)|src\/.*(?:useProjectWorkspace|workspaceStorage))/i.test(path)))throw new Error('Internal QA unexpectedly imported application/storage state.');
const hash=async(path:string)=>createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');await mkdir(ignored,{recursive:true});await writeFile(resolve(ignored,'internal-canvas-module-inputs.json'),JSON.stringify({format:'diagramcloud.internal-canvas-qa-module-inputs',builtAt:new Date().toISOString(),node:process.version,moduleInputs:await Promise.all([...modules].sort().map(async path=>({path,sha256:await hash(path)}))),toolInputs:await Promise.all(['scripts/build-edge-label-fixture.ts','package.json','package-lock.json'].map(async path=>({path,sha256:await hash(path)}))),independentSdkConsumer:false,meaning:'Actual Rollup chunk module IDs for internal Canvas interaction QA only; never independent SDK consumer, Studio, owner, whole-source or browser qualification.'},null,2)+'\n');
if(process.argv.includes('--serve')){const server=await preview({root,configFile:false,publicDir:false,base:'./',build:{outDir,copyPublicDir:false},preview:{host:'127.0.0.1',port:4175,strictPort:true,open:false}});server.printUrls();}
