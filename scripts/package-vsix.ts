/**
 * Standalone VSIX source package for the DiagramCloud viewer (hosts/vscode). Type-checks the host, bundles the
 * extension (Node, CommonJS) and the webview (browser IIFE) with esbuild from the current source, collects the
 * licenses of the bundled packages, and writes an Open Packaging (.vsix) ZIP into a new directory:
 *
 *   npx tsx scripts/package-vsix.ts [--out <new directory>]     (default .local/vsix/<source commit>)
 *
 * It never installs, publishes or signs anything, never packages fonts, source maps, .local or node_modules, and is a
 * source-package proof only: installing it in VS Code is the separate host proof
 * `npm run test:host:vscode` (tests/host/vscode-host.test.ts, local only); Cursor is not qualified.
 * Integrity is checked by reading the archive back with the repository's own ZIP reader (src/core/interchange/zip.ts).
 */
import {build,type Metafile} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,join,relative,sep,dirname} from 'node:path';
import {zipEntries,zipText} from '../src/core/interchange/zip';

const root=resolve('.'),host=resolve(root,'hosts/vscode');
const args=process.argv.slice(2),at=args.indexOf('--out');
if(args.some((a,i)=>a!=='--out'&&args[i-1]!=='--out')||(at>=0&&!args[at+1]))throw new Error('Usage: tsx scripts/package-vsix.ts [--out <new directory>]');
const git=(...a:string[])=>{try{return execFileSync('git',a,{encoding:'utf8',cwd:root}).trim();}catch{return 'unknown';}};
const sourceSha=git('rev-parse','HEAD'),dirty=git('status','--porcelain','--untracked-files=no')!=='';
const out=resolve(at>=0?args[at+1]:join(root,'.local/vsix',sourceSha.slice(0,12)+(dirty?'-dirty':'')));
if(existsSync(out)&&readdirSync(out).length)throw new Error('Choose a new or empty output directory');
const manifest=JSON.parse(readFileSync(join(host,'package.json'),'utf8')) as {name:string;displayName:string;description:string;version:string;publisher:string;engines:{vscode:string};main:string};

// 1. Type-check the host against the shared source (the repository root config does not include hosts/).
execFileSync(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'--noEmit','-p',join(host,'tsconfig.json')],{stdio:'inherit',cwd:root});

// 2. Bundle. No source maps (they would carry local absolute paths), no network, generic icons only.
const stage=join(out,'stage');mkdirSync(stage,{recursive:true});
const common={bundle:true,minify:true,sourcemap:false,legalComments:'none',logLevel:'warning',metafile:true,absWorkingDir:root} as const;
const extension=await build({...common,entryPoints:[join(host,'src/extension.ts')],platform:'node',format:'cjs',target:'node20',external:['vscode'],outfile:join(stage,'extension/dist/extension.cjs')});
const webview=await build({...common,entryPoints:[join(host,'src/webview.tsx')],platform:'browser',format:'iife',target:'es2022',jsx:'automatic',outdir:join(stage,'extension/media'),entryNames:'webview',
 define:{'import.meta.env':'{"BASE_URL":"./"}','process.env.NODE_ENV':'"production"'},loader:{'.woff':'empty','.woff2':'empty','.ttf':'empty','.otf':'empty'}});

// 3. Licenses of the packages actually bundled, from their own package directories.
const bundled=(meta:Metafile)=>Object.keys(meta.inputs).flatMap(input=>{const m=input.replace(/\\/g,'/').match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//);return m?[m[1]]:[];});
const packages=[...new Set([...bundled(extension.metafile),...bundled(webview.metafile)])].sort();
const licenses=['DIAGRAMCLOUD VIEWER - LICENSES OF BUNDLED PACKAGES','DiagramCloud source: MIT (LICENSE.txt). Third-party artwork and attributions: THIRD_PARTY_NOTICES.md.',''];
for(const name of packages){const dir=join(root,'node_modules',name),p=JSON.parse(readFileSync(join(dir,'package.json'),'utf8')) as {version?:string;license?:unknown};
 licenses.push('============================================================',`${name}@${p.version}`,`Declared license: ${JSON.stringify(p.license??'not declared')}`);
 for(const file of readdirSync(dir).filter(n=>/^(licen[cs]e|copying|notice)([._-].*)?$/i.test(n)&&statSync(join(dir,n)).isFile()))licenses.push(`--- ${file} ---`,readFileSync(join(dir,file),'utf8'));}

// 4. Package members.
const files=new Map<string,Buffer>();
const walk=(dir:string)=>{for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())walk(path);else files.set(relative(stage,path).split(sep).join('/'),readFileSync(path));}};walk(stage);
files.set('extension/package.json',Buffer.from(JSON.stringify({...manifest,diagramcloud:{sourceCommit:sourceSha,sourceDirty:dirty}},null,2)+'\n'));
files.set('extension/README.md',readFileSync(join(host,'README.md')));files.set('extension/LICENSE.txt',readFileSync(join(root,'LICENSE')));
files.set('extension/THIRD_PARTY_NOTICES.md',readFileSync(join(root,'THIRD_PARTY_NOTICES.md')));files.set('extension/THIRD_PARTY_LICENSES.txt',Buffer.from(licenses.join('\n')+'\n'));
const xml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
files.set('extension.vsixmanifest',Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
 <Metadata>
  <Identity Language="en-US" Id="${xml(manifest.name)}" Version="${xml(manifest.version)}" Publisher="${xml(manifest.publisher)}"/>
  <DisplayName>${xml(manifest.displayName)}</DisplayName>
  <Description xml:space="preserve">${xml(manifest.description)}</Description>
  <Categories>Visualization</Categories>
  <Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="${xml(manifest.engines.vscode)}"/><Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"/></Properties>
 </Metadata>
 <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
 <Dependencies/>
 <Assets>
  <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
  <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true"/>
 </Assets>
</PackageManifest>
`));
files.set('[Content_Types].xml',Buffer.from('<?xml version="1.0" encoding="utf-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json"/><Default Extension=".vsixmanifest" ContentType="text/xml"/><Default Extension=".md" ContentType="text/markdown"/><Default Extension=".txt" ContentType="text/plain"/><Default Extension=".cjs" ContentType="application/javascript"/><Default Extension=".js" ContentType="application/javascript"/><Default Extension=".css" ContentType="text/css"/></Types>\n'));
for(const name of files.keys())if(/\.(?:map|woff2?|ttf|otf)$/i.test(name)||/(?:^|\/)(?:node_modules|\.local|\.git)(?:\/|$)/.test(name))throw new Error('Refused package member '+name);

// 5. ZIP writer (deflate, fixed timestamp so equal inputs give equal bytes).
const table=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=(b:Uint8Array)=>{let c=0xffffffff;for(const x of b)c=table[(c^x)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
const locals:Buffer[]=[],central:Buffer[]=[];let offset=0;
for(const name of [...files.keys()].sort((a,b)=>a==='[Content_Types].xml'?-1:b==='[Content_Types].xml'?1:a.localeCompare(b))){
 const data=files.get(name)!,packed=deflateRawSync(data,{level:9}),key=Buffer.from(name,'utf8'),crc=crc32(data);
 const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0x0800,6);head.writeUInt16LE(8,8);head.writeUInt16LE(0,10);head.writeUInt16LE(0x21,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(packed.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(key.length,26);head.writeUInt16LE(0,28);
 const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(0x0800,8);dir.writeUInt16LE(8,10);dir.writeUInt16LE(0,12);dir.writeUInt16LE(0x21,14);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(packed.length,20);dir.writeUInt32LE(data.length,24);dir.writeUInt16LE(key.length,28);dir.writeUInt32LE(offset,42);
 locals.push(head,key,packed);central.push(dir,key);offset+=30+key.length+packed.length;
}
const centralBytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(offset,16);
const vsix=join(out,`${manifest.name}-${manifest.version}.vsix`),bytes=Buffer.concat([...locals,centralBytes,end]);mkdirSync(dirname(vsix),{recursive:true});writeFileSync(vsix,bytes);

// 6. Read it back with the product's own reader and compare every member.
const view=new Uint8Array(bytes),entries=zipEntries(view);
if(entries.size!==files.size)throw new Error('VSIX read-back: member count differs');
for(const [name,data] of files)if(/\.(?:json|md|txt|xml|vsixmanifest|css|cjs|js)$/.test(name)&&await zipText(view,entries,name)!==data.toString('utf8'))throw new Error('VSIX read-back differs for '+name);
const sha256=createHash('sha256').update(bytes).digest('hex');
writeFileSync(join(out,'vsix-receipt.json'),JSON.stringify({format:'diagramcloud.vsix-source-package/1',vsix:relative(out,vsix),sha256,bytes:bytes.length,sourceCommit:sourceSha,sourceDirty:dirty,members:[...files.keys()].sort(),bundledPackages:packages,
 meaning:'Source-package proof only: built and read back from this source. Not installed, not published, not signed; installed VS Code/Cursor behaviour is not claimed.'},null,2)+'\n');
console.log(JSON.stringify({vsix:relative(root,vsix).split(sep).join('/'),sha256,members:files.size}));
