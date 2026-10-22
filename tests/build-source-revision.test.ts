import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildSourceRevision} from '../scripts/lib/buildSourceRevision';
import {versionHandshake} from '../src/core/galaxy';

const providerSha='a'.repeat(40),mergeSha='b'.repeat(40);
function directory(t:{after(fn:()=>void):void}){const path=mkdtempSync(join(tmpdir(),'diagramcloud-build-source-'));t.after(()=>rmSync(path,{recursive:true,force:true}));return path;}
function checkout(path:string){
 const git=(args:string[])=>execFileSync('git',args,{cwd:path,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git(['init','--quiet']);
 writeFileSync(join(path,'source.ts'),'export const synthetic=1;\n');writeFileSync(join(path,'.gitignore'),'generated/\n');git(['add','source.ts','.gitignore']);
 git(['-c','user.name=Synthetic build test','-c','user.email=build-test@example.invalid','-c','commit.gpgsign=false','commit','--quiet','--allow-empty','-m','Synthetic source identity fixture']);
 return {git,head:git(['rev-parse','HEAD'])};
}

test('the real checkout HEAD wins over GitHub PR merge and Vercel environment SHAs',t=>{
 const path=directory(t),{head}=checkout(path);
 assert.notEqual(head,mergeSha);assert.notEqual(head,providerSha);
 const revision=buildSourceRevision(path,{GITHUB_SHA:mergeSha,VERCEL_GIT_COMMIT_SHA:providerSha});
 assert.equal(revision,head);
 assert.equal(versionHandshake({productVersion:'1.33.1',sourceRevision:revision}).source_revision,head);
});

test('a linked worktree .git file resolves its own checked-out commit',t=>{
 const path=directory(t),repo=join(path,'repository'),worktree=join(path,'linked-worktree');mkdirSync(repo);
 const {git,head}=checkout(repo);git(['worktree','add','--quiet','--detach',worktree,head]);
 assert.equal(buildSourceRevision(worktree,{GITHUB_SHA:mergeSha}),head);
});

test('a source archive uses Vercel source metadata before GitHub metadata',t=>{
 const path=directory(t);
 assert.equal(buildSourceRevision(path,{VERCEL_GIT_COMMIT_SHA:providerSha,GITHUB_SHA:mergeSha}),providerSha);
});

test('invalid or missing Vercel metadata falls back to a valid GitHub SHA',t=>{
 const path=directory(t);
 for(const value of [undefined,'',providerSha.slice(0,7),'not-a-revision','0'.repeat(40),providerSha+'\n']){
  assert.equal(buildSourceRevision(path,{VERCEL_GIT_COMMIT_SHA:value,GITHUB_SHA:mergeSha}),mergeSha);
 }
});

test('absent or invalid source metadata leaves the optional identity absent',t=>{
 const path=directory(t);
 for(const value of [undefined,'','HEAD',mergeSha.slice(0,7),'z'.repeat(40),'0'.repeat(40),' '+mergeSha]){
  const revision=buildSourceRevision(path,{VERCEL_GIT_COMMIT_SHA:value,GITHUB_SHA:value});assert.equal(revision,undefined);
  assert.equal(versionHandshake({productVersion:'1.33.1',...(revision?{sourceRevision:revision}:{})}).source_revision,undefined);
 }
});

test('an archive inside another repository never inherits the enclosing HEAD',t=>{
 const path=directory(t);checkout(path);const archive=join(path,'source-archive');mkdirSync(archive);
 assert.equal(buildSourceRevision(archive,{}),undefined);
 assert.equal(buildSourceRevision(archive,{VERCEL_GIT_COMMIT_SHA:providerSha}),providerSha);
});

test('an unborn checkout does not pretend provider metadata identifies its source',t=>{
 const path=directory(t);execFileSync('git',['init','--quiet'],{cwd:path,stdio:'ignore'});
 assert.equal(buildSourceRevision(path,{}),undefined);
 assert.equal(buildSourceRevision(path,{VERCEL_GIT_COMMIT_SHA:providerSha,GITHUB_SHA:mergeSha}),undefined);
});

for(const kind of ['tracked','untracked'])test(`a ${kind} source change omits exact identity even with valid provider SHAs`,t=>{
 const path=directory(t);checkout(path);
 writeFileSync(join(path,kind==='tracked'?'source.ts':'new-source.ts'),'export const synthetic=2;\n');
 assert.equal(buildSourceRevision(path,{VERCEL_GIT_COMMIT_SHA:providerSha,GITHUB_SHA:mergeSha}),undefined);
});

test('ignored generated output does not invalidate a clean source identity',t=>{
 const path=directory(t),{head}=checkout(path);mkdirSync(join(path,'generated'));writeFileSync(join(path,'generated','output.json'),'{}\n');
 assert.equal(buildSourceRevision(path,{GITHUB_SHA:mergeSha}),head);
});

test('an unreadable Git index does not fall back to a provider SHA',t=>{
 const path=directory(t);checkout(path);writeFileSync(join(path,'.git','index'),'invalid synthetic index');
 assert.equal(buildSourceRevision(path,{VERCEL_GIT_COMMIT_SHA:providerSha,GITHUB_SHA:mergeSha}),undefined);
});
