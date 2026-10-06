import type {ProjectSnapshot,SnapshotRepository} from '../model';

/** Compare two revision vectors repository by repository. A missing revision on either side is `unknown`, never "unchanged". */
export type RepositoryChange={id:string;title:string;change:'added'|'removed'|'revision-changed'|'unchanged'|'unknown';from?:string;to?:string;fromStatus?:SnapshotRepository['scanStatus'];toStatus?:SnapshotRepository['scanStatus']};
export function compareSnapshots(before:ProjectSnapshot,after:ProjectSnapshot):RepositoryChange[]{
 const a=new Map(before.repositories.map(r=>[r.id,r])),b=new Map(after.repositories.map(r=>[r.id,r])),out:RepositoryChange[]=[];
 for(const r of after.repositories){const old=a.get(r.id);
  if(!old){out.push({id:r.id,title:r.title,change:'added',to:r.revision,toStatus:r.scanStatus});continue;}
  const change=!old.revision||!r.revision?'unknown':old.revision===r.revision?'unchanged':'revision-changed';
  out.push({id:r.id,title:r.title,change,from:old.revision,to:r.revision,fromStatus:old.scanStatus,toStatus:r.scanStatus});}
 for(const r of before.repositories)if(!b.has(r.id))out.push({id:r.id,title:r.title,change:'removed',from:r.revision,fromStatus:r.scanStatus});
 return out;
}

/**
 * Repositories whose information should not be trusted as current: never scanned, failed or missing, no known
 * revision, scanned longer ago than `maxAgeDays`, or (when the caller knows the current head, e.g. the CLI read
 * `.git/HEAD`) at a different revision than the snapshot. Detection only: nothing is polled or fetched.
 */
export type StaleRepository={id:string;title:string;reasons:string[]};
export function staleRepositories(snapshot:ProjectSnapshot,options:{now?:Date;maxAgeDays?:number;current?:Record<string,string|undefined>}={}):StaleRepository[]{
 const now=options.now??new Date(),maxAge=options.maxAgeDays??30,out:StaleRepository[]=[];
 for(const r of snapshot.repositories){
  const reasons:string[]=[];
  if(r.scanStatus==='not-scanned')reasons.push('never scanned');
  if(r.scanStatus==='failed')reasons.push(`last scan failed${r.note?`: ${r.note}`:''}`);
  if(r.scanStatus==='missing')reasons.push('source folder not found');
  if(!r.revision)reasons.push('revision unknown');
  if(r.scannedAt){const days=Math.floor((now.getTime()-Date.parse(r.scannedAt))/86400000);if(days>maxAge)reasons.push(`scanned ${days} days ago`);}
  const head=options.current?.[r.id];if(head&&r.revision&&!head.startsWith(r.revision)&&!r.revision.startsWith(head))reasons.push(`source is now at ${head.slice(0,12)}, snapshot has ${r.revision.slice(0,12)}`);
  if(reasons.length)out.push({id:r.id,title:r.title,reasons});
 }
 return out;
}
