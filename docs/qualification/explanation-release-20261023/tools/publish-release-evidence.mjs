import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';

// Default: local preparation only. --commit is the sole ref-writing mode.
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const source='130c70744ec8fdeefebb784c56afb53c182f8dfa';
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
  const probe=spawnSync('git',['show-ref','--verify','--quiet',ref],{cwd:root});
  assert(probe.status===1,'Evidence branch already exists or could not be checked');
};
guard();
const configuration=JSON.parse(fs.readFileSync(path.join(here,'release-evidence-files.json'),'utf8'));
assert(configuration.sourceSha===source&&configuration.parent===source&&configuration.ref===ref&&configuration.prefix===prefix,'Evidence manifest identity changed');
const entries=configuration.files,targets=new Set(),inputs=new Set();
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
  if(!fs.existsSync(absolute)){missing.push(row.source);continue;}
  const stat=fs.lstatSync(absolute);assert(stat.isFile()&&!stat.isSymbolicLink(),'Evidence source must be a regular file');
  const bytes=fs.readFileSync(absolute);assert(bytes.length<8*1024*1024,'Evidence file exceeds bounded upload size');
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
fs.writeFileSync(path.join(here,'release-evidence-scan.json'),JSON.stringify(scan,null,2)+'\n');
assert(findings.length===0,'Sensitive evidence findings require review; see sanitized release-evidence-scan.json');
const manifest={format:'diagramcloud.release-evidence-manifest/1',sourceSha:source,parent:source,ref,prefix,
  files:prepared.map(({data,...row})=>row),missing,complete:missing.length===0};
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
const scanBytes=Buffer.from(JSON.stringify(scan,null,2)+'\n');
fs.writeFileSync(path.join(here,'release-evidence-manifest.json'),manifestBytes);
prepared.push({source:'.local/continuation/release-evidence-manifest.json',target:prefix+'EVIDENCE-MANIFEST.json',data:manifestBytes,bytes:manifestBytes.length,sha256:sha(manifestBytes)});
prepared.push({source:'.local/continuation/release-evidence-scan.json',target:prefix+'EVIDENCE-SCAN.json',data:scanBytes,bytes:scanBytes.length,sha256:sha(scanBytes)});
const sums=Buffer.from(prepared.map(row=>row.sha256+'  '+row.target.slice(prefix.length)).sort().join('\n')+'\n');
fs.writeFileSync(path.join(here,'RELEASE-EVIDENCE-SHA256SUMS.txt'),sums);
prepared.push({source:'.local/continuation/RELEASE-EVIDENCE-SHA256SUMS.txt',target:prefix+'SHA256SUMS.txt',data:sums,bytes:sums.length,sha256:sha(sums)});
if(!commitMode){
  process.stdout.write(JSON.stringify({mode:'prepare',sourceSha:source,ref,actualFiles:prepared.length,pending:missing,sensitiveFindings:0,commitCreated:false},null,2)+'\n');
}else{
  assert(missing.length===0,'Evidence files remain pending; no commit created');
  guard();
  const index=path.join(here,'release-evidence-index-'+crypto.randomUUID());
  const env={...process.env,GIT_INDEX_FILE:index};
  const realIndex=git(['rev-parse','--git-path','index']).trim(),realIndexPath=path.resolve(root,realIndex);
  const beforeIndex=fs.existsSync(realIndexPath)?sha(fs.readFileSync(realIndexPath)):null;
  try{
    git(['read-tree',source],{env});
    for(const row of prepared){
      // Use the exact scanned snapshot, and reject concurrent local evidence edits.
      assert(sha(fs.readFileSync(path.join(root,row.source)))===row.sha256,'Evidence changed after scan');
      const oid=git(['hash-object','-w','--stdin'],{input:row.data}).trim();
      git(['update-index','--add','--cacheinfo','100644',oid,row.target],{env});
    }
    const tree=git(['write-tree'],{env}).trim();
    const changed=git(['diff-tree','--no-commit-id','--name-only','-r',sourceTree,tree]).trim().split('\n').filter(Boolean);
    assert(changed.length===prepared.length&&changed.every(name=>name.startsWith(prefix)),'Evidence tree changed outside the allowlist');
    guard();
    assert((fs.existsSync(realIndexPath)?sha(fs.readFileSync(realIndexPath)):null)===beforeIndex,'Real source index changed');
    const commit=git(['commit-tree',tree,'-p',source],{input:'Record exact-source explanation release qualification and open host limits\n\nProduct source remains '+source+'. Evidence only; private package publication is recorded separately.\n'}).trim();
    // An all-zero expected old object atomically requires a previously absent ref.
    git(['update-ref',ref,commit,'0'.repeat(40)]);
    assert(git(['rev-parse','HEAD']).trim()===source,'Source HEAD changed unexpectedly');
    assert((fs.existsSync(realIndexPath)?sha(fs.readFileSync(realIndexPath)):null)===beforeIndex,'Real source index changed unexpectedly');
    const receipt={format:'diagramcloud.release-evidence-commit/1',sourceSha:source,parent:source,sourceTree,ref,commit,tree,files:prepared.length,sha256sumEntries:prepared.length-1,sourceHeadUnchanged:true,sourceIndexUnchanged:true,pushed:false};
    fs.writeFileSync(path.join(here,'release-evidence-commit.json'),JSON.stringify(receipt,null,2)+'\n');
    process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
  }finally{if(fs.existsSync(index))fs.unlinkSync(index);}
}
