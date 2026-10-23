import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const script=resolve('scripts/package-campaign.ts'),tsx=resolve('node_modules/tsx/dist/cli.mjs');
/** Real packager preflight, Git and filesystem; intentionally incomplete source.
 * The receipt is a synthetic test input, not real CI evidence, and the candidate
 * must be refused before any output or bundling. Nothing is published.
 */
function fixture(t:TestContext,kind:'missing'|'stale'|'version'){
 const root=mkdtempSync(join(tmpdir(),'diagramcloud-package-preflight-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 writeFileSync(join(root,'package.json'),JSON.stringify({name:'synthetic-package-preflight',version:'1.33.1',type:'module'}));
 writeFileSync(join(root,'.gitignore'),'dist/\n.local/\n');
 git('init','--quiet');git('add','package.json','.gitignore');git('-c','user.name=Synthetic fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','Synthetic packaging fixture');
 const head=git('rev-parse','HEAD');mkdirSync(join(root,'dist','galaxy'),{recursive:true});mkdirSync(join(root,'.local'));
 writeFileSync(join(root,'dist','index.html'),'<html>Synthetic old build</html>');
 if(kind!=='missing')writeFileSync(join(root,'dist','galaxy','version-handshake.json'),JSON.stringify({schema_version:1,app_id:'diagramcloud',product_version:kind==='version'?'1.33.0':'1.33.1',source_revision:kind==='stale'?'b'.repeat(40):head,galaxy_level:'G0',standalone:true}));
 const ref=join(root,'.local','synthetic-evidence.txt');writeFileSync(ref,'SYNTHETIC TEST INPUT ONLY. Not a test result or a CI receipt.\n');
 const receipt=join(root,'.local','synthetic-receipt.json');writeFileSync(receipt,JSON.stringify({sourceSha:head,ci:{sourceSha:head,url:'https://github.com/julian-passebecq/diagramcloud/actions/runs/0',conclusion:'success'},checks:['typecheck','unit','build','browser','real-atlas-quality','pptx-zip','pptx-visual','bundled-cli'].map(id=>({id,status:'PASS',evidenceRefs:[ref]}))}));
 assert.equal(git('status','--porcelain','--untracked-files=all'),'');
 return {root,receipt,out:join(root,'.local','refused-package')};
}
for(const dryRun of [true,false])for(const kind of ['missing','stale','version'] as const)test(`${dryRun?'dry run':'candidate'} refuses ${kind} build identity before creating output`,t=>{
 const {root,receipt,out}=fixture(t,kind);
 const result=spawnSync(process.execPath,[tsx,script,...(dryRun?['--dry-run']:['--evidence',receipt]),'--out',out],{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
 assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.notEqual(result.status,0);
 assert.match(result.stderr,/Packaged web build/);assert.equal(existsSync(out),false,'No candidate or partial package directory may be created');
});
