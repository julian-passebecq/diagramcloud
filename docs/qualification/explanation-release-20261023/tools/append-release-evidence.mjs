import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';

// Default: local preparation only. --commit is the sole ref-writing mode.
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const source='130c70744ec8fdeefebb784c56afb53c182f8dfa';
const parent='856355e7e57073a7252e55e1eeb15b9555aabd5f';
const sourceTree='b90ea89563174a2921047a7e239c5c190e58fc50';
const ref='refs/heads/codex/diagramcloud-release-evidence-20261023';
const prefix='docs/qualification/explanation-release-20261023/';
const commitMode=process.argv.includes('--commit');
if(process.argv.slice(2).some(x=>!['--commit','--prepare'].includes(x)))throw Error('Only --prepare or --commit is supported');
if(commitMode&&process.argv.includes('--prepare'))throw Error('Choose one mode');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(args,opts={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,...opts});
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const guard=()=>{
  assert(git(['rev-parse','HEAD']).trim()===source,'Source HEAD changed');
  assert(git(['rev-parse','HEAD^{tree}']).trim()===sourceTree,'Source tree changed');
  assert(!git(['status','--porcelain=v1','--untracked-files=all']).trim(),'Source worktree/index is dirty');
  assert(git(['rev-parse',ref]).trim()===parent,'Evidence branch moved from the expected first commit');
};
guard();
const configuration=JSON.parse(fs.readFileSync(path.join(here,'release-evidence-final-files.json'),'utf8'));
assert(configuration.sourceSha===source&&configuration.parent===parent&&configuration.ref===ref&&configuration.prefix===prefix,'Evidence manifest identity changed');
if(commitMode){
  const publicationBytes=fs.readFileSync(path.join(here,'private-publication-1.33.1-130c707/publication-receipt.json'));
  const publication=JSON.parse(publicationBytes);
  assert(publication.status==='FAILED_OR_PARTIAL'&&publication.source_sha===source&&publication.package_version==='1.33.1-130c707'&&publication.package_id===73606090,'Preserved first transport-failure receipt identity differs');
  assert(publication.uploads?.length===14&&publication.writes_attempted===14&&new Set(publication.uploads.map(row=>row.file)).size===14&&publication.uploads.every(row=>row.response==='201 Created'),'Original publication does not prove exactly14 completed uploads');
  const recovery=JSON.parse(fs.readFileSync(path.join(here,'private-publication-readback-recovery-1.33.1-130c707/readback-receipt.json'),'utf8'));
  assert(recovery.status==='PASS'&&recovery.sourceSha===source&&recovery.packageVersion==='1.33.1-130c707'&&recovery.packageId===73606090&&recovery.remoteWrites===0,'GET-only recovery identity or result differs');
  assert(recovery.originalPublicationStatus===publication.status&&recovery.originalPublicationReceiptUnchanged===true&&recovery.originalPublicationReceiptSha256===sha(publicationBytes),'GET recovery does not bind the unchanged original failure receipt');
  const originalUploads=new Map(publication.uploads.map(row=>[row.file,row]));
  assert(recovery.readbacks?.length===14&&recovery.failures?.length===0&&new Set(recovery.readbacks.map(row=>row.file)).size===14,'GET recovery lacks exactly14 independent successful readbacks');
  for(const row of recovery.readbacks){
    const original=originalUploads.get(row.file);
    assert(original&&row.status==='PASS'&&row.authenticatedMatch===true&&[401,403,404].includes(row.anonymousStatus)&&row.sha256===original.sha256&&row.bytes===original.bytes,'Recovered file differs from original upload or lacks anonymous refusal');
  }
  const candidate=JSON.parse(fs.readFileSync(path.join(here,'candidate-audit.json'),'utf8'));
  assert(candidate.result==='PASS'&&candidate.sourceCommit===source,'Final candidate audit is not passing for this source');
}
const previousManifest=JSON.parse(git(['show',parent+':'+prefix+'EVIDENCE-MANIFEST.json']));
const merged=new Map(previousManifest.files.map(row=>[row.target,{...row,origin:'parent-commit'}]));
for(const row of configuration.files)merged.set(row.target,{...row,origin:'local'});
const entries=[...merged.values()],targets=new Set(),inputs=new Set();
const disallowed=/(?:\.private\.|(?:^|\/)(?:profiles?|user-data|__pycache__)(?:\/|$)|artifact\.zip$|\.(?:vsix|tar\.gz|tgz|webm|mp4|html)$|(?:^|\/)trace[^/]*\.zip$)/i;
for(const row of entries){
  assert(typeof row.source==='string'&&row.source.startsWith('.local/continuation/')&&!row.source.includes('\\')&&!row.source.split('/').includes('..'),'Unsafe evidence source');
  assert(typeof row.target==='string'&&row.target.startsWith(prefix)&&!row.target.includes('\\')&&!row.target.split('/').includes('..'),'Unsafe evidence target');
  assert(!disallowed.test(row.source)&&!disallowed.test(row.target),'Excluded artifact in evidence allowlist');
  assert(!targets.has(row.target)&&!inputs.has(row.source),'Duplicate evidence mapping');
  assert(!['SHA256SUMS.txt','EVIDENCE-MANIFEST.json','EVIDENCE-SCAN.json'].includes(row.target.slice(prefix.length)),'Generated evidence path must not be supplied');
  targets.add(row.target);inputs.add(row.source);
}
const privateConfig=JSON.parse(fs.readFileSync(path.join(here,'evidence-scan-input.private.json'),'utf8'));
assert(typeof privateConfig.atlasPath==='string','Private scan input reference missing');
const privateBytes=fs.readFileSync(privateConfig.atlasPath),privateAtlas=JSON.parse(privateBytes.toString('utf8'));
const candidates=new Set();
function collect(value){
  if(!value||typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)){
    if(typeof item==='string'&&['name','label','title','url','href','locator'].includes(key)&&item.trim().length>=8)candidates.add(item.trim());
    else if(item&&typeof item==='object')collect(item);
  }
}
collect(privateAtlas);
// Avoid declaring ordinary public product names to be leaked private atlas names.
const tracked=git(['ls-files','-z']).split('\0').filter(Boolean);let publicCorpus=tracked.map(name=>name+'\n'+path.basename(name)).join('\n');
for(const name of tracked){const bytes=fs.readFileSync(path.join(root,name));if(bytes.length<2*1024*1024&&!bytes.includes(0))publicCorpus+='\n'+bytes.toString('utf8');}
const privateOnly=[...candidates].filter(term=>!publicCorpus.includes(term));
const textExtensions=new Set(['.json','.md','.txt','.log','.py','.mjs','.js','.ps1']);
const scanRows=[],prepared=[],missing=[];
const patterns=[
  ['credential-token',/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|glpat-[A-Za-z0-9_-]{16,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16})/g],
  ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['authorization-value',/Authorization["']?\s*[:=]\s*["']?(?:Bearer|Basic)\s+[A-Za-z0-9+\/_=-]{16,}/gi],
  ['credential-url',/\b(?:https?|mongodb(?:\+srv)?):\/\/[^\s/@:]+:[^\s/@]+@/gi],
  ['signed-url',/[?&](?:X-Amz-Signature|X-Goog-Signature|access_token|private_token|sig|token)=[A-Za-z0-9%+\/_=-]{16,}/gi],
  ['profile-payload',/"(?:cookies|origins)"\s*:\s*\[\s*\{/g],
];
function inspect(bytes,target){
  if(!textExtensions.has(path.extname(target).toLowerCase()))return {target,text:false,findings:[],machinePathMentions:0};
  const text=bytes.toString('utf8'),findings=[];
  const finding=(kind,index)=>findings.push({kind,line:text.slice(0,index).split('\n').length});
  for(const [kind,pattern] of patterns){pattern.lastIndex=0;for(const match of text.matchAll(pattern))finding(kind,match.index);}
  for(const term of privateOnly){const at=text.indexOf(term);if(at>=0)finding('private-atlas-only-name-or-url',at);}
  const atlasVariants=[privateConfig.atlasPath,privateConfig.atlasPath.replaceAll('\\','/'),path.basename(privateConfig.atlasPath)];
  for(const term of atlasVariants){const at=text.indexOf(term);if(at>=0)finding('private-atlas-input-reference',at);}
  const machinePathMentions=(text.match(/[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)[^\s"']+/g)||[]).length;
  return {target,text:true,findings,machinePathMentions};
}
for(const row of entries){
  const absolute=path.resolve(root,row.source);
  assert(absolute.startsWith(here+path.sep),'Evidence source escaped the continuation directory');
  let bytes;
  if(row.origin==='parent-commit'){
    bytes=git(['show',parent+':'+row.target],{encoding:null});
    assert(sha(bytes)===row.sha256&&bytes.length===row.bytes,'Prior committed evidence differs from its manifest');
  }else{
    if(!fs.existsSync(absolute)){missing.push(row.source);continue;}
    const stat=fs.lstatSync(absolute);assert(stat.isFile()&&!stat.isSymbolicLink(),'Evidence source must be a regular file');
    bytes=fs.readFileSync(absolute);
  }
  assert(bytes.length<8*1024*1024,'Evidence file exceeds bounded upload size');
  scanRows.push(inspect(bytes,row.target));prepared.push({...row,bytes:bytes.length,sha256:sha(bytes),data:bytes});
}
const findings=scanRows.flatMap(row=>row.findings.map(f=>({target:row.target,...f})));
const scan={format:'diagramcloud.release-evidence-scan/1',sourceSha:source,capturedAt:new Date().toISOString(),
  scannedFiles:scanRows.length,scannedTextFiles:scanRows.filter(r=>r.text).length,
  binaryFilesNotTextScanned:scanRows.filter(r=>!r.text).map(r=>r.target),
  privateAtlasInputSha256:sha(privateBytes),candidateTerms:candidates.size,privateOnlyTermsChecked:privateOnly.length,
  findings,missing,passed:findings.length===0,
  limits:['Pattern and exact-term scan, not a proof that every possible secret is absent.','Private atlas names/URLs and matched text are never written to this report.','Public product names already present in tracked source are not treated as private atlas leakage.','Machine workspace/runtime paths are counted as informational references; browser profile contents remain excluded.','Synthetic deck and screenshot contents rely on the separately recorded visual reviews.'],
  files:scanRows};
fs.writeFileSync(path.join(here,'release-evidence-final-scan.json'),JSON.stringify(scan,null,2)+'\n');
assert(findings.length===0,'Sensitive evidence findings require review; see sanitized release-evidence-scan.json');
const manifest={format:'diagramcloud.release-evidence-manifest/1',sourceSha:source,parent,ref,prefix,
  files:prepared.map(({data,...row})=>row),missing,complete:missing.length===0};
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
const scanBytes=Buffer.from(JSON.stringify(scan,null,2)+'\n');
fs.writeFileSync(path.join(here,'release-evidence-final-manifest.json'),manifestBytes);
prepared.push({source:'.local/continuation/release-evidence-final-manifest.json',target:prefix+'EVIDENCE-MANIFEST.json',data:manifestBytes,bytes:manifestBytes.length,sha256:sha(manifestBytes)});
prepared.push({source:'.local/continuation/release-evidence-final-scan.json',target:prefix+'EVIDENCE-SCAN.json',data:scanBytes,bytes:scanBytes.length,sha256:sha(scanBytes)});
const sums=Buffer.from(prepared.map(row=>row.sha256+'  '+row.target.slice(prefix.length)).sort().join('\n')+'\n');
fs.writeFileSync(path.join(here,'RELEASE-EVIDENCE-FINAL-SHA256SUMS.txt'),sums);
prepared.push({source:'.local/continuation/RELEASE-EVIDENCE-FINAL-SHA256SUMS.txt',target:prefix+'SHA256SUMS.txt',data:sums,bytes:sums.length,sha256:sha(sums)});
if(!commitMode){
  process.stdout.write(JSON.stringify({mode:'prepare',sourceSha:source,ref,actualFiles:prepared.length,pending:missing,sensitiveFindings:0,commitCreated:false},null,2)+'\n');
}else{
  assert(missing.length===0,'Evidence files remain pending; no commit created');
  guard();
  const index=path.join(here,'release-evidence-final-index-'+crypto.randomUUID());
  const env={...process.env,GIT_INDEX_FILE:index};
  const realIndex=git(['rev-parse','--git-path','index']).trim(),realIndexPath=path.resolve(root,realIndex);
  const beforeIndex=fs.existsSync(realIndexPath)?sha(fs.readFileSync(realIndexPath)):null;
  try{
    git(['read-tree',parent],{env});
    for(const row of prepared){
      // Use the exact scanned snapshot, and reject concurrent local evidence edits.
      if(row.origin!=='parent-commit')assert(sha(fs.readFileSync(path.join(root,row.source)))===row.sha256,'Evidence changed after scan');
      const oid=git(['hash-object','-w','--stdin'],{input:row.data}).trim();
      git(['update-index','--add','--cacheinfo','100644',oid,row.target],{env});
    }
    const tree=git(['write-tree'],{env}).trim();
    const changed=git(['diff-tree','--no-commit-id','--name-only','-r',parent,tree]).trim().split('\n').filter(Boolean);
    const allowedChanges=new Set([...configuration.files.map(row=>row.target),...['EVIDENCE-MANIFEST.json','EVIDENCE-SCAN.json','SHA256SUMS.txt'].map(name=>prefix+name)]);
    assert(changed.length>0&&changed.every(name=>allowedChanges.has(name)),'Evidence tree changed outside the explicit final delta');
    guard();
    assert((fs.existsSync(realIndexPath)?sha(fs.readFileSync(realIndexPath)):null)===beforeIndex,'Real source index changed');
    const commit=git(['commit-tree',tree,'-p',parent],{input:'Record independently verified private successor publication and retained host limits\n\nProduct source remains '+source+'. Evidence only; qualification, package and remote-byte identities remain separate.\n'}).trim();
    // Exact expected old object refuses an unexpected concurrent evidence update.
    git(['update-ref',ref,commit,parent]);
    assert(git(['rev-parse','HEAD']).trim()===source,'Source HEAD changed unexpectedly');
    assert((fs.existsSync(realIndexPath)?sha(fs.readFileSync(realIndexPath)):null)===beforeIndex,'Real source index changed unexpectedly');
    const receipt={format:'diagramcloud.release-evidence-commit/1',sourceSha:source,parent,sourceTree,ref,commit,tree,files:prepared.length,sha256sumEntries:prepared.length-1,sourceHeadUnchanged:true,sourceIndexUnchanged:true,pushed:false};
    fs.writeFileSync(path.join(here,'release-evidence-final-commit.json'),JSON.stringify(receipt,null,2)+'\n');
    process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
  }finally{if(fs.existsSync(index))fs.unlinkSync(index);}
}
