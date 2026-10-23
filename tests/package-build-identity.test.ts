import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertPackageBuildIdentity} from '../scripts/lib/packageBuildIdentity';

const sourceSha='a'.repeat(40),productVersion='1.33.1',expected={sourceSha,productVersion};
const handshake={schema_version:1,app_id:'diagramcloud',product_version:productVersion,source_revision:sourceSha,galaxy_level:'G0',standalone:true};
function fixture(t:TestContext){
 const root=mkdtempSync(join(tmpdir(),'diagramcloud-build-identity-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const directory=join(root,'dist','galaxy');mkdirSync(directory,{recursive:true});
 return {root,file:join(directory,'version-handshake.json')};
}

test('packaging accepts the exact build identity without changing its bytes',t=>{
 const {root,file}=fixture(t),raw=JSON.stringify({...handshake,generated_at:'2026-10-23T00:00:00Z',additional:'retained'},null,2)+'\n';
 writeFileSync(file,raw);assert.doesNotThrow(()=>assertPackageBuildIdentity(root,expected));assert.equal(readFileSync(file,'utf8'),raw);
 assert.equal(existsSync(join(root,'.local')),false);
});

for(const [label,value] of [
 ['missing source',({...handshake,source_revision:undefined})],
 ['stale source',{...handshake,source_revision:'b'.repeat(40)}],
 ['abbreviated source',{...handshake,source_revision:sourceSha.slice(0,7)}],
 ['zero source',{...handshake,source_revision:'0'.repeat(40)}],
 ['wrong version',{...handshake,product_version:'1.33.0'}],
 ['missing version',{...handshake,product_version:undefined}],
 ['wrong application',{...handshake,app_id:'another-app'}],
 ['wrong schema',{...handshake,schema_version:2}],
 ['non-standalone',{...handshake,standalone:false}],
 ['wrong maturity',{...handshake,galaxy_level:'G1'}],
 ['null',null],['array',[]],['string','not a handshake'],['empty object',{}]
] as const)test('packaging refuses '+label+' without modifying the existing build',t=>{
 const {root,file}=fixture(t),raw=JSON.stringify(value);writeFileSync(file,raw);
 assert.throws(()=>assertPackageBuildIdentity(root,expected),/Packaged web build/);assert.equal(readFileSync(file,'utf8'),raw);
});

for(const [label,raw] of [['malformed JSON','{broken'],['empty file',''],['oversized file',' '.repeat(64*1024+1)]] as const)test('packaging refuses '+label,t=>{
 const {root,file}=fixture(t);writeFileSync(file,raw);assert.throws(()=>assertPackageBuildIdentity(root,expected),/missing or unreadable/);
});

test('packaging refuses an index-only build with no handshake',t=>{
 const {root}=fixture(t);writeFileSync(join(root,'dist','index.html'),'<html>Old synthetic build</html>');
 assert.throws(()=>assertPackageBuildIdentity(root,expected),/missing or unreadable/);
});

test('packaging refuses a directory in place of the handshake',t=>{
 const {root,file}=fixture(t);mkdirSync(file);assert.throws(()=>assertPackageBuildIdentity(root,expected),/missing or unreadable/);
});

test('changing only the selected version or source cannot qualify an older build',t=>{
 const {root,file}=fixture(t);writeFileSync(file,JSON.stringify(handshake));
 assert.throws(()=>assertPackageBuildIdentity(root,{...expected,productVersion:'1.33.2'}),/source\/version/);
 assert.throws(()=>assertPackageBuildIdentity(root,{...expected,sourceSha:'b'.repeat(40)}),/source\/version/);
});

test('unknown expected identity is refused rather than inferred from the old output',t=>{
 const {root,file}=fixture(t);writeFileSync(file,JSON.stringify(handshake));
 for(const sourceSha of ['', 'HEAD','a'.repeat(7),'0'.repeat(40)])assert.throws(()=>assertPackageBuildIdentity(root,{sourceSha,productVersion}),/Exact source/);
 assert.throws(()=>assertPackageBuildIdentity(root,{sourceSha,productVersion:' '}),/Exact source/);
});
