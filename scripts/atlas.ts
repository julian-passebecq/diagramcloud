/**
 * Project atlas CLI: scan every repository a project manifest lists (those with a local `path`) into one atlas.
 *   npm run atlas -- <project.manifest.json | .datapass/project.json> [--out atlas.json] [--previous atlas.json] [--stale-days 30]
 * Membership comes only from the manifest. Each repository is read like `npm run scan` (read-only, secret files never
 * read, no git commands, no network) and keeps its own revision. With --previous, the earlier snapshots are kept and
 * the revision vector is compared; stale or missing sources are always listed.
 */
import {existsSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {parseManifest,documentFromAtlas,compareSnapshots,staleRepositories,type AtlasScan} from '../src/core/atlas';
import {scanRepository} from '../src/core/scan';
import {parseDocument} from '../src/core/model';
import {readRepository} from './lib/readRepo';

const args=process.argv.slice(2),flag=(n:string)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:undefined;};
const out=flag('--out'),previousPath=flag('--previous'),staleDays=Number(flag('--stale-days')??30),manifestPath=resolve(args[0]??'project.manifest.json');
const {manifest,source}=parseManifest(readFileSync(manifestPath,'utf8'));
// A DataPass project file lives in .datapass/: its repository paths are relative to the project folder.
const base=source==='datapass'&&dirname(manifestPath).endsWith('.datapass')?dirname(dirname(manifestPath)):dirname(manifestPath);
const scans:Record<string,AtlasScan>={};
for(const r of manifest.repositories){
 if(!r.path)continue;
 const folder=resolve(base,r.path);
 if(!existsSync(folder)||!statSync(folder).isDirectory()){scans[r.id]={missing:true};continue;}
 try{scans[r.id]={model:scanRepository(readRepository(folder),{name:r.title})};}catch(e){scans[r.id]={error:e instanceof Error?e.message:String(e)};}
}
const previous=previousPath?parseDocument(readFileSync(previousPath,'utf8')):undefined;
const {document,report}=documentFromAtlas(manifest,scans,{previous,fileName:manifestPath.split(/[\/]/).pop()});
const json=JSON.stringify(document,null,2);
if(out)writeFileSync(out,json+'\n');else process.stdout.write(json+'\n');
const snaps=document.atlas!.snapshots,now=snaps[snaps.length-1];
const lines=[`Atlas ${manifest.project.title}: ${report.kept[0]}`,`  ${report.kept[1]}`,...report.lost.map(l=>`  not included: ${l}`)];
if(snaps.length>1){lines.push(`Compared with snapshot ${snaps[snaps.length-2].id}:`);for(const c of compareSnapshots(snaps[snaps.length-2],now))lines.push(`  ${c.id}: ${c.change}${c.from||c.to?` (${c.from?.slice(0,12)??'—'} → ${c.to?.slice(0,12)??'—'})`:''}`);}
const stale=staleRepositories(now,{maxAgeDays:staleDays});
lines.push(stale.length?`Stale or missing sources (${stale.length}):`:'No stale or missing sources.',...stale.map(s=>`  ${s.id}: ${s.reasons.join('; ')}`));
process.stderr.write(lines.join('\n')+'\n');
