/**
 * Repository scanner CLI: the same deterministic scanner as the browser, for agents and CI.
 *   npm run scan -- <repository folder> [--out diagramcloud.json] [--name "Display name"]
 * Writes a validated DiagramCloud document (import it with JSON / AI) and prints the report. Read-only: it walks the
 * folder, skips ignored and secret files, never runs git or any code, and uses no network.
 */
import {writeFileSync} from 'node:fs';
import {basename,resolve} from 'node:path';
import {scanToDocument} from '../src/core/scan';
import {readRepository} from './lib/readRepo';

const args=process.argv.slice(2),flag=(n:string)=>{const i=args.indexOf(n);return i>=0?args.splice(i,2)[1]:undefined;};
const out=flag('--out'),name=flag('--name'),root=resolve(args[0]??'.');
const files=readRepository(root);
const {document,report}=scanToDocument(files,{name,fileName:basename(root)});
const json=JSON.stringify(document,null,2);
if(out)writeFileSync(out,json+'\n');else process.stdout.write(json+'\n');
process.stderr.write([`Scanned ${files.length} files in ${basename(root)}: ${report.nodes} components, ${report.edges} connections, ${report.pages} views.`,...report.kept.map(k=>`  kept: ${k}`),...report.lost.map(l=>`  not detected: ${l}`)].join('\n')+'\n');
