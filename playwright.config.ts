import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('.',import.meta.url));
// Launch test servers with the controller's Node, including on Windows.
const node='"'+process.execPath.replaceAll('\\','/')+'"';
const run=(entry:string,args:string)=>node+' "'+fileURLToPath(new URL(entry,import.meta.url)).replaceAll('\\','/')+'" '+args;
export default defineConfig({testDir:'./tests/e2e',timeout:45000,expect:{timeout:12000},fullyParallel:false,workers:1,retries:0,reporter:[['list'],['html',{open:'never'}]],use:{launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:undefined,baseURL:'http://127.0.0.1:4173',viewport:{width:1440,height:1100},trace:'retain-on-failure',screenshot:'only-on-failure'},webServer:[
 // Strict loopback binding avoids wildcard conflicts with unrelated outbound sockets.
 // Never reuse a server: another local app must not be tested as DiagramCloud.
 {cwd,command:run('./node_modules/vite/bin/vite.js','preview --host 127.0.0.1 --port 4173 --strictPort'),url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:30000},
 {cwd,command:run('./node_modules/tsx/dist/cli.mjs','"'+fileURLToPath(new URL('./scripts/build-react-viewer-fixture.ts',import.meta.url)).replaceAll('\\','/')+'" --serve'),url:'http://127.0.0.1:4174/tests/fixtures/react-viewer/consumer.html',reuseExistingServer:false,timeout:30000},
 // Separate INTERNAL Canvas QA only, never the independent public SDK consumer.
 {cwd,command:run('./node_modules/tsx/dist/cli.mjs','"'+fileURLToPath(new URL('./scripts/build-edge-label-fixture.ts',import.meta.url)).replaceAll('\\','/')+'" --serve'),url:'http://127.0.0.1:4175/tests/fixtures/edge-label/consumer.html',reuseExistingServer:false,timeout:30000}
]});
