import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Immutable catalogue bytes retain original acceptance and dependency text.
const catalogue=readFileSync('docs/product/FEATURES_PREPRO_20261008.csv','utf8').replace(/\r\n/g,'\n');
const originalRows=new Map(catalogue.trim().split('\n').slice(1).map(line=>{const fields:string[]=[],chars=[...line];let text='',quoted=false;for(let i=0;i<chars.length;i++){const c=chars[i];if(c==='\"'){if(quoted&&chars[i+1]==='\"'){text+=c;i++;}else quoted=!quoted;}else if(c===','&&!quoted){fields.push(text);text='';}else text+=c;}fields.push(text);return [fields[0],fields] as const;}));
const outcome=JSON.parse(readFileSync('outcome.json','utf8'));
test('campaign preserves all original identities, horizons, acceptance source and earlier candidate history',()=>{
 assert.equal(createHash('sha256').update(catalogue).digest('hex'),'cfb6b57c5412473d57bf569ac23930fc45b0e7ab7008f28fce4de46c4b08aec4');
 assert.deepEqual(outcome.features.map((r:{id:string})=>r.id),Array.from({length:115},(_,i)=>'F'+String(i+1).padStart(3,'0')));
 const v1='F002 F005 F009 F010 F012 F013 F019 F020 F021 F023 F031 F038 F039 F046 F050 F053 F062 F063 F064 F067 F068 F070 F093 F094 F096 F097 F106 F115'.split(' ');
 const v3='F030 F036 F054 F055 F056 F057 F058 F059 F060 F085 F086 F112 F113 F114'.split(' ');
 const v4='F004 F061 F071 F072'.split(' '),rd='F044 F045 F100 F102'.split(' ');
 for(const r of outcome.features){assert.equal(r.horizon,v1.includes(r.id)?'V1':v3.includes(r.id)?'V3':v4.includes(r.id)?'V4':rd.includes(r.id)?'R&D':'V2');assert.equal(r.name,originalRows.get(r.id)![2]);assert.equal(r.originalAcceptance,originalRows.get(r.id)![10]);assert.deepEqual(r.dependencies,originalRows.get(r.id)![8].split(';').filter(v=>v!=='none'));assert.ok(Array.isArray(r.dependencies));for(const id of r.dependencies)assert.ok(outcome.features.some((v:{id:string})=>v.id===id));for(const p of r.evidence)assert.ok(existsSync(p),r.id+': missing '+p);if(['V1','V2','V3'].includes(r.horizon)){const prior=r.implementationHistory.find((h:{sourceSha:string})=>h.sourceSha==='f38ab2dfc6fc977b3ddba235f145e4e11d51db88');assert.ok(prior);assert.ok(prior.status&&prior.limitation&&prior.evidence.length);}}
 assert.deepEqual(outcome.dg.map((r:{id:string})=>r.id),Array.from({length:17},(_,i)=>'DG-'+String(i+1).padStart(3,'0')));
 for(const r of outcome.dg.filter((r:{id:string})=>['DG-005','DG-016'].includes(r.id)))assert.ok(r.implementationHistory[0].evidence.every((v:string)=>!['src/intelligence/graphProjection.ts','src/ui/GraphFilters.tsx','tests/graph-projection.test.ts','tests/e2e/graph-canvas-library.spec.ts','scripts/qualify-real.ts'].includes(v)));
 assert.equal(outcome.ownerVerified,false);assert.equal(outcome.merged,true);assert.equal(outcome.deployed,true);assert.equal(outcome.release.mergeCommit,'f230ae0f234092ddeaaf6b5925f56568d425bf83');assert.match(outcome.release.package,/^PUBLISHED privately .*galaxy-release-vault generic package diagramcloud.1.25.0-f230ae0 /);assert.equal(outcome.release.packageReceipt.sourceSha,outcome.release.mergeCommit);assert.match(outcome.release.packageReceipt.anonymousAccess,/^refused/);assert.equal(outcome.release.tag,'none');
});
