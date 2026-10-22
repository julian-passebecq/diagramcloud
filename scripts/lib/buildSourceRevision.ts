import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';

type SourceEnvironment=Partial<Pick<NodeJS.ProcessEnv,'VERCEL_GIT_COMMIT_SHA'|'GITHUB_SHA'>>;
const fullRevision=(value:string|undefined)=>value&&/^(?!0{40}$)[a-f0-9]{40}$/.test(value)?value:undefined;

/** A clean HEAD identifies the checked-out source, not GitHub's different PR merge ref.
 * An archive may lack Git metadata: only then use a full provider-supplied source SHA.
 * Dirty or unreadable local metadata stays unknown and is never hidden by an env fallback.
 */
export function buildSourceRevision(checkout=process.cwd(),env:SourceEnvironment=process.env):string|undefined{
 // Require this checkout's metadata; never borrow an unrelated enclosing repository's HEAD.
 if(existsSync(join(checkout,'.git'))){
  try{
   const git=(args:string[])=>execFileSync('git',['--no-optional-locks',...args],{cwd:checkout,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).trim();
   const revision=fullRevision(git(['rev-parse','--verify','HEAD^{commit}']));
   return revision&&!git(['status','--porcelain','--untracked-files=all'])?revision:undefined;
  }catch{return undefined;}
 }
 return fullRevision(env.VERCEL_GIT_COMMIT_SHA)??fullRevision(env.GITHUB_SHA);
}
