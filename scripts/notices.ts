import {existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
/** Preserve notices from installed packages; no network access and no font copying. */
export function generateNotices():void {
 const parts=['DIAGRAMCLOUD - INSTALLED DEPENDENCY NOTICES','Generated from this build. Includes build/test dependencies, not just runtime code.','Original application: MIT. Microsoft artwork: separate permitted-use terms; see THIRD_PARTY_NOTICES.md.'];
 const seen=new Set<string>();
 function packageAt(dir:string){const manifest=join(dir,'package.json');if(!existsSync(manifest))return;const p=JSON.parse(readFileSync(manifest,'utf8')) as {name?:string;version?:string;license?:unknown};const key=`${p.name}@${p.version}`;if(seen.has(key))return;seen.add(key);parts.push('\n============================================================',key,`Declared license: ${JSON.stringify(p.license??'Not declared; review upstream')}`);const names=readdirSync(dir).filter(n=>/^(licen[cs]e|copying|notice)([._-].*)?$/i.test(n));for(const name of names){try{parts.push(`--- ${name} ---`,readFileSync(join(dir,name),'utf8'));}catch{/* A directory with a matching name is not a license text. */}}if(!names.length)parts.push('No top-level license file found. Refer to upstream source and package metadata.');scan(join(dir,'node_modules'));}
 function scan(dir:string){if(!existsSync(dir))return;for(const item of readdirSync(dir,{withFileTypes:true})){if(item.name.startsWith('.'))continue;const path=join(dir,item.name);if(item.name.startsWith('@')){for(const child of readdirSync(path))packageAt(join(path,child));}else packageAt(path);}}
 scan('node_modules');mkdirSync('public',{recursive:true});writeFileSync('public/third-party-licenses.txt',parts.join('\n')+'\n');console.log(`Preserved available license notices for ${seen.size} installed package versions.`);
}
