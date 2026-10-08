/** Allowlisted candidate package. Host/CI evidence is a receipt, not a release
 * permission. Never packages .local, Git internals, private atlases or fonts. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,statSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname,sep} from 'node:path';
import {platform,arch} from 'node:os';
import {build} from 'esbuild';
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const args=process.argv.slice(2),flag=(name:string)=>{const at=args.indexOf(name);return at>=0?args[at+1]:undefined;};
const root=resolve('.'),sourceSha=git('rev-parse','HEAD'),out=resolve(flag('--out')||'.local/integration/DIAGRAM/'+sourceSha);
if(!out.startsWith(root+sep)||out===root||existsSync(out))throw new Error('Choose a new package directory inside this workspace');
if(git('status','--porcelain','--untracked-files=all').length)throw new Error('Commit the candidate before packaging');
const evidencePath=flag('--evidence');if(!evidencePath||statSync(evidencePath).size>1024*1024)throw new Error('--evidence is required (1 MiB maximum)');
const evidence=JSON.parse(readFileSync(evidencePath,'utf8')) as {sourceSha:string;ci:{sourceSha:string;url:string;conclusion:string};checks:{id:string;status:'PASS'|'FAIL'|'NOT_RUN';evidenceRefs:string[]}[]};
if(evidence.sourceSha!==sourceSha||evidence.ci?.sourceSha!==sourceSha||evidence.ci.conclusion!=='success'||!/^https:\/\/github.com\/julian-passebecq\/diagramcloud\/actions\/runs\/\d+$/.test(evidence.ci.url))throw new Error('Successful exact-head CI and matching host evidence required');
for(const required of ['typecheck','unit','build','browser','real-atlas-quality','pptx-zip','pptx-visual','bundled-cli'])if(!evidence.checks.some(c=>c.id===required&&c.status==='PASS'&&c.evidenceRefs.length))throw new Error('Missing qualification evidence: '+required);
for(const c of evidence.checks)for(const ref of c.evidenceRefs)if(!/^https:/.test(ref)&&!existsSync(ref))throw new Error('Missing host evidence file');
if(!existsSync('dist/index.html'))throw new Error('Build the application first');
mkdirSync(dirname(out),{recursive:true});mkdirSync(out);mkdirSync(join(out,'cli'));
await build({entryPoints:['scripts/intelligence.ts','scripts/intelligence-mcp.ts'],outdir:join(out,'cli'),bundle:true,platform:'node',format:'esm',target:'node22',outExtension:{'.js':'.mjs'},banner:{js:'import {createRequire} from "node:module";const require=createRequire(import.meta.url);'}});
for(const [source,target] of [['LICENSE','LICENSE'],['THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md'],['public/third-party-licenses.txt','dependency-licenses.txt']])copyFileSync(source,join(out,'cli',target));
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if(tracked.some(p=>/^(?:\.git|\.local|node_modules|release|test-results)(?:\/|$)/.test(p)||/\.(?:woff2?|ttf|otf)$/i.test(p)||/[\r\n]/.test(p)||p.startsWith('-')))throw new Error('Unsafe source package membership');
const generated=['public/diagramcloud.schema.json','public/diagramcloud.patch.schema.json','public/diagramcloud.project-brief.schema.json','public/examples','public/experience','public/galaxy','public/third-party-licenses.txt'].filter(existsSync);
const manifest=join(out,'source-members.txt');writeFileSync(manifest,[...tracked,...generated,'dist'].join('\n')+'\n');
execFileSync('tar',['-czf',join(out,'diagramcloud-source-and-build.tar.gz'),'-T',manifest],{cwd:root});
execFileSync('tar',['-czf',join(out,'diagramcloud-web-build.tar.gz'),'-C','dist','.'],{cwd:root});
execFileSync('tar',['-czf',join(out,'diagramcloud-cli.tar.gz'),'-C',out,'cli'],{cwd:root});
execFileSync('tar',['-czf',join(out,'diagramcloud-synthetic-examples.tar.gz'),'examples/product-campaign'],{cwd:root});
for(const name of ['outcome.json','RESUME.md'])copyFileSync(name,join(out,name));
writeFileSync(join(out,'SHIP-REPORT.md'),readFileSync('SHIP-REPORT.md','utf8')+`\n## Exact packaged candidate\n\nSource: ${sourceSha}.\n\nCI: [exact-head run](${evidence.ci.url}), conclusion **${evidence.ci.conclusion}**, head ${evidence.ci.sourceSha}.\n\nHost: ${platform()} ${arch()}, Node ${process.version}. Checks: ${evidence.checks.map(c=>c.id+'='+c.status).join(', ')}. Detailed durations/counts, hashes and evidence references are in delivery-receipt.json. PowerPoint images were inspected by Codex; this is not human owner verification.\n`);
copyFileSync(evidencePath,join(out,'delivery-receipt.json'));writeFileSync(join(out,'SOURCE_COMMIT.txt'),sourceSha+'\n');
writeFileSync(join(out,'PACKAGE-README.md'),`# DiagramCloud candidate\n\nSource ${sourceSha}; exact-head CI ${evidence.ci.url}. Unmerged/unreleased.\n\nExtract the web archive and serve it on a local static HTTP host. Extract the CLI archive and use Node.js 22+: node cli/intelligence.mjs graph --input graph.json --out new-directory; node cli/intelligence-mcp.mjs selected-project.json for public-only MCP stdio. Bundles need no installed npm packages. Source archive includes the lockfile for npm ci/check/test/build/browser qualification. Synthetic examples are labelled; no real Brain snapshot or private atlas is included. Do not use READY as permission to merge, deploy, execute analyzed code or review observations.\n`);
const kinds:Record<string,'source'|'web-build'|'node-package'|'fixture'|'report'>={'diagramcloud-source-and-build.tar.gz':'source','diagramcloud-web-build.tar.gz':'web-build','diagramcloud-cli.tar.gz':'node-package','diagramcloud-synthetic-examples.tar.gz':'fixture','outcome.json':'report','SHIP-REPORT.md':'report','RESUME.md':'report','delivery-receipt.json':'report','SOURCE_COMMIT.txt':'report','PACKAGE-README.md':'report'};
const artifacts=Object.entries(kinds).map(([relativePath,kind])=>({relativePath,sha256:hash(join(out,relativePath)),bytes:statSync(join(out,relativePath)).size,kind}));
const ready={schema:'galaxy.component-ready/1',workstreamId:'COCKPIT-20261008-NIGHT4',lane:'DIAGRAM',componentId:'diagramcloud',componentVersion:'1.24.0-candidate',sourceSha,capturedAt:new Date().toISOString(),
 host:{hostId:'local-campaign-host',os:platform(),architecture:arch(),runtimeVersion:process.version},contractMajor:1,contractMinor:0,
 capabilities:[{name:'offline-graph-client',version:1,state:'OK'},{name:'static-domain-adapters',version:2,state:'PARTIAL',reason:'Supported source formats only; see CAMPAIGN_CLIENT.md'},{name:'delivery-declarations',version:1,state:'OK'},{name:'semantic-evolution',version:1,state:'PARTIAL',reason:'Bounded previous-backup and graph-generation comparisons'},{name:'public-file-mcp',version:1,state:'OK'}],
 artifacts,checks:evidence.checks,unavailable:[{capability:'real-private-brain-integration',reason:'No authorized real private snapshot supplied'},{capability:'grouped-canvas-filter-projection',reason:'Table filters work; complete canvas projection remains'}]};
writeFileSync(join(out,'READY.json'),JSON.stringify(ready,null,2)+'\n');
writeFileSync(join(out,'SHA256SUMS.txt'),[...artifacts.map(a=>a.sha256+'  '+a.relativePath),hash(join(out,'READY.json'))+'  READY.json'].join('\n')+'\n');
console.log(JSON.stringify({sourceSha,out:relative(root,out).replace(/\\/g,'/'),artifacts:artifacts.length,readySha256:hash(join(out,'READY.json'))}));
