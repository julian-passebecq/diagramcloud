/** Allowlisted candidate package. Host/CI evidence is a receipt, not a release
 * permission. Never packages .local, Git internals, private atlases or fonts.
 *
 *   npx tsx scripts/package-campaign.ts --evidence <receipt.json> [--out <new directory>]   candidate (READY.json)
 *   npx tsx scripts/package-campaign.ts --dry-run [--out <new directory>]                    packaging dry run
 *
 * Every run lists each archive back and fails on a forbidden member (Git internals, .local, node_modules, release,
 * test results, fonts, environment files outside the synthetic tests/fixtures) or a missing required one; the listing is written to archive-listing.txt.
 * A dry run (CI on Linux, or locally) writes its own synthetic evidence, labelled `synthetic: true` with no CI run and
 * no passed checks, and DRY-RUN.json instead of READY.json: it proves the packaging path on this host, never a
 * candidate. A candidate run refuses synthetic evidence. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,statSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname,sep} from 'node:path';
import {platform,arch} from 'node:os';
import {bundleClients} from './lib/bundleClients';
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
// Git Bash puts its GNU tar first on PATH, which reads "D:\\..." as a remote host.
// On Windows use the system bsdtar, and pass workspace-relative paths everywhere.
const windowsTar=join(process.env.SystemRoot??'C:/Windows','System32','tar.exe');
const tarBinary=platform()==='win32'&&existsSync(windowsTar)?windowsTar:'tar';
const tar=(...tarArgs:string[])=>execFileSync(tarBinary,tarArgs,{cwd:root,stdio:['ignore','ignore','inherit']});
const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
const args=process.argv.slice(2),flag=(name:string)=>{const at=args.indexOf(name);return at>=0?args[at+1]:undefined;};
const root=resolve('.'),sourceSha=git('rev-parse','HEAD'),version=(JSON.parse(readFileSync('package.json','utf8')) as {version:string}).version,out=resolve(flag('--out')||'.local/integration/DIAGRAM/'+sourceSha);
if(!out.startsWith(root+sep)||out===root||existsSync(out))throw new Error('Choose a new package directory inside this workspace');
if(git('status','--porcelain','--untracked-files=all').length)throw new Error('Commit the candidate before packaging');
type Evidence={synthetic?:boolean;sourceSha:string;ci:{sourceSha:string;url:string;conclusion:string};checks:{id:string;status:'PASS'|'FAIL'|'NOT_RUN';evidenceRefs:string[];inspectedBy?:string;method?:string}[]};
const dryRun=args.includes('--dry-run'),evidencePath=flag('--evidence');
if(dryRun&&evidencePath)throw new Error('--dry-run writes its own synthetic evidence; do not pass --evidence');
if(!dryRun&&(!evidencePath||statSync(evidencePath).size>1024*1024))throw new Error('--evidence is required (1 MiB maximum), or use --dry-run');
const evidence:Evidence=dryRun?{synthetic:true,sourceSha,ci:{sourceSha,url:'none (dry run)',conclusion:'not-run'},checks:[]}:JSON.parse(readFileSync(evidencePath!,'utf8')) as Evidence;
if(!dryRun&&evidence.synthetic!==undefined)throw new Error('Synthetic evidence is for --dry-run only');
if(!dryRun&&(evidence.sourceSha!==sourceSha||evidence.ci?.sourceSha!==sourceSha||evidence.ci.conclusion!=='success'||!/^https:\/\/github.com\/julian-passebecq\/diagramcloud\/actions\/runs\/\d+$/.test(evidence.ci.url)))throw new Error('Successful exact-head CI and matching host evidence required');
if(!dryRun)for(const required of ['typecheck','unit','build','browser','real-atlas-quality','pptx-zip','pptx-visual','bundled-cli'])if(!evidence.checks.some(c=>c.id===required&&c.status==='PASS'&&c.evidenceRefs.length))throw new Error('Missing qualification evidence: '+required);
for(const c of evidence.checks)for(const ref of c.evidenceRefs)if(!/^https:/.test(ref)&&!existsSync(ref))throw new Error('Missing host evidence file');
for(const c of evidence.checks)for(const field of ['inspectedBy','method'] as const)if(c[field]!==undefined&&(typeof c[field]!=='string'||!c[field].trim()||/[\r\n]/.test(c[field])||c[field].length>200))throw new Error('Check '+field+' must be one short line');
if(!existsSync('dist/index.html'))throw new Error('Build the application first');
mkdirSync(dirname(out),{recursive:true});mkdirSync(out);
await bundleClients(join(out,'cli'));
for(const [source,target] of [['LICENSE','LICENSE'],['THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md'],['public/third-party-licenses.txt','dependency-licenses.txt']])copyFileSync(source,join(out,'cli',target));
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if(tracked.some(p=>/^(?:\.git|\.local|node_modules|release|test-results)(?:\/|$)/.test(p)||/\.(?:woff2?|ttf|otf)$/i.test(p)||/[\r\n]/.test(p)||p.startsWith('-')))throw new Error('Unsafe source package membership');
const generated=['public/diagramcloud.schema.json','public/diagramcloud.patch.schema.json','public/diagramcloud.project-brief.schema.json','public/examples','public/experience','public/galaxy','public/third-party-licenses.txt'].filter(existsSync);
const manifest=join(out,'source-members.txt');writeFileSync(manifest,[...tracked,...generated,'dist'].join('\n')+'\n');
const local=(path:string)=>relative(root,path).split(sep).join('/');
tar('-czf',local(join(out,'diagramcloud-source-and-build.tar.gz')),'-T',local(manifest));
tar('-czf',local(join(out,'diagramcloud-web-build.tar.gz')),'-C','dist','.');
tar('-czf',local(join(out,'diagramcloud-cli.tar.gz')),'-C',local(out),'cli');
tar('-czf',local(join(out,'diagramcloud-synthetic-examples.tar.gz')),'examples/product-campaign','tests/fixtures/projects','tests/fixtures/deep');
for(const name of ['outcome.json','RESUME.md'])copyFileSync(name,join(out,name));
/** Read every archive back: forbidden members fail the run, required members must be present. */
const ARCHIVES:Record<string,RegExp[]>={'diagramcloud-source-and-build.tar.gz':[/^package\.json$/,/^package-lock\.json$/,/^LICENSE$/,/^dist\/index\.html$/,/^src\/core\/model\.ts$/],
 'diagramcloud-web-build.tar.gz':[/^index\.html$/],'diagramcloud-cli.tar.gz':[/^cli\/intelligence\.mjs$/,/^cli\/intelligence-mcp\.mjs$/,/^cli\/LICENSE$/],
 'diagramcloud-synthetic-examples.tar.gz':[/^examples\/product-campaign\/.+/,/^tests\/fixtures\/projects\/.+/]};
const FORBIDDEN=[/(?:^|\/)(?:\.git|\.local|node_modules)(?:\/|$)/,/^(?:release|test-results|playwright-report)(?:\/|$)/,/\.(?:woff2?|ttf|otf)$/i,/^(?!tests\/fixtures\/)(?:.*\/)?\.env(?!\.example$)[^/]*$/,/^\/|(?:^|\/)\.\.(?:\/|$)/];
const listing:string[]=[];
for(const [archive,required] of Object.entries(ARCHIVES)){
 const members=execFileSync(tarBinary,['-tzf',local(join(out,archive))],{cwd:root,encoding:'utf8',maxBuffer:256*1024*1024}).split(/\r?\n/).map(m=>m.replace(/^\.\//,'')).filter(m=>m&&m!=='.'&&m!=='./').sort();
 const bad=members.filter(m=>FORBIDDEN.some(r=>r.test(m)));if(bad.length)throw new Error(`${archive}: forbidden members: ${bad.slice(0,5).join(', ')}`);
 const missing=required.filter(r=>!members.some(m=>r.test(m)));if(missing.length)throw new Error(`${archive}: missing required members: ${missing.map(String).join(', ')}`);
 listing.push(`## ${archive} (${members.length} members)`,...members,'');
}
writeFileSync(join(out,'archive-listing.txt'),listing.join('\n'));
/** Only what the evidence file records: an inspector and method per check, never a default claim. */
function inspectionReport(checks:typeof evidence.checks){
 const inspected=checks.filter(c=>c.inspectedBy);
 const lines=inspected.map(c=>`- ${c.id} (${c.status}): inspected by ${c.inspectedBy}${c.method?' ('+c.method+')':''}; references: ${c.evidenceRefs.join(', ')||'none'}.`);
 const silent=checks.filter(c=>!c.inspectedBy).map(c=>c.id);
 return ['## Inspection recorded by this run','',...(lines.length?lines:['No check in the evidence file names an inspector.']),...(silent.length?['','No inspector is recorded for: '+silent.join(', ')+'. Their status comes from the evidence file and its references only.']:[]),'','Recorded inspection is not human owner verification unless the evidence says so.'].join('\n');
}
const DRY='**Dry run with synthetic evidence: not a candidate.** No CI run, no check is recorded as passed, and nothing here permits a release.';
writeFileSync(join(out,'SHIP-REPORT.md'),readFileSync('SHIP-REPORT.md','utf8')+(dryRun?`\n## Packaging dry run\n\n${DRY}\n\nSource: ${sourceSha}. Host: ${platform()} ${arch()}, Node ${process.version}. Archive members: archive-listing.txt.\n`:`\n## Exact packaged candidate\n\nSource: ${sourceSha}.\n\nCI: [exact-head run](${evidence.ci.url}), conclusion **${evidence.ci.conclusion}**, head ${evidence.ci.sourceSha}.\n\nHost: ${platform()} ${arch()}, Node ${process.version}. Checks: ${evidence.checks.map(c=>c.id+'='+c.status).join(', ')}. Detailed durations/counts, hashes and evidence references are in delivery-receipt.json.\n\n${inspectionReport(evidence.checks)}\n`));
if(dryRun)writeFileSync(join(out,'delivery-receipt.json'),JSON.stringify(evidence,null,2)+'\n');else copyFileSync(evidencePath!,join(out,'delivery-receipt.json'));writeFileSync(join(out,'SOURCE_COMMIT.txt'),sourceSha+'\n');
writeFileSync(join(out,'PACKAGE-README.md'),`# DiagramCloud ${version}${dryRun?' (packaging dry run)':''}\n\n${dryRun?DRY+'\n\n':''}Source ${sourceSha}; exact-head CI ${evidence.ci.url}. Private package: no tag, public release or Marketplace publication.\n\nExtract the web archive and serve it on a local static HTTP host. Extract the CLI archive and use Node.js 22+: node cli/intelligence.mjs graph --input graph.json --out new-directory; node cli/intelligence-mcp.mjs selected-project.json for ten public MCP tools; optionally append --analysis explicitly-selected-analysis-bundle.json for bounded private author-context queries. Deep uses the bundled local grammar allowlist and recorded MIT licenses. Bundles need no installed npm packages. Source archive includes the lockfile for npm ci/check/test/build/browser qualification. Synthetic examples are labelled; no real Brain snapshot or private atlas is included. Do not use READY as permission to merge, deploy, execute analyzed code or review observations.\n`);
const kinds:Record<string,'source'|'web-build'|'node-package'|'fixture'|'report'>={'diagramcloud-source-and-build.tar.gz':'source','diagramcloud-web-build.tar.gz':'web-build','diagramcloud-cli.tar.gz':'node-package','diagramcloud-synthetic-examples.tar.gz':'fixture','outcome.json':'report','SHIP-REPORT.md':'report','RESUME.md':'report','delivery-receipt.json':'report','SOURCE_COMMIT.txt':'report','PACKAGE-README.md':'report','archive-listing.txt':'report'};
const artifacts=Object.entries(kinds).map(([relativePath,kind])=>({relativePath,sha256:hash(join(out,relativePath)),bytes:statSync(join(out,relativePath)).size,kind}));
const ready={schema:'galaxy.component-ready/1',workstreamId:'COCKPIT-20261008-NIGHT4',lane:'DIAGRAM',componentId:'diagramcloud',componentVersion:version,sourceSha,capturedAt:new Date().toISOString(),
 host:{hostId:'local-campaign-host',os:platform(),architecture:arch(),runtimeVersion:process.version},contractMajor:1,contractMinor:0,
 capabilities:[{name:'offline-graph-client',version:1,state:'OK'},{name:'static-domain-adapters',version:3,state:'OK'},{name:'delivery-declarations',version:1,state:'OK'},{name:'semantic-evolution',version:1,state:'OK'},{name:'grouped-canvas-projection',version:1,state:'OK'},{name:'bounded-local-deep-analysis',version:1,state:'OK'},{name:'immutable-publication-library',version:1,state:'OK'},{name:'public-file-mcp',version:1,state:'OK'}],
 artifacts,checks:evidence.checks,unavailable:[{capability:'autonomous-runner-or-live-collector',reason:'External owners retain execution, permissions and observations; DiagramCloud consumes reviewed inputs'}]};
// A dry run never writes READY.json: DRY-RUN.json names the source, host and artifacts only, with no capability or check claim.
const record=dryRun?'DRY-RUN.json':'READY.json';
writeFileSync(join(out,record),JSON.stringify(dryRun?{schema:'diagramcloud.package-dry-run/1',synthetic:true,notice:DRY.replace(/\*/g,''),componentId:ready.componentId,componentVersion:version,sourceSha,capturedAt:ready.capturedAt,host:ready.host,artifacts}:ready,null,2)+'\n');
writeFileSync(join(out,'SHA256SUMS.txt'),[...artifacts.map(a=>a.sha256+'  '+a.relativePath),hash(join(out,record))+'  '+record].join('\n')+'\n');
console.log(JSON.stringify({sourceSha,dryRun,out:relative(root,out).replace(/\\/g,'/'),artifacts:artifacts.length,[dryRun?'dryRunSha256':'readySha256']:hash(join(out,record))}));
