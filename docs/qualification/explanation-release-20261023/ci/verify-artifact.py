"""Read-only verification of a downloaded DiagramCloud CI artifact against exact Git blobs."""
import argparse,base64,collections,hashlib,io,json,pathlib,re,subprocess,tarfile,zipfile
p=argparse.ArgumentParser();p.add_argument('--source',default='130c70744ec8fdeefebb784c56afb53c182f8dfa');p.add_argument('--base',default='2ea334fa80f44b42f1b1e670e4193b09f7df0b27');p.add_argument('--expected-digest',default='97419f422106c6bd45997ac6256d8ae0f217845b0dfb58d93b307ca6c33485bb');p.add_argument('--run-id',default='39985734370');p.add_argument('--repo',type=pathlib.Path,default=pathlib.Path.cwd());p.add_argument('--artifact',type=pathlib.Path);p.add_argument('--output-dir',type=pathlib.Path);a=p.parse_args()
root=(a.output_dir or pathlib.Path(__file__).resolve().parent).resolve();root.mkdir(parents=True,exist_ok=True);repo=a.repo.resolve();artifact=(a.artifact or root/'artifact.zip').resolve();problems=[];notes=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
def check(ok,message):
 if not ok:problems.append(message)
 return bool(ok)
def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
def hashes(z,name,prefix=''):
 rows=[]
 for line in z.read(name).decode().splitlines():
  expected,path=re.split(r'\s+',line,1);path=path.lstrip('*');target=prefix+path;raw=z.read(target);actual=sha(raw);rows.append({'path':target,'bytes':len(raw),'expected':expected,'actual':actual,'match':check(actual==expected,'Checksum mismatch: '+target)})
 return rows
def tarfiles(raw):
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as t:
  members=t.getmembers();files={};duplicates=[]
  for m in members:
   path=m.name.removeprefix('./')
   if m.isfile():data=t.extractfile(m).read()
   elif m.issym():data=m.linkname.encode()
   else:continue
   if path in files:duplicates.append(path)
   files[path]=data
  return files,{'members':len(members),'files':len(files),'duplicatePaths':duplicates,'otherTypes':[m.name for m in members if not(m.isfile() or m.isdir() or m.issym())]}
tree=[]
for entry in git('ls-tree','-rz',a.source).split(b'\0'):
 if not entry:continue
 meta,path=entry.split(b'\t',1);mode,kind,oid=meta.decode().split();tree.append({'path':path.decode(),'mode':mode,'kind':kind,'oid':oid})
objects=[x for x in tree if x['kind']=='blob'];raw=subprocess.check_output(['git','cat-file','--batch'],input=('\n'.join(x['oid'] for x in objects)+'\n').encode(),cwd=repo);pos=0;blobs={}
for entry in objects:
 end=raw.index(b'\n',pos);header=raw[pos:end].decode().split();size=int(header[2]);data=raw[end+1:end+1+size];pos=end+2+size;check(header[0]==entry['oid'],'Git cat-file header mismatch');blobs[entry['path']]=data
changed=[x.decode() for x in git('diff','--name-only','-z',a.base,a.source).split(b'\0') if x]
def compare(files,required=True):
 rows=[];missing=[];mismatch=[]
 for path,data in blobs.items():
  if path not in files:missing.append(path);continue
  actual=files[path];match=data==actual
  rows.append({'path':path,'gitBlob':next(x['oid'] for x in objects if x['path']==path),'bytes':len(data),'sha256':sha(data),'archiveSha256':sha(actual),'match':match})
  if not match:mismatch.append(path)
 if required:check(not missing,'Tracked files absent from CI source tar: '+', '.join(missing));check(not mismatch,'Git bytes differ in CI source tar: '+', '.join(mismatch))
 changedrows=[row for row in rows if row['path'] in changed];changedmissing=[path for path in changed if path in blobs and path not in files];deleted=[path for path in changed if path not in blobs]
 return {'trackedCount':len(blobs),'matchedCount':sum(r['match'] for r in rows),'missing':missing,'mismatched':mismatch,'changedCount':len(changed),'changedMatchedCount':sum(r['match'] for r in changedrows),'changedMissing':changedmissing,'deletedInSource':deleted,'changedFiles':changedrows,'files':rows}
result={'auditFormat':'diagramcloud.ci-artifact-readback/1','runId':a.run_id,'sourceCommit':a.source,'baseCommit':a.base,'artifact':{'path':str(artifact),'bytes':artifact.stat().st_size,'sha256':sha(artifact.read_bytes()),'expectedSha256':a.expected_digest}}
check(result['artifact']['sha256']==a.expected_digest,'Outer artifact digest mismatch')
metadata=json.loads((root/'artifact-metadata.json').read_text(encoding='utf-8-sig'));am=next(x for x in metadata['artifacts'] if x['name']=='diagramcloud-ci');result['githubArtifactMetadata']={k:am[k] for k in ['id','name','digest','size_in_bytes','workflow_run','expired']}
check(am['digest']=='sha256:'+a.expected_digest,'GitHub digest metadata mismatch');check(am['size_in_bytes']==result['artifact']['bytes'],'GitHub size metadata mismatch');check(am['workflow_run']['head_sha']==a.source,'GitHub artifact head mismatch');check(str(am['workflow_run']['id'])==a.run_id,'GitHub artifact run mismatch')
workflow=json.loads((root/'workflow-run.json').read_text(encoding='utf-8-sig'));result['workflowRun']={k:workflow.get(k) for k in ['id','event','status','conclusion','head_sha','head_branch','run_attempt','html_url']}
check(str(workflow['id'])==a.run_id and workflow['head_sha']==a.source and workflow['event']=='push' and workflow['head_branch']=='main' and workflow['status']=='completed' and workflow['conclusion']=='success','Main push workflow identity or result mismatch')
check(am['expired'] is False,'GitHub artifact expired')
with zipfile.ZipFile(artifact) as z:
 names=z.namelist();bad=z.testzip();duplicates=[n for n,c in collections.Counter(names).items() if c>1];result['zip']={'entries':len(names),'crcFailure':bad,'duplicateNames':duplicates};check(bad is None,'ZIP CRC failure');check(not duplicates,'ZIP duplicate names')
 sources={name:z.read(name).decode().strip() for name in names if name.endswith('/SOURCE_COMMIT.txt')};result['sourceCommitFiles']=sources
 for name,value in sources.items():check(value==a.source,'Source identity mismatch: '+name)
 result['sourceTarChecksum']=hashes(z,'release/SHA256SUMS.txt')
 result['dryRunChecksums']=hashes(z,'release/package-dry-run/SHA256SUMS.txt','release/package-dry-run/');check(len(result['dryRunChecksums'])==12,'Expected 12 dry-run hashes')
 verification=json.loads(z.read('release/verification-receipt.json'));result['verificationReceipt']=verification;check(verification['revision']['commit']==a.source,'Verification source mismatch');check(verification['status']=='passed','Verification receipt not passed');check(all(c['status']=='passed' for c in verification['checks']),'Verification check not passed')
 clients=json.loads(z.read('release/bundled-client-qualification/receipt.json'));result['bundledClientReceipt']=clients;check(clients['sourceSha']==a.source,'Bundled clients source mismatch');check(len(clients['results'])==21 and all(x['status']=='PASS' for x in clients['results']),'Bundled client case mismatch')
 grammar=[]
 for g in clients['grammars']:
  b=z.read('release/package-dry-run/cli/grammars/'+g['name']);grammar.append({'name':g['name'],'sha256':sha(b),'bytes':len(b),'match':check(sha(b)==g['sha256'] and len(b)==g['bytes'],'Grammar byte mismatch: '+g['name'])})
 result['bundledGrammarByteChecks']=grammar
 dry=json.loads(z.read('release/package-dry-run/DRY-RUN.json'));delivery=json.loads(z.read('release/package-dry-run/delivery-receipt.json'));result['dryRun']={'receipt':dry,'delivery':delivery,'readyPresent':'release/package-dry-run/READY.json' in names,'notice':'READY.json in the separate concept-preview client fixture is preparation only, not a package READY marker.'}
 check(dry['sourceSha']==a.source and dry['synthetic'] is True,'Dry-run source/synthetic mismatch');check(not result['dryRun']['readyPresent'],'Package READY exists');check(delivery['ci']['conclusion']=='not-run' and delivery['checks']==[],'Dry-run claims executed checks')
 for entry in dry['artifacts']:
  b=z.read('release/package-dry-run/'+entry['relativePath']);check(sha(b)==entry['sha256'] and len(b)==entry['bytes'],'DRY-RUN artifact differs: '+entry['relativePath'])
 primary,info=tarfiles(z.read('release/diagramcloud-source-and-build.tar.gz'));result['primarySourceTar']={'inventory':info,'comparison':compare(primary)};check(not info['duplicatePaths'],'Duplicate paths in source tar')
 packaged,pinfo=tarfiles(z.read('release/package-dry-run/diagramcloud-source-and-build.tar.gz'));result['dryRunSourceTar']={'inventory':pinfo,'comparison':compare(packaged)}
 # Compare all source files the allowlisted dry-run actually contains. Omitted tracked files are enumerated, not silently called equal.
 check(not result['dryRunSourceTar']['comparison']['mismatched'],'Dry-run packaged source bytes mismatch')
 handshake=json.loads(primary['dist/galaxy/version-handshake.json']);result['builtHandshake']=handshake;check(handshake['source_revision']==a.source and handshake['app_id']=='diagramcloud' and handshake['product_version']=='1.33.1' and handshake['standalone'] is True and handshake['galaxy_level']=='G0','Built handshake identity mismatch')
 check(primary['dist/galaxy/version-handshake.json']==packaged['dist/galaxy/version-handshake.json'],'Dry-run handshake differs from CI build')
 dist={path[5:]:data for path,data in primary.items() if path.startswith('dist/') and not path.endswith('.map')};manifest=sha(('\n'.join(sorted(path+' '+sha(data) for path,data in dist.items()))+'\n').encode());ref=next(x for x in verification['evidence_refs'] if x['evidence_id'].startswith('diagramcloud:dist-manifest:'));result['distManifest']={'files':len(dist),'sha256':manifest,'receiptSha256':ref['integrity'].removeprefix('sha256:'),'match':check(ref['integrity']=='sha256:'+manifest and ref['locator']['files']==len(dist),'Dist manifest mismatch')}
 check(all(packaged.get('dist/'+path)==data for path,data in dist.items()),'Dry-run source/build dist differs')
 html=z.read('playwright-report/index.html').decode();encoded=re.search(r'<template id="playwrightReportBase64">(.*?)</template>',html,re.S).group(1).split('base64,')[-1].strip();pbytes=base64.b64decode(encoded)
 with zipfile.ZipFile(io.BytesIO(pbytes)) as pw:
  pwbad=pw.testzip();check(pwbad is None,'Embedded Playwright ZIP CRC failure');report=json.loads(pw.read('report.json'));tests=[t for f in report['files'] for t in f['tests']];detailed=[t for f in report['files'] for t in json.loads(pw.read(f['fileId']+'.json'))['tests']];runs=[r for t in detailed for r in t['results']]
  md=report['metadata'];gitmd=md['gitCommit'];ci=md['ci'];check(gitmd['hash']==a.source,'Playwright checked-out Git commit mismatch');check(ci['buildHref'].endswith('/'+a.run_id),'Playwright CI run mismatch');check(report['stats']['flaky']==0 and report['stats']['unexpected']==0 and report['errors']==[],'Playwright unexpected/flaky/global errors');check(all(r.get('retry',0)==0 for r in runs),'Playwright retries found')
  outcomes=dict(collections.Counter(t['outcome'] for t in tests));statuses=dict(collections.Counter(r.get('status') for r in runs));result['playwright']={'embeddedZipSha256':sha(pbytes),'embeddedZipCrcFailure':pwbad,'fileCount':len(report['files']),'stats':report['stats'],'independentOutcomeCounts':outcomes,'detailStatusCounts':statuses,'testCount':len(tests),'resultCount':len(runs),'maxRetry':max(r.get('retry',0) for r in runs),'resultsPerTest':dict(collections.Counter(len(t['results']) for t in detailed)),'errors':report['errors'],'actualWorkers':md.get('actualWorkers'),'gitCommit':gitmd,'ciMetadata':ci,'gitDiffPresent':'gitDiff' in md,'gitDiffSha256':sha(md['gitDiff'].encode()) if isinstance(md.get('gitDiff'),str) else None,'skips':[{'file':t['location']['file'],'title':t['title'],'annotations':t['annotations']} for t in tests if t['outcome']=='skipped'],'explanationCases':[{'title':t['title'],'path':t['path'],'outcome':t['outcome']} for t in tests if t['location']['file']=='explanation-request.spec.ts']}
  check(outcomes=={'expected':362,'skipped':5} and len(tests)==367,'Browser outcome count mismatch');check(len(result['playwright']['explanationCases'])==12 and all(x['outcome']=='expected' for x in result['playwright']['explanationCases']),'Explanation case count/outcome mismatch')
  check(ci.get('commitHash')==gitmd['hash']==a.source,'Main push Playwright CI and checked-out commit identities differ')
  notes.append('Main push metadata: Playwright ci.commitHash='+str(ci.get('commitHash'))+'; gitCommit.hash='+gitmd['hash']+'; expected source='+a.source+'. Both identities are checked directly.')
log=(root/'job.log').read_text(encoding='utf-8-sig');unit={key:int(re.search(r'Z # '+key+r' (\d+)',log).group(1)) for key in ['tests','pass','fail','skipped']};unit_skips=[line for line in log.splitlines() if re.search(r'Z ok \d+ .* # SKIP',line)];result['jobLog']={'sha256':sha((root/'job.log').read_bytes()),'unit':unit,'unitSkipLines':unit_skips,'sourceCheckoutLines':[line for line in log.splitlines() if 'git checkout --progress --force '+a.source in line],'browserInstallAfterUnit':log.index('Run npx playwright install --with-deps chromium')>log.index('# tests '+str(unit['tests'])),'browserSummaryLines':[line for line in log.splitlines() if re.search(r'Z\s+(?:\d+ passed|\d+ skipped|Running \d+ tests)',line)]}
check(unit=={'tests':2033,'pass':2030,'fail':0,'skipped':3},'Unit totals differ');check(len(unit_skips)==3,'Unit skip list differs');check(bool(result['jobLog']['sourceCheckoutLines']),'Job log lacks exact source checkout')
uploaded_digest=re.search(r'SHA256 digest of uploaded artifact zip is ([a-f0-9]{64})',log);check(uploaded_digest is not None and uploaded_digest.group(1)==a.expected_digest,'Uploaded-job artifact digest mismatch');result['jobLog']['uploadedArtifactSha256']=uploaded_digest.group(1) if uploaded_digest else None
notes.append('CI unit totals read from this job: '+json.dumps(unit,sort_keys=True)+'. Skip lines are recorded verbatim in the JSON audit. Browser install follows units: '+str(result['jobLog']['browserInstallAfterUnit'])+'. Do not substitute local unit execution counts.')
notes.append('The synthetic packaging dry run is not a release candidate. Bundled CLI/MCP qualification is synthetic and not external-owner or installed-host acceptance. Audit verifies downloaded artifact bytes; no deployment, release or human acceptance is asserted.')
result['notes']=notes;result['problems']=problems;result['passed']=not problems
(root/'artifact-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
summary={'passed':result['passed'],'problems':problems,'artifact':result['artifact'],'zip':result['zip'],'sourceTar':{k:v for k,v in result['primarySourceTar']['comparison'].items() if k not in ['files','changedFiles']},'dryRunSourceTar':{k:v for k,v in result['dryRunSourceTar']['comparison'].items() if k not in ['files','changedFiles']},'dryRunHashMatches':sum(x['match'] for x in result['dryRunChecksums']),'distManifest':result['distManifest'],'browser':{k:result['playwright'][k] for k in ['stats','independentOutcomeCounts','detailStatusCounts','fileCount','testCount','resultCount','maxRetry','resultsPerTest','actualWorkers']},'unit':unit,'notes':notes}
(root/'browser-summary.json').write_text(json.dumps({'sourceCommit':a.source,'runId':a.run_id,**result['playwright']},indent=2),encoding='utf-8')
for filename,value in [('verification-receipt.json',verification),('bundled-client-receipt.json',clients),('built-handshake.json',handshake)]:
 (root/filename).write_text(json.dumps(value,indent=2),encoding='utf-8')
browser=result['playwright'];primary_compare=result['primarySourceTar']['comparison'];dry_compare=result['dryRunSourceTar']['comparison']
skip_details='\n'.join('- '+line.split('Z ',1)[-1] for line in unit_skips)
text=f"""# Independent main CI artifact verification

Result: {'PASS' if not problems else 'FAIL'}. Read-only audit of main push run {a.run_id}, source {a.source}, base {a.base}. No tests, builds, tracked source edits, deployment or publication performed by this audit.

- Workflow API: event={workflow['event']}, branch={workflow['head_branch']}, status={workflow['status']}, conclusion={workflow['conclusion']}, head={workflow['head_sha']}.
- GitHub artifact {am['id']}: {artifact.stat().st_size:,} bytes; SHA-256 {result['artifact']['sha256']}. Compared with API digest {am['digest']} and job upload digest {result['jobLog']['uploadedArtifactSha256']}.
- Outer ZIP: {len(names)} entries; CRC failure={bad}; duplicate names={duplicates}.
- Source tar checksum: {result['sourceTarChecksum'][0]['actual']}; matches={all(row['match'] for row in result['sourceTarChecksum'])}.
- Primary source tar: {primary_compare['matchedCount']}/{primary_compare['trackedCount']} Git blobs match, including {primary_compare['changedMatchedCount']}/{primary_compare['changedCount']} changed files. Missing={primary_compare['missing']}; mismatched={primary_compare['mismatched']}.
- Dry-run source tar: {dry_compare['matchedCount']}/{dry_compare['trackedCount']} Git blobs match, including {dry_compare['changedMatchedCount']}/{dry_compare['changedCount']} changed files. Missing={dry_compare['missing']}; mismatched={dry_compare['mismatched']}. Git blobs came from git cat-file --batch with no checkout or line-ending conversion.
- Dry-run checksum entries: {sum(row['match'] for row in result['dryRunChecksums'])}/{len(result['dryRunChecksums'])} match. DRY-RUN synthetic={dry['synthetic']}; package READY present={result['dryRun']['readyPresent']}. A client concept-preview READY marker is preparation only.
- Built identity: DiagramCloud {handshake['product_version']}/{handshake['galaxy_level']}, standalone={handshake['standalone']}, source={handshake['source_revision']}. SOURCE_COMMIT files and both receipts are checked against the source.
- Dist manifest: {len(dist)} files; SHA-256 {manifest}; receipt match={result['distManifest']['match']}. Packaged dist bytes are compared with the CI build.
- Verification receipt: level={verification['verification_level']}, status={verification['status']}; {len(verification['checks'])} check records inspected. No manual or Galaxy qualification is inferred.
- Bundled CLI/MCP: {sum(row['status']=='PASS' for row in clients['results'])}/{len(clients['results'])} cases PASS, with synthetic inputs; {sum(row['match'] for row in grammar)}/{len(grammar)} grammar hashes and sizes match.
- Browser report decoded from its HTML-embedded ZIP: {browser['testCount']} cases across {browser['fileCount']} files; outcomes={browser['independentOutcomeCounts']}; detailed result statuses={browser['detailStatusCounts']}; unexpected={browser['stats']['unexpected']}, flaky={browser['stats']['flaky']}, results={browser['resultCount']}, max retry={browser['maxRetry']}, actual workers={browser['actualWorkers']}. Embedded ZIP CRC failure={browser['embeddedZipCrcFailure']}. Explanation cases: {sum(row['outcome']=='expected' for row in browser['explanationCases'])}/{len(browser['explanationCases'])} passed. Every skipped title is retained in browser-summary.json.
- CI unit log: tests={unit['tests']}, passed={unit['pass']}, failed={unit['fail']}, skipped={unit['skipped']}. Chromium install follows the unit stage: {result['jobLog']['browserInstallAfterUnit']}. The PDF skip therefore remains distinct from local runs where Chromium was installed already.
- Main push Playwright metadata: ci.commitHash={ci.get('commitHash')}; gitCommit.hash={gitmd['hash']}. Both are required to equal the exact main source; no PR event/merge exception applies.

Actual unit skips from this job:

{skip_details}

Problems: {problems or 'none found in these bounded artifact checks'}.

The JSON audit contains per-file blob comparisons, checksums, receipts and browser metadata. The reusable verifier expects artifact.zip, artifact-metadata.json, workflow-run.json and job.log beside it by default. Run from the repository or pass --repo/--artifact/--output-dir. Keep the raw ZIP and embedded HTML local. The synthetic dry-run is not a release candidate or deployment, and no human acceptance is asserted.
"""
(root/'ARTIFACT-VERIFICATION.md').write_text(text,encoding='utf-8')
print(json.dumps(summary,indent=2));raise SystemExit(1 if problems else 0)
