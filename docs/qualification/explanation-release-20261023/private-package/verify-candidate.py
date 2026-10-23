#!/usr/bin/env python3
"""Read-only exact-source candidate audit. Writes one local receipt, never extracts archives.
No private input is opened: --private-input-path is used only to derive deny-list strings.
Exit 0 means all implemented checks passed; this is not publication or owner acceptance.
"""
import argparse, hashlib, io, json, os, re, stat, subprocess, sys, tarfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

EXPECTED_SHA = '130c70744ec8fdeefebb784c56afb53c182f8dfa'
EXPECTED_VERSION = '1.33.1'
EXPECTED_TRACKED = 923
ARCHIVES = ('diagramcloud-source-and-build.tar.gz', 'diagramcloud-web-build.tar.gz', 'diagramcloud-cli.tar.gz', 'diagramcloud-synthetic-examples.tar.gz')
ARTIFACTS = set(ARCHIVES) | {'outcome.json','SHIP-REPORT.md','RESUME.md','delivery-receipt.json','SOURCE_COMMIT.txt','PACKAGE-README.md','archive-listing.txt'}
ROOT_FILES = ARTIFACTS | {'READY.json','SHA256SUMS.txt','source-members.txt'}
CHECK_IDS = {'typecheck','unit','build','browser','real-atlas-quality','pptx-zip','pptx-visual','bundled-cli'}
GENERATED = ('public/diagramcloud.schema.json','public/diagramcloud.patch.schema.json','public/diagramcloud.project-brief.schema.json','public/examples','public/experience','public/galaxy','public/third-party-licenses.txt')
GRAMMARS = ('tree-sitter.wasm','tree-sitter-typescript.wasm','tree-sitter-tsx.wasm','tree-sitter-javascript.wasm','tree-sitter-python.wasm','tree-sitter-c-sharp.wasm')
CLI_FILES = {'cli/'+n for n in ('intelligence.mjs','intelligence-mcp.mjs','concept-preview.mjs','concept-host.mjs','LICENSE','THIRD_PARTY_NOTICES.md','dependency-licenses.txt')} | {'cli/grammars/'+n for n in (*GRAMMARS,'identity.json','tree-sitter-LICENSE','vscode-grammars-LICENSE')}
FONT_EXTENSIONS = {'.woff','.woff2','.ttf','.otf','.eot','.ttc','.pfb','.pfa'}
PATTERNS = {
 'private-key-header': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
 'aws-access-key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
 'github-token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b'),
 'api-token': re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b'),
 'stripe-live-key': re.compile(r'\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b'),
 'google-api-key': re.compile(r'\bAIza[0-9A-Za-z_-]{35}\b'),
 'storage-account-key': re.compile(r'\bAccountKey=[A-Za-z0-9+/]{32,}={0,2}', re.I),
 'slack-token': re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{20,}\b'),
 'bearer-token': re.compile(r'\bBearer\s+[A-Za-z0-9_.-]{20,}\b', re.I),
 'credential-assignment': re.compile(r'''["']?\b(?:password|passwd|client_secret|clientSecret|api_key|apiKey|access_token|accessToken|secret_key|secretKey)\b["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']''', re.I),
 'credential-uri': re.compile(r'\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|https?)://[^\s/:@"\x27]+:[^\s/@"\x27]+@', re.I),
 'windows-local-path': re.compile(r'\b[A-Za-z]:[\\/]+(?:Users|PROJ|Projects|home|workspace|worktrees)(?:[\\/]+[^\s"\x27`<>;,\]\[){}]*)?', re.I),
 'unix-user-path': re.compile(r'/(?:home|Users)/[A-Za-z0-9._-]+(?:/[^\s"\x27`<>;,\]\[){}]*)?'),
}
# These are exact public source locations reviewed during this pass, not directory-wide exemptions.
PUBLIC_PATH_EXCEPTIONS = {
 'docs/product/README.md': (45, 'windows-local-path', r'D:\PROJ', 'Public documentation states a generic unavailable Windows workspace root.'),
 'tests/development-atlas.test.ts': (29, 'windows-local-path', r'D:\PROJ\private-client\.claude\worktrees\lane-7', 'Public synthetic redaction fixture; not an actual selected atlas path.'),
}
PUBLIC_UNIX_EXCEPTION = ('tests/development-atlas.test.ts',29,'/home/someone/private-client','Public synthetic redaction fixture.')

REVIEWED_PUBLIC_FIXTURE_LINES = [('tests/acquisition.test.ts', 44, 'private-key-header', '4fb026d9a26271d36eb2c2f9222bca8cc2e36446b41398d8a388cc9bc360d8e3', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/atlas.test.ts', 25, 'credential-uri', '8ee03e69ba9a1be72da94002e3910e9de6fd752e9d78f9eb3f7740e4ba7631b8', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/atlas.test.ts', 94, 'credential-uri', '7dde8d4d4673eebf69d3747166a3262d64ca2cfc72b13f58ed6088e19cecb578', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/capability-guide.test.ts', 28, 'credential-uri', 'e3518bec427831b291fc57a65ce686d740f3a40bda8f5ae1d73aab49e105458c', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/concept-host.test.ts', 41, 'credential-uri', '8b577182ff41983d6538ad057b1092d1fa55d90c68ec71ca080de9661345f96d', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/e2e-target.test.ts', 11, 'credential-uri', 'f8943754c4ce6808e1f6683eaecaa5e55334b296bd441c3af7ba0576a65d4a46', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/fixtures/projects/secrets/credentials/private.pem', 1, 'private-key-header', '3021d90eb9437b2d8f30e8363695c4418b5e5f1870801b5c317e9398ee0f572d', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/fixtures/projects/secrets/private-export.md', 2, 'private-key-header', '3021d90eb9437b2d8f30e8363695c4418b5e5f1870801b5c317e9398ee0f572d', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/fixtures/repo-shop/apps/api/.env.example', 1, 'credential-uri', '06433086a19d5e5e9e6d84de3c1cbc8a76117852f66100671404ed5e1c9c71b8', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/fixtures/repo-shop/docker-compose.yml', 10, 'credential-uri', 'c6012a4a0862ecb2a42b36028a76ec0190dc194e4d63f1dc06f7c95fd5be741a', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/ideation.test.ts', 18, 'credential-uri', '4a121edf99d4e809de38cee94e8efadf16900ceb905960242bc0ce5bc1bd9d97', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/interview-practice.test.ts', 19, 'credential-uri', '820900c6b68333675eee3e060cdf9f8b897dcaecef64b73cc4963ff4715d7514', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/pattern-guidance.test.ts', 24, 'credential-uri', 'a92cd50e4561f588b152059fc8f4395407444dcf69aaf1e50447bc3c49fa0579', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/realization.test.ts', 44, 'github-token', '1eb0ecd3c13d9f502afc74015409d9ef0b9355095898aa20f90f43f95b127283', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/realization.test.ts', 43, 'credential-uri', '04957b25e2505279b37ea73b532cd8740e4afa7d9999321ea4bee3a29ca84907', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/realization.test.ts', 45, 'credential-uri', 'e82150a017de8bbce2fa62cffe0b792518e0faf90e24111bfefac131a3c01352', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/scan.test.ts', 55, 'private-key-header', '831459bafa714453b17e59ff6693821930bc2b338a79a233bf3fa1c790070a63', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/scan.test.ts', 55, 'credential-assignment', '831459bafa714453b17e59ff6693821930bc2b338a79a233bf3fa1c790070a63', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/scan.test.ts', 55, 'credential-uri', '831459bafa714453b17e59ff6693821930bc2b338a79a233bf3fa1c790070a63', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/state-facets.test.ts', 137, 'credential-uri', '5b2e10bd1266e893e2a4d2ada0532f24048a6bea52ef0e6f1fe268449e8c71ff', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.'), ('tests/structured-documents.test.ts', 19, 'credential-assignment', '7f9400971390ead1afa4481054590ec3480241f8ead6ed2b8ca7cf808278ecb7', 'Reviewed public negative-test fixture. Exact source path, line, line hash and matched token are pinned; no real credential or private-key body is accepted.')]

def strict_json(data):
    def pairs(items):
        out={}
        for key,value in items:
            if key in out: raise ValueError('json-duplicate-key')
            out[key]=value
        return out
    return json.loads(data,object_pairs_hook=pairs)

def sha(data): return hashlib.sha256(data).hexdigest()
def normalized_token(value):
    value=value.replace('\\/', '/')
    while '\\\\' in value: value=value.replace('\\\\','\\')
    return value

def git(repo,*args):
    p=subprocess.run(['git','-C',str(repo),*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise ValueError('git-command-failed')
    return p.stdout

def git_tree(repo):
    rows=git(repo,'ls-tree','-rz','--full-tree',EXPECTED_SHA).split(b'\0'); entries={}
    for row in rows:
        if not row: continue
        meta,name=row.split(b'\t',1); mode,kind,oid=meta.split(); name=name.decode('utf-8')
        if mode not in (b'100644',b'100755') or kind!=b'blob': raise ValueError('git-tree-has-nonregular-entry')
        entries[name]=oid.decode()
    ids=list(dict.fromkeys(entries.values()))
    p=subprocess.run(['git','-C',str(repo),'cat-file','--batch'],input=('\n'.join(ids)+'\n').encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise ValueError('git-blob-read-failed')
    buf=p.stdout; cursor=0; objects={}
    for expected in ids:
        end=buf.index(b'\n',cursor); oid,kind,size=buf[cursor:end].split(); size=int(size); cursor=end+1
        if oid.decode()!=expected or kind!=b'blob': raise ValueError('git-blob-response-invalid')
        objects[expected]=buf[cursor:cursor+size]; cursor+=size
        if buf[cursor:cursor+1]!=b'\n': raise ValueError('git-blob-delimiter-invalid')
        cursor+=1
    if cursor!=len(buf): raise ValueError('git-blob-trailing-data')
    return {name:objects[oid] for name,oid in entries.items()}

def member_name(raw):
    if not isinstance(raw,str) or '\\' in raw or any(ord(c)<32 for c in raw): raise ValueError('invalid-member-name')
    while raw.startswith('./'): raw=raw[2:]
    raw=raw.rstrip('/')
    if raw in ('','.'): return ''
    if raw.startswith('/') or ':' in raw or any(p in ('','..','.') for p in raw.split('/')): raise ValueError('unsafe-member-path')
    return raw

def forbidden(name):
    p=PurePosixPath(name); parts=p.parts
    if any(s in {'.git','.local','node_modules'} for s in parts): return True
    if parts and parts[0] in {'release','test-results','playwright-report'}: return True
    if p.suffix.lower() in FONT_EXTENSIONS: return True
    if p.name.startswith('.env') and p.name!='.env.example' and not name.startswith('tests/fixtures/'): return True
    return False

def fs_files(root):
    if root.is_symlink() or (hasattr(root,'is_junction') and root.is_junction()): raise ValueError('filesystem-root-link-refused')
    result={}
    for folder,dirs,files in os.walk(root,followlinks=False):
        for name in dirs+files:
            p=Path(folder)/name
            if p.is_symlink() or (hasattr(p,'is_junction') and p.is_junction()): raise ValueError('filesystem-link-refused')
        for name in files:
            p=Path(folder)/name
            if not stat.S_ISREG(p.stat().st_mode): raise ValueError('filesystem-nonregular-refused')
            result[p.relative_to(root).as_posix()]=p.read_bytes()
    return result

class Audit:
    def __init__(self,repo,package,private_paths):
        self.repo=repo; self.package=package; self.checks=[]; self.findings=[]; self.exceptions=[]; self.markers=[]; self.source={}; self.exception_tokens={}
        for value in private_paths:
            if not value: continue
            # Strings only: deliberately do not stat, resolve or open any private input.
            variants={value,value.replace('\\','/'),value.replace('/','\\')}
            name=value.replace('\\','/').rstrip('/').rsplit('/',1)[-1]
            if name: variants.add(name)
            for v in list(variants):
                variants.add(v.replace('\\','\\\\')); variants.add(v.replace('/','\\/'))
            self.markers.extend(v.casefold() for v in variants if len(v)>=8)
        self.markers=sorted(set(self.markers),key=len,reverse=True)
    def label(self,value):
        value=str(value)
        for marker in self.markers: value=re.sub(re.escape(marker),'[redacted-private-marker]',value,flags=re.I)
        for kind,pattern in PATTERNS.items():
            if kind not in {'windows-local-path','unix-user-path'}: value=pattern.sub('[redacted-'+kind+']',value)
        return value
    def check(self,name,passed,**details):
        self.checks.append({'id':name,'status':'PASS' if passed else 'FAIL',**details})
    def mismatch(self,name,actual,expected):
        missing=sorted(set(expected)-set(actual)); extra=sorted(set(actual)-set(expected)); changed=sorted(k for k in set(actual)&set(expected) if actual[k]!=expected[k])
        self.check(name,not missing and not extra and not changed,filesExpected=len(expected),filesActual=len(actual),missing=[self.label(p) for p in missing],extra=[self.label(p) for p in extra],byteMismatches=[self.label(p) for p in changed])
    def scan(self,label,data):
        # Examine binary payloads as UTF-8 with replacement too, so embedded printable secrets are not skipped.
        text=data.decode('utf-8',errors='replace'); folded=text.casefold()
        private_count=sum(folded.count(marker) for marker in self.markers)
        if private_count: self.findings.append({'path':self.label(label),'category':'selected-private-input-marker','count':private_count})
        for kind,pattern in PATTERNS.items():
            bad=Counter(); allowed=Counter()
            for match in pattern.finditer(text):
                line=text.count('\n',0,match.start())+1; token=normalized_token(match.group(0)); key=(kind,sha(token.encode()))
                candidate_path=label.split('::',1)[-1].removeprefix('git:')
                exception=self.exception_tokens.get((kind,sha(token.encode()),candidate_path,line))
                if exception:
                    allowed[(line,exception['path'],exception['line'],exception['reason'])]+=1
                else: bad[line]+=1
            for line,count in bad.items(): self.findings.append({'path':self.label(label),'line':line,'category':kind,'count':count})
            for (line,source,line_no,reason),count in allowed.items(): self.exceptions.append({'path':self.label(label),'line':line,'category':kind,'count':count,'publicSource':source,'publicSourceLine':line_no,'reason':reason})
    def register_exceptions(self):
        for path,(line,kind,value,reason) in PUBLIC_PATH_EXCEPTIONS.items():
            source_line=self.source[path].decode('utf-8').splitlines()[line-1]
            matches=[normalized_token(m.group(0)) for m in PATTERNS[kind].finditer(source_line)]
            if value not in matches: raise ValueError('public-path-exception-source-changed')
            self.exception_tokens[(kind,sha(value.encode()),path,line)]={'path':path,'line':line,'reason':reason}
        path,line,value,reason=PUBLIC_UNIX_EXCEPTION; source_line=self.source[path].decode('utf-8').splitlines()[line-1]
        if value not in [normalized_token(m.group(0)) for m in PATTERNS['unix-user-path'].finditer(source_line)]: raise ValueError('public-unix-exception-source-changed')
        self.exception_tokens[('unix-user-path',sha(value.encode()),path,line)]={'path':path,'line':line,'reason':reason}
        for path,line,kind,linehash,reason in REVIEWED_PUBLIC_FIXTURE_LINES:
            source_line=self.source[path].decode('utf-8').splitlines()[line-1]
            if sha(source_line.encode())!=linehash: raise ValueError('public-fixture-exception-source-changed')
            matches=list(PATTERNS[kind].finditer(source_line))
            if not matches: raise ValueError('public-fixture-exception-pattern-changed')
            for match in matches:
                token=normalized_token(match.group(0))
                self.exception_tokens[(kind,sha(token.encode()),path,line)]={'path':path,'line':line,'reason':reason}
        # Exact tokens explicitly marked SYNTHETIC in reviewed public test fixtures may recur in generated output.
        # Each exemption is pinned to the exact expected Git source and reports its original public line.
        for path,data in self.source.items():
            if not (path.startswith('tests/') or path.startswith('examples/')): continue
            text=data.decode('utf-8',errors='replace')
            for kind,pattern in PATTERNS.items():
                if kind.endswith('path'): continue
                for m in pattern.finditer(text):
                    token=normalized_token(m.group(0))
                    if re.search(r'\bSYNTHETIC(?:\b|[_-])',token,re.I):
                        line=text.count('\n',0,m.start())+1
                        self.exception_tokens[(kind,sha(token.encode()),path,line)]={'path':path,'line':line,'reason':'Exact public fixture token explicitly marked SYNTHETIC; expected-source Git blob, path and line are pinned.'}
    def tar(self,name):
        files={}; seen=set(); duplicates=[]; unsafe=[]; total=0; members=0
        with tarfile.open(fileobj=io.BytesIO(self.root_bytes[name]),mode='r:gz') as archive:
            for member in archive:
                members+=1; total+=member.size
                if members>20000 or total>2*1024**3 or member.size>128*1024**2: raise ValueError('archive-resource-limit')
                try: path=member_name(member.name)
                except ValueError: unsafe.append({'memberOrdinal':members,'reason':'unsafe-name'}); continue
                if not path and member.isdir(): continue
                self.scan(name+'::'+path+' [tar-metadata]',json.dumps({'name':member.name,'linkname':member.linkname,'uname':member.uname,'gname':member.gname,'pax':member.pax_headers}).encode())
                if not path or forbidden(path): unsafe.append({'path':self.label(path),'reason':'forbidden-member'}); continue
                if path in seen: duplicates.append(self.label(path))
                seen.add(path)
                if not (member.isdir() or member.isfile()): unsafe.append({'path':self.label(path),'reason':'link-or-special-member'}); continue
                if member.isfile():
                    stream=archive.extractfile(member)
                    if stream is None: raise ValueError('archive-file-unreadable')
                    data=stream.read()
                    if len(data)!=member.size: raise ValueError('archive-short-read')
                    files[path]=data; self.scan(name+'::'+path,data)
        self.check('archive-safety:'+name,not unsafe and not duplicates,members=members,regularFiles=len(files),uncompressedBytes=total,unsafe=unsafe,duplicateMembers=duplicates)
        return files
    def run(self):
        self.check('selected-private-input-markers',bool(self.markers),markerVariants=len(self.markers),privateInputContentsRead=False)
        self.check('exact-repository-head',git(self.repo,'rev-parse','HEAD').decode().strip()==EXPECTED_SHA)
        self.check('clean-repository',not git(self.repo,'status','--porcelain','--untracked-files=all').strip())
        self.source=git_tree(self.repo); self.check('tracked-file-count',len(self.source)==EXPECTED_TRACKED,actual=len(self.source),expected=EXPECTED_TRACKED)
        self.register_exceptions()
        root_entries=list(self.package.iterdir()); roots={p.name for p in root_entries if p.is_file()}; dirs={p.name for p in root_entries if p.is_dir()}
        links=[p.name for p in root_entries if p.is_symlink() or (hasattr(p,'is_junction') and p.is_junction())]
        self.check('root-file-allowlist',roots==ROOT_FILES and dirs=={'cli'} and len(root_entries)==15 and not links,expectedFiles=14,actualFiles=len(roots),missing=sorted(ROOT_FILES-roots),extra=[self.label(p) for p in sorted(roots-ROOT_FILES)],extraDirectories=[self.label(p) for p in sorted(dirs-{'cli'})],links=[self.label(p) for p in links])
        if links: raise ValueError('package-root-link-refused')
        if not ROOT_FILES.issubset(roots): raise ValueError('required-package-file-missing')
        root_bytes={name:(self.package/name).read_bytes() for name in roots}; self.root_bytes=root_bytes
        for name,data in root_bytes.items():
            if name not in ARCHIVES: self.scan(name,data)
        checksum_rows=root_bytes['SHA256SUMS.txt'].decode('utf-8-sig').splitlines(); sums={}; malformed=0
        for row in checksum_rows:
            m=re.fullmatch(r'([a-f0-9]{64})  ([^\r\n]+)',row)
            if not m or m.group(2) in sums: malformed+=1; continue
            sums[m.group(2)]=m.group(1)
        bad=[self.label(n) for n,h in sums.items() if n not in root_bytes or sha(root_bytes[n])!=h]
        self.check('twelve-sha256-entries',len(checksum_rows)==12 and set(sums)==ARTIFACTS|{'READY.json'} and not malformed and not bad,count=len(checksum_rows),malformedOrDuplicate=malformed,mismatches=bad)
        ready=strict_json(root_bytes['READY.json']); receipt=strict_json(root_bytes['delivery-receipt.json']); artifacts=ready.get('artifacts',[])
        self.check('ready-source-version',ready.get('schema')=='galaxy.component-ready/1' and ready.get('componentId')=='diagramcloud' and ready.get('componentVersion')==EXPECTED_VERSION and ready.get('sourceSha')==EXPECTED_SHA and 'synthetic' not in ready)
        self.check('source-commit-file',root_bytes['SOURCE_COMMIT.txt'].decode('ascii').strip()==EXPECTED_SHA)
        artifact_names=[r.get('relativePath') for r in artifacts]
        artifact_bad=[self.label(str(r.get('relativePath'))) for r in artifacts if r.get('relativePath') not in root_bytes or r.get('sha256')!=sha(root_bytes.get(r.get('relativePath'),b'')) or r.get('bytes')!=len(root_bytes.get(r.get('relativePath'),b''))]
        self.check('ready-eleven-artifacts',len(artifacts)==11 and set(artifact_names)==ARTIFACTS and len(set(artifact_names))==11 and not artifact_bad,artifacts=len(artifacts),mismatches=artifact_bad)
        ci=receipt.get('ci',{}); checks=receipt.get('checks',[])
        present={c.get('id') for c in checks if c.get('status')=='PASS' and isinstance(c.get('evidenceRefs'),list) and bool(c['evidenceRefs'])}
        self.check('delivery-receipt-binding',receipt.get('sourceSha')==EXPECTED_SHA and ci.get('sourceSha')==EXPECTED_SHA and ci.get('conclusion')=='success' and bool(re.fullmatch(r'https://github\.com/julian-passebecq/diagramcloud/actions/runs/\d+',str(ci.get('url','')))) and 'synthetic' not in receipt and CHECK_IDS<=present and ready.get('checks')==checks,missingCheckIds=sorted(CHECK_IDS-present),ciConclusionIsDeclarationOnly=True)
        source=self.tar(ARCHIVES[0]); web=self.tar(ARCHIVES[1]); cli=self.tar(ARCHIVES[2]); fixtures=self.tar(ARCHIVES[3])
        source_tracked={name:source[name] for name in self.source if name in source}
        self.mismatch('all-923-raw-git-blobs',source_tracked,self.source)
        working={name:(self.repo/name).read_bytes() for name in self.source}
        working_mismatches=[p for p in self.source if working[p]!=self.source[p]]
        self.check('working-tree-raw-git-blobs',not working_mismatches,byteMismatches=[self.label(p) for p in working_mismatches],normalizationApplied=False)
        dist=fs_files(self.repo/'dist'); self.mismatch('web-equals-fresh-local-dist',web,dist)
        expected_source=dict(self.source)
        for generated in GENERATED:
            p=self.repo/generated
            if p.is_file(): expected_source[generated]=p.read_bytes()
            elif p.is_dir(): expected_source.update({generated+'/'+n:data for n,data in fs_files(p).items()})
        expected_source.update({'dist/'+n:data for n,data in dist.items()})
        self.mismatch('source-archive-allowlist-and-fresh-generated-bytes',source,expected_source)
        manifest_expected=list(self.source)+[p for p in GENERATED if (self.repo/p).exists()]+['dist']
        manifest_actual=root_bytes['source-members.txt'].decode('utf-8-sig').splitlines()
        self.check('source-members-manifest',len(manifest_actual)==len(manifest_expected) and set(manifest_actual)==set(manifest_expected),rows=len(manifest_actual))
        for name,data in [('local-dist',dist.get('galaxy/version-handshake.json')),('web-archive',web.get('galaxy/version-handshake.json')),('source-dist',source.get('dist/galaxy/version-handshake.json')),('source-public',source.get('public/galaxy/version-handshake.json'))]:
            handshake=strict_json(data or b'null')
            self.check('handshake:'+name,isinstance(handshake,dict) and all(handshake.get(k)==v for k,v in {'schema_version':1,'app_id':'diagramcloud','product_version':EXPECTED_VERSION,'source_revision':EXPECTED_SHA,'galaxy_level':'G0','standalone':True}.items()))
        self.check('source-package-version',strict_json(source['package.json']).get('version')==EXPECTED_VERSION)
        expected_fixtures={p:data for p,data in self.source.items() if p.startswith(('examples/product-campaign/','tests/fixtures/projects/','tests/fixtures/deep/'))}
        self.mismatch('synthetic-archive-exact-source-members',fixtures,expected_fixtures)
        self.check('cli-members-allowlist',set(cli)==CLI_FILES,missing=sorted(CLI_FILES-set(cli)),extra=[self.label(p) for p in sorted(set(cli)-CLI_FILES)])
        loose_cli={'cli/'+n:data for n,data in fs_files(self.package/'cli').items()}; self.mismatch('cli-archive-equals-staged-cli',cli,loose_cli)
        grammar_identity=strict_json(cli['cli/grammars/identity.json']); rows=grammar_identity.get('grammars',[]); grammar_checks=[]
        for name in GRAMMARS:
            package='web-tree-sitter' if name=='tree-sitter.wasm' else '@vscode/tree-sitter-wasm'
            version='0.25.10' if name=='tree-sitter.wasm' else '0.3.1'
            local=self.repo/'node_modules'/package/('tree-sitter.wasm' if name=='tree-sitter.wasm' else 'wasm/'+name)
            data=cli.get('cli/grammars/'+name,b''); selected=[r for r in rows if r.get('name')==name]
            ok=len(selected)==1 and data==local.read_bytes() and selected[0].get('sha256')==sha(data) and selected[0].get('bytes')==len(data) and selected[0].get('package')==package+'@'+version and strict_json((self.repo/'node_modules'/package/'package.json').read_bytes()).get('version')==version
            grammar_checks.append({'name':name,'pass':ok,'sha256':sha(data)})
        self.check('cli-six-pinned-grammar-bytes',grammar_identity.get('format')=='diagramcloud.grammar-identity/1' and grammar_identity.get('license')=='MIT' and len(rows)==6 and all(r['pass'] for r in grammar_checks),grammars=grammar_checks)
        rights={'cli/LICENSE':self.source['LICENSE'],'cli/THIRD_PARTY_NOTICES.md':self.source['THIRD_PARTY_NOTICES.md'],'cli/dependency-licenses.txt':(self.repo/'public/third-party-licenses.txt').read_bytes(),'cli/grammars/tree-sitter-LICENSE':(self.repo/'node_modules/web-tree-sitter/LICENSE').read_bytes(),'cli/grammars/vscode-grammars-LICENSE':(self.repo/'node_modules/@vscode/tree-sitter-wasm/LICENSE').read_bytes()}
        rights_bad=[p for p,data in rights.items() if cli.get(p)!=data]
        self.check('cli-rights-byte-identity',not rights_bad,mismatches=rights_bad,legalRightsExpanded=False)
        self.check('root-source-reports',root_bytes['RESUME.md']==self.source['RESUME.md'] and root_bytes['outcome.json']==self.source['outcome.json'])
        self.check('package-root-unchanged-during-audit',all((self.package/name).read_bytes()==data for name,data in root_bytes.items()))
        self.check('confidentiality-pattern-scan',not self.findings,unexplainedFindings=len(self.findings),exactPublicExceptions=len(self.exceptions),limitations='Pattern checks and exact source/member identities are not a guarantee that arbitrary unknown secrets can be recognized.')
    def report(self):
        return {'format':'diagramcloud.independent-candidate-audit/1','capturedAt':datetime.now(timezone.utc).isoformat(),'sourceCommit':EXPECTED_SHA,'productVersion':EXPECTED_VERSION,'result':'PASS' if self.checks and all(c['status']=='PASS' for c in self.checks) and not self.findings else 'FAIL','checks':self.checks,'unexplainedFindings':self.findings,'publicExceptions':self.exceptions,'privateInputContentsRead':False,'archivesExtracted':False,'packageFilesModified':False,'notClaimed':['Live CI result re-verification','Private publication or remote-byte readback','Human owner acceptance','Installed host update/rollback','GA']}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package',required=True); parser.add_argument('--repo',required=True)
    parser.add_argument('--private-input-path',action='append',default=[]); parser.add_argument('--out')
    args=parser.parse_args(); repo=Path(args.repo).resolve(); package=Path(args.package).resolve()
    # The only output is a new file under this repository's ignored continuation evidence directory.
    local=(repo/'.local/continuation').resolve(); out=Path(args.out).resolve() if args.out else local/('candidate-audit-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json')
    if not out.is_relative_to(local) or out.is_relative_to(package) or out.exists(): parser.error('Choose a new receipt file under repo/.local/continuation outside the package')
    paths=args.private_input_path or [v for v in os.environ.get('DIAGRAMCLOUD_QUALITY_DOCS','').split(',') if v]
    audit=Audit(repo,package,paths)
    try: audit.run()
    except Exception as error:
        # No arbitrary exception text: it can contain private filenames, payloads, or credential values.
        safe_reason=str(error) if isinstance(error,ValueError) and re.fullmatch('[a-z0-9-]+',str(error)) else type(error).__name__
        audit.check('audit-completed',False,error=safe_reason)
    receipt=audit.report(); local.mkdir(parents=True,exist_ok=True)
    with out.open('x',encoding='utf-8',newline='\n') as f: json.dump(receipt,f,indent=2); f.write('\n')
    print(json.dumps({'result':receipt['result'],'checks':len(receipt['checks']),'failedCheckIds':[c['id'] for c in receipt['checks'] if c['status']=='FAIL'],'unexplainedFindings':len(audit.findings),'receipt':out.relative_to(repo).as_posix(),'receiptSha256':sha(out.read_bytes())}))
    return 0 if receipt['result']=='PASS' else 1

if __name__=='__main__': sys.exit(main())


