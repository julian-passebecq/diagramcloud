import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {evidenceRefSchema,verificationReceipt,type EvidenceRef,type ReceiptCheck} from '../src/core/galaxy';

/*
 * Release qualification receipt (galaxy.verification-receipt/1) for one exact commit.
 *
 *   npm run qualify                     run every check locally, then write release/verification-receipt.json
 *   tsx scripts/qualify.ts record k=v…  CI: record the outcomes of steps that already ran (success|failure|skipped|cancelled)
 *
 * The level is derived from the checks (see RECEIPT_LEVEL_CHECKS); nothing here can claim GALAXY_QUALIFIED.
 * MANUAL_QUALIFIED needs MANUAL_REVIEW=<file>: a human visual review record whose hash the receipt cites.
 */
const pkg=JSON.parse(readFileSync('package.json','utf8')) as {version:string};
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sha256=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');

const COMMANDS:Array<[string,string]>=[['typecheck','npm run check'],['unit','npm test'],['build','npm run build'],['e2e','npm run test:e2e']];

function files(dir:string):string[]{return readdirSync(dir).flatMap(f=>{const p=join(dir,f);return statSync(p).isDirectory()?files(p):[p];});}
/** One hash for the static bundle: sha256 over "path sha256" lines of every dist file, sorted, source maps excluded. */
function distManifest():{hash:string;count:number}|null{
 if(!existsSync('dist/index.html'))return null;
 const lines=files('dist').filter(f=>!f.endsWith('.map')).map(f=>`${relative('dist',f).replace(/\\/g,'/')} ${sha256(readFileSync(f))}`).sort();
 return {hash:sha256(lines.join('\n')+'\n'),count:lines.length};
}

const outcome=(v:string):ReceiptCheck['status']=>v==='success'||v==='passed'?'passed':v==='failure'||v==='failed'?'failed':v==='skipped'?'skipped':'not_run';
const checks:ReceiptCheck[]=[];
const evidence:EvidenceRef[]=[];
const now=new Date().toISOString(),commit=process.env.GITHUB_SHA??git('rev-parse','HEAD');
const ref=(raw:Omit<EvidenceRef,'schema_version'|'captured_at'|'observed_revision'|'synthetic'|'producer_app'>)=>{const e=evidenceRefSchema.parse({schema_version:1,captured_at:now,observed_revision:commit,synthetic:false,producer_app:'diagramcloud',...raw});evidence.push(e);return e.evidence_id;};

const [mode='run',...args]=process.argv.slice(2);
if(mode==='record'){
 const given=Object.fromEntries(args.map(a=>a.split('=') as [string,string]));
 for(const [id,command] of COMMANDS)checks.push({check_id:id,command,status:outcome(given[id]??'not_run')});
}else if(mode==='run'){
 for(const [id,command] of COMMANDS){
  const start=Date.now(),r=spawnSync(command,{shell:true,stdio:'inherit'});
  checks.push({check_id:id,command,status:r.status===0?'passed':'failed',duration_ms:Date.now()-start});
  if(r.status!==0&&id!=='e2e')break;
 }
 for(const [id,command] of COMMANDS)if(!checks.some(c=>c.check_id===id))checks.push({check_id:id,command,status:'not_run'});
}else throw new Error(`Unknown mode ${mode}: use run or record`);

// The package check: the static bundle exists after a passed build, and its manifest hash is recorded.
const manifest=checks.find(c=>c.check_id==='build')?.status==='passed'?distManifest():null;
const pkgEvidence=manifest?[ref({evidence_id:`diagramcloud:dist-manifest:${manifest.hash.slice(0,16)}`,kind:'file',source_system:'filesystem',locator:{path:'dist/',files:manifest.count,method:'sha256 over sorted "path sha256" lines, source maps excluded'},integrity:`sha256:${manifest.hash}`,visibility:'public',review_state:'unreviewed'})]:[];
checks.splice(3,0,{check_id:'package',command:'static bundle manifest (dist/)',status:manifest?'passed':'not_run',summary:manifest?`${manifest.count} files`:'No dist/ bundle after a passed build',evidence_ref_ids:pkgEvidence});

if(process.env.GITHUB_RUN_ID&&process.env.GITHUB_REPOSITORY){
 const url=`${process.env.GITHUB_SERVER_URL??'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const id=ref({evidence_id:`github:${process.env.GITHUB_REPOSITORY}:run:${process.env.GITHUB_RUN_ID}`,kind:'pipeline',source_system:'github',locator:{url,run_id:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT??'1',workflow:process.env.GITHUB_WORKFLOW??'DiagramCloud CI'},visibility:'public',review_state:'unreviewed'});
 for(const c of checks)if(c.check_id!=='package')c.evidence_ref_ids=[id];
}
if(process.env.MANUAL_REVIEW){
 const bytes=readFileSync(process.env.MANUAL_REVIEW),review=JSON.parse(bytes.toString('utf8')) as {reviewer?:string;summary?:string;result?:string};
 const id=ref({evidence_id:`diagramcloud:manual-review:${sha256(bytes).slice(0,16)}`,kind:'manual_observation',source_system:'manual',locator:{file:process.env.MANUAL_REVIEW.replace(/\\/g,'/'),...(review.reviewer?{reviewer:review.reviewer}:{})},integrity:`sha256:${sha256(bytes)}`,visibility:'public',review_state:'reviewed',notes:review.summary?.slice(0,1000)});
 checks.push({check_id:'manual-visual',status:review.result==='passed'?'passed':'failed',summary:'Human visual review of screenshots and exports',evidence_ref_ids:[id]});
}

const dirty=!process.env.GITHUB_SHA&&git('status','--porcelain','--untracked-files=no').length>0;
const receipt=verificationReceipt({productVersion:pkg.version,documentSchemaVersion:1,repository:process.env.GITHUB_REPOSITORY??'julian-passebecq/diagramcloud',commit,branch:process.env.GITHUB_REF_NAME??git('rev-parse','--abbrev-ref','HEAD'),dirty,checks,evidenceRefs:evidence,
 caveats:['Chromium is the only browser this receipt covers.']});
mkdirSync('release',{recursive:true});
writeFileSync('release/verification-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(`Verification receipt: ${receipt.verification_level} (${receipt.status}) for ${receipt.revision.commit.slice(0,12)} → release/verification-receipt.json`);
if(receipt.status!=='passed')process.exitCode=1;
