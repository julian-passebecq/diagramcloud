import {lstatSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const REBUILD='Run npm run build from this clean checkout before packaging.';
const MAX_HANDSHAKE_BYTES=64*1024;
export type PackageBuildIdentity=Readonly<{sourceSha:string;productVersion:string}>;

/** Refuse a stale or unidentified dist before creating package output.
 * This checks the existing build identity, not asset authenticity, successful
 * tests or release permission. Never repair/stamp old output to make it match.
 */
export function assertPackageBuildIdentity(root:string,expected:PackageBuildIdentity):void{
 if(!/^(?!0{40}$)[a-f0-9]{40}$/.test(expected.sourceSha)||!expected.productVersion.trim())throw new Error('Exact source and product version are required for packaging');
 const file=join(root,'dist','galaxy','version-handshake.json');let value:unknown;
 try{
  const stat=lstatSync(file);
  if(!stat.isFile()||stat.size===0||stat.size>MAX_HANDSHAKE_BYTES)throw new Error('Invalid handshake file');
  const bytes=readFileSync(file);
  if(bytes.length>MAX_HANDSHAKE_BYTES)throw new Error('Handshake grew beyond the limit');
  value=JSON.parse(bytes.toString('utf8'));
 }catch{throw new Error('Packaged web build identity is missing or unreadable. '+REBUILD);}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Packaged web build identity is invalid. '+REBUILD);
 const row=value as Record<string,unknown>;
 if(row.schema_version!==1||row.app_id!=='diagramcloud'||row.standalone!==true||row.galaxy_level!=='G0')throw new Error('Packaged web build is not the expected standalone DiagramCloud build. '+REBUILD);
 if(row.source_revision!==expected.sourceSha||row.product_version!==expected.productVersion)throw new Error('Packaged web build source/version does not match the current checkout. '+REBUILD);
}
