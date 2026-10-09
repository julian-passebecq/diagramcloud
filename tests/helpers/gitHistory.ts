import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
/** Real, isolated Git histories. Nothing is copied from a developer checkout. */
export function gitHistory(){
 const temporary=resolve(tmpdir()),base=mkdtempSync(join(temporary,'diagramcloud-git-fixture-')),repository=join(base,'repository');mkdirSync(repository);
 const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_AUTHOR_NAME:'Synthetic Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Synthetic Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'};
 const git=(...args:string[])=>execFileSync('git',['-c','core.hooksPath=.fixture-no-hooks',...args],{cwd:repository,env,encoding:'utf8'}).trim();
 git('init','--initial-branch=main');git('config','core.autocrlf','false');let commits=0;
 const commit=(files:Record<string,string>,message:string)=>{for(const [path,text] of Object.entries(files)){if(!path||path.split(/[\\/]/).some(s=>s==='..'||s==='.git')||/^(?:[a-z]:|[\\/])/i.test(path))throw new Error('Invalid fixture source path');const target=join(repository,path);mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,text);}
  const when=new Date(Date.UTC(2026,0,1,0,0,commits++)).toISOString();execFileSync('git',['-c','core.hooksPath=.fixture-no-hooks','add','--all'],{cwd:repository,env});execFileSync('git',['-c','core.hooksPath=.fixture-no-hooks','commit','-m',message],{cwd:repository,env:{...env,GIT_AUTHOR_DATE:when,GIT_COMMITTER_DATE:when},stdio:'pipe'});return git('rev-parse','HEAD');};
 const first=commit({'README.md':'# Synthetic Git fixture\n','package.json':'{"name":"synthetic-history","private":true}\n'},'Synthetic initial revision');
 const worktree=(branch:string)=>{if(!/^[a-z][a-z0-9-]*$/.test(branch))throw new Error('Invalid fixture branch');const target=join(base,'worktree-'+branch);git('worktree','add','-b',branch,target);return target;};
 const cleanup=()=>{const target=resolve(base);if(!target.startsWith(temporary+sep)||!target.split(sep).at(-1)?.startsWith('diagramcloud-git-fixture-'))throw new Error('Refused fixture cleanup outside the verified temporary root');rmSync(target,{recursive:true,force:true});};
 return {base,repository,first,git,commit,worktree,cleanup};
}
