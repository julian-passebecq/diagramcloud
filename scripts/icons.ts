import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {ICON_REGISTRY} from '../src/core/icons';

/** Git's blob ID for file bytes: sha1("blob <size>\0" + bytes). Equal to the upstream blob only for an unmodified copy. */
export function gitBlobId(bytes:Uint8Array):string{
 return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
}

/** Problems between public/icons and the registry; an empty list means every shipped icon is registered and unmodified. */
export function iconProblems(publicDir='public'):string[]{
 const problems:string[]=[],dir=join(publicDir,'icons'),files=existsSync(dir)?readdirSync(dir).filter(f=>!f.startsWith('.')):[];
 for(const f of files)if(!ICON_REGISTRY.some(e=>e.file===`icons/${f}`))problems.push(`public/icons/${f} is not in the icon registry (src/core/icons.ts). Record its source, version, blob and terms, or remove it.`);
 for(const e of ICON_REGISTRY){
  if(e.origin==='original'){if(e.file)problems.push(`${e.id}: original symbols are drawn in code and must not ship a file`);continue;}
  if(!e.file||!e.source||!e.terms||!e.vendor)problems.push(`${e.id}: a vendor icon needs file, vendor, source and terms`);
  if(!e.file)continue;
  const path=join(publicDir,e.file);
  if(!existsSync(path)){problems.push(`${e.id}: ${path} is missing`);continue;}
  const bytes=readFileSync(path),blob=gitBlobId(bytes);
  if(e.source&&blob!==e.source.blob)problems.push(`${e.id}: ${path} has git blob ${blob}, but the registry records ${e.source.blob}. Vendor artwork must be the unmodified upstream file.`);
  if(e.source&&!/^[0-9a-f]{40}$/.test(e.source.commit))problems.push(`${e.id}: record the full upstream commit`);
 }
 return problems;
}

export function checkIcons(publicDir='public'):void{
 const problems=iconProblems(publicDir);
 if(problems.length)throw new Error(`Icon registry check failed:\n- ${problems.join('\n- ')}`);
 console.log(`Icon registry: ${ICON_REGISTRY.length} entries; every shipped icon matches its recorded source.`);
}
