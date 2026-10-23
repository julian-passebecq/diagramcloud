"""GET-only recovery for an already-uploaded immutable package; no publication calls."""
import argparse,concurrent.futures,hashlib,json,os,runpy,shutil,subprocess,time
from pathlib import Path
from datetime import datetime,timezone

BASE=Path(__file__).resolve().parent
P=runpy.run_path(str(BASE/'publish-private-package.py'))
PACKAGE_ID=73606090
SOURCE='130c70744ec8fdeefebb784c56afb53c182f8dfa'
VERSION='1.33.1-130c707'
sha=lambda b:hashlib.sha256(b).hexdigest()
now=lambda:datetime.now(timezone.utc).isoformat()

def need(ok,message):
    if not ok:raise RuntimeError(message)

def dump(path,value):
    path.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run',action='store_true')
    parser.add_argument('--out',type=Path,default=BASE/'private-publication-readback-recovery-1.33.1-130c707')
    parser.add_argument('--timeout',type=int,default=60)
    parser.add_argument('--workers',type=int,default=4)
    args=parser.parse_args()
    need(1<=args.timeout<=60 and 1<=args.workers<=4,'Recovery is bounded to60seconds and4workers')
    original=BASE/'private-publication-1.33.1-130c707/publication-receipt.json'
    original_bytes=original.read_bytes();original_sha=sha(original_bytes);upload=json.loads(original_bytes)
    need(upload['status']=='FAILED_OR_PARTIAL' and upload['source_sha']==SOURCE and upload['package_version']==VERSION,'Preserved original failure receipt required')
    need(upload['package_id']==PACKAGE_ID and len(upload['uploads'])==14 and upload['writes_attempted']==14,'Expected14 completed original uploads')
    candidate,metadata,audit=P['validate_package'](BASE/'candidate-1.33.1-130c707')
    need({r['file'] for r in upload['uploads']}==set(P['FILES']),'Original upload allowlist mismatch')
    for row in upload['uploads']:
        need(row['response']=='201 Created' and row['bytes']==metadata[row['file']]['bytes'] and row['sha256']==metadata[row['file']]['sha256'],'Original uploaded bytes mismatch')
    out=args.out.resolve()
    need(out.is_relative_to(BASE.resolve()) and not out.exists(),'Choose a new recovery directory inside continuation')
    if not args.run:
        print(json.dumps({'mode':'plan-only','sourceSha':SOURCE,'packageId':PACKAGE_ID,'files':14,'workers':args.workers,'perFileTimeoutSeconds':args.timeout,'remoteWrites':0,'originalReceiptSha256':original_sha},indent=2));return
    project=P['project_check']();P['remote_inventory'](PACKAGE_ID,metadata)
    out.mkdir();downloads=out/'downloads';downloads.mkdir()
    report={'format':'diagramcloud.private-publication-get-recovery/1','sourceSha':SOURCE,'packageId':PACKAGE_ID,'packageVersion':VERSION,
            'capturedAt':now(),'status':'IN_PROGRESS','method':'Existing authenticated glab GET only, binary stdout captured directly to files, fresh exact-byte readback and separate anonymous refusal.',
            'remoteWrites':0,'project':project,'originalPublicationStatus':upload['status'],'originalPublicationReceiptSha256':original_sha,
            'originalPublicationReceiptUnchanged':True,'candidateValidation':audit,'workers':args.workers,'perFileTimeoutSeconds':args.timeout,'readbacks':[],'failures':[]}
    receipt=out/'readback-receipt.json';dump(receipt,report)
    glab=shutil.which('glab');need(glab is not None,'Configured glab executable missing')
    env=os.environ.copy();env.pop('GLAB_DEBUG_HTTP',None);env.pop('GITLAB_DEBUG_HTTP',None);env['NO_COLOR']='1'
    def download(name):
        started=time.monotonic();endpoint=f'projects/87564954/packages/generic/diagramcloud/{VERSION}/{name}'
        file=downloads/name
        with file.open('xb') as stream:
            process=subprocess.Popen([glab,'api','--hostname','gitlab.com','--method','GET',endpoint],cwd=P['WORKSPACE'],env=env,stdout=stream,stderr=subprocess.PIPE)
            try:
                process.communicate(timeout=args.timeout)
            except subprocess.TimeoutExpired:
                process.kill();process.communicate()
                return {'file':name,'status':'TIMEOUT','elapsedSeconds':round(time.monotonic()-started,3),'receivedBytes':file.stat().st_size}
        if process.returncode:
            return {'file':name,'status':'CLI_FAILED','exitCode':process.returncode,'elapsedSeconds':round(time.monotonic()-started,3),'receivedBytes':file.stat().st_size}
        actual={'bytes':file.stat().st_size,'sha256':P['file_hash'](file)}
        if actual!=metadata[name]:return {'file':name,'status':'BYTE_MISMATCH',**actual}
        try:anonymous=P['anonymous_refusal'](endpoint)
        except Exception as error:return {'file':name,'status':'ANONYMOUS_CHECK_FAILED','failureType':type(error).__name__,**actual}
        return {'file':name,'status':'PASS',**actual,'authenticatedMatch':True,'anonymousStatus':anonymous,'elapsedSeconds':round(time.monotonic()-started,3)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures={pool.submit(download,name):name for name in P['FILES']}
        for future in concurrent.futures.as_completed(futures):
            try:row=future.result()
            except Exception as error:row={'file':futures[future],'status':'FAILED','failureType':type(error).__name__}
            report['readbacks' if row['status']=='PASS' else 'failures'].append(row)
            dump(receipt,report);print(json.dumps({'file':row['file'],'status':row['status'],'bytes':row.get('bytes',row.get('receivedBytes')),'verified':len(report['readbacks'])}),flush=True)
    P['project_check']();P['remote_inventory'](PACKAGE_ID,metadata)
    need(sha(original.read_bytes())==original_sha,'Preserved original publisher receipt changed')
    need(all(P['file_hash'](candidate/name)==metadata[name]['sha256'] for name in P['FILES']),'Candidate changed during GET recovery')
    report['status']='PASS' if len(report['readbacks'])==14 and not report['failures'] else 'INCOMPLETE'
    report['completedAt']=now();dump(receipt,report)
    print(json.dumps({'status':report['status'],'verified':len(report['readbacks']),'failures':len(report['failures']),'remoteWrites':0,'originalReceiptUnchanged':True},indent=2))
    return 0 if report['status']=='PASS' else 1

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'status':'REFUSED_OR_FAILED','failureType':type(error).__name__}))
        raise SystemExit(1)
