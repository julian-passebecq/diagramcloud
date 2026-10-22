import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {deploymentTarget,deploymentTestSelection} from './scripts/lib/e2eTarget';
const deployed=deploymentTarget(process.env);
import {e2ePorts,appOrigin,reactViewerUrl,edgeLabelUrl} from './scripts/lib/e2ePorts';
const cwd=fileURLToPath(new URL('.',import.meta.url));
// Launch test servers with the controller's Node, including on Windows.
const node='"'+process.execPath.replaceAll('\\','/')+'"';
const run=(entry:string,args:string)=>node+' "'+fileURLToPath(new URL(entry,import.meta.url)).replaceAll('\\','/')+'" '+args;
export default defineConfig({...deploymentTestSelection(deployed),testDir:'./tests/e2e',timeout:45000,expect:{timeout:12000},fullyParallel:false,workers:1,retries:0,reporter:[['list'],['html',{open:'never'}]],use:{launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined,baseURL:deployed?.origin??appOrigin,viewport:{width:1440,height:1100},trace:'retain-on-failure',screenshot:'only-on-failure'},webServer:deployed?undefined:[
 // Strict loopback binding avoids wildcard conflicts with unrelated outbound sockets.
 // Never reuse a server: another local app must not be tested as DiagramCloud.
 // Ports come from DIAGRAMCLOUD_E2E_PORT (base, +1, +2; default 24173-24175).
 {cwd,command:run('./node_modules/vite/bin/vite.js','preview --host 127.0.0.1 --port '+e2ePorts.app+' --strictPort'),url:appOrigin,reuseExistingServer:false,timeout:30000},
 {cwd,command:run('./node_modules/tsx/dist/cli.mjs','"'+fileURLToPath(new URL('./scripts/build-react-viewer-fixture.ts',import.meta.url)).replaceAll('\\','/')+'" --serve'),url:reactViewerUrl,reuseExistingServer:false,timeout:30000},
 // Separate INTERNAL Canvas QA only, never the independent public SDK consumer.
 {cwd,command:run('./node_modules/tsx/dist/cli.mjs','"'+fileURLToPath(new URL('./scripts/build-edge-label-fixture.ts',import.meta.url)).replaceAll('\\','/')+'" --serve'),url:edgeLabelUrl,reuseExistingServer:false,timeout:30000}
]});
