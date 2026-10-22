import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

type SourceEnvironment=Partial<Pick<NodeJS.ProcessEnv,'VERCEL'|'VERCEL_GIT_COMMIT_SHA'|'GITHUB_SHA'>>;
export type SourceIdentity={revision?:string;basis:string};
const fullRevision=(value:string|undefined)=>value&&/^(?!0{40}$)[a-f0-9]{40}$/.test(value)?value:undefined;
const missingGit=(error:unknown)=>(error as NodeJS.ErrnoException)?.code==='ENOENT';

/** A clean HEAD identifies the checked-out source, not GitHub's different PR merge ref.
 * An archive may lack Git metadata: only then use a full provider-supplied source SHA.
 * Dirty or unreadable local metadata stays unknown and is never hidden by an env fallback,
 * with two Vercel build exceptions: the platform clones exactly VERCEL_GIT_COMMIT_SHA, so
 * (1) a HEAD equal to it with only untracked files (build tooling output) keeps that SHA, and
 * (2) a build image without a git executable uses it like a source archive.
 */
export function describeBuildSourceRevision(checkout=process.cwd(),env:SourceEnvironment=process.env):SourceIdentity{
 const vercel=env.VERCEL==='1'?fullRevision(env.VERCEL_GIT_COMMIT_SHA):undefined;
 // Require this checkout's metadata; never borrow an unrelated enclosing repository's HEAD.
 if(existsSync(join(checkout,'.git'))){
  let head:string|undefined,status:string;
  try{
   // Keep leading spaces: porcelain status columns start each line.
   const git=(args:string[])=>execFileSync('git',['--no-optional-locks',...args],{cwd:checkout,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).replace(/\s+$/,'');
   head=fullRevision(git(['rev-parse','--verify','HEAD^{commit}']));
   if(!head)return {basis:'omitted: checkout HEAD is not a full commit'};
   status=git(['status','--porcelain','--untracked-files=all']);
  }catch(error){
   if(missingGit(error)&&vercel)return {revision:vercel,basis:'Vercel commit SHA (no git executable in the build image)'};
   return {basis:head?'omitted: git status could not be read':'omitted: checkout metadata could not be read'};
  }
  if(!status)return {revision:head,basis:'clean Git checkout HEAD'};
  const lines=status.split('\n'),untracked=lines.filter(line=>line.startsWith('?? ')).map(line=>line.slice(3));
  if(vercel&&head===vercel&&untracked.length===lines.length)return {revision:head,basis:`Vercel commit SHA equals HEAD; untracked build files ignored: ${untracked.slice(0,5).join(', ')}${untracked.length>5?', ...':''}`};
  return {basis:`omitted: checkout has ${lines.length} changed or untracked path(s), e.g. ${lines.slice(0,5).map(line=>line.slice(3)).join(', ')}`};
 }
 const archive=fullRevision(env.VERCEL_GIT_COMMIT_SHA)??fullRevision(env.GITHUB_SHA);
 return archive?{revision:archive,basis:'source archive provider SHA'}:{basis:'omitted: no Git metadata and no provider SHA'};
}

export function buildSourceRevision(checkout=process.cwd(),env:SourceEnvironment=process.env):string|undefined{
 return describeBuildSourceRevision(checkout,env).revision;
}
