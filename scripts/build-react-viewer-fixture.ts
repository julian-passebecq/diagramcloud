/** Test-only consumer build/preview, never a production route or package entry. */
import {build,preview} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve,relative,sep,isAbsolute} from 'node:path';
import {writeFile,mkdir,readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=resolve('.'),ignored=resolve(root,'.local/v2-react-viewer'),outDir=resolve(ignored,'consumer-build');
if(!outDir.startsWith(ignored+sep)||!ignored.startsWith(root+sep))throw new Error('Test output must stay inside the ignored workspace directory.');
if(process.argv.slice(2).some(argument=>argument!=='--serve'))throw new Error('Only --serve is supported by this test harness.');
const result=await build({root,configFile:false,publicDir:false,plugins:[react()],base:'./',build:{outDir,copyPublicDir:false,emptyOutDir:false,sourcemap:true,rollupOptions:{input:resolve(root,'tests/fixtures/react-viewer/consumer.html')}}});
const modules=new Set<string>();
for(const bundle of Array.isArray(result)?result:[result])if('output' in bundle)for(const chunk of bundle.output)if(chunk.type==='chunk')for(const id of chunk.moduleIds){
 const absolute=resolve(id.replace(/^\0/,'').replace(/^\/@fs\//,'').split('?')[0]),local=relative(root,absolute);
 if(!local||isAbsolute(local)||local==='..'||local.startsWith('..'+sep)||local.split(sep).includes('node_modules'))continue;
 try{if((await stat(absolute)).isFile())modules.add(local.split(sep).join('/'));}catch{/* Virtual Rollup modules are not disk inputs. */}
}
const digest=async(path:string)=>createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
const moduleInputs=await Promise.all([...modules].sort().map(async path=>({path,sha256:await digest(path)})));
for(const required of ['tests/fixtures/react-viewer/consumer.tsx','src/react/DiagramCloudViewer.tsx','src/ui/Canvas.tsx','src/ui/SceneEdge.tsx'])if(!modules.has(required))throw new Error('Actual consumer module graph did not retain the expected source entry.');
const toolInputs=await Promise.all(['scripts/build-react-viewer-fixture.ts','package.json','package-lock.json'].map(async path=>({path,sha256:await digest(path)})));
if(moduleInputs.some(row=>/^(?:src\/(?:App\.tsx|main\.tsx|data\/)|src\/.*(?:useProjectWorkspace|workspaceStorage))/i.test(row.path)))throw new Error('Independent consumer unexpectedly included Studio/application/sample state.');
await mkdir(ignored,{recursive:true});await writeFile(resolve(ignored,'consumer-module-inputs.json'),JSON.stringify({format:'diagramcloud.test-only-consumer-module-inputs',builtAt:new Date().toISOString(),node:process.version,moduleInputs,toolInputs,meaning:'Actual Rollup output chunk moduleIds resolved to existing workspace files, with raw-byte hashes. Tool/harness/lock inputs are separate. Node modules/virtual modules are not claimed as workspace source. Not a browser result, whole-repository coverage claim or published SDK.'},null,2)+'\n');
await mkdir(ignored,{recursive:true});await writeFile(resolve(ignored,'consumer-build.json'),JSON.stringify({format:'diagramcloud.test-only-react-consumer-build',builtAt:new Date().toISOString(),node:process.version,entry:'tests/fixtures/react-viewer/consumer.html',output:'.local/v2-react-viewer/consumer-build',meaning:'Explicit test consumer build only; not a published SDK, production route, installed host qualification or source identity receipt.'},null,2)+'\n');
if(process.argv.includes('--serve')){const server=await preview({root,configFile:false,publicDir:false,base:'./',build:{outDir,copyPublicDir:false},preview:{host:'127.0.0.1',port:4174,strictPort:true,open:false}});server.printUrls();}
