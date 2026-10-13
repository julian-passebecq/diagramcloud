import {secretInText} from '../core/secrets';
import {wantedDocument} from './documents';
import {wantedFile} from '../core/scan/scanner';
import type {ScanFile} from '../core/scan/scanner';
import type {DocumentDiagnostic} from './types';

const driver:Record<string,string>={pg:'PostgreSQL',postgres:'PostgreSQL',psycopg:'PostgreSQL','psycopg2-binary':'PostgreSQL',sqlite3:'SQLite','better-sqlite3':'SQLite',mssql:'SQL Server',mysql2:'MySQL'};
const normalize=(s:string)=>({postgres:'PostgreSQL',postgresql:'PostgreSQL',sqlite:'SQLite','sql server':'SQL Server',mysql:'MySQL'}[s.toLowerCase()]);
/** Compare only explicitly labelled datastore prose with literal selected driver
 * declarations. A discrepancy is a review candidate: packages may coexist, and
 * a document may describe a target. Neither source is silently preferred. */
export function sourceConflictCandidates(documents:readonly ScanFile[],files:readonly ScanFile[]):DocumentDiagnostic[]{
 const dependencies:{path:string;line:number;platform:string}[]=[];
 for(const file of files){if(!wantedFile(file.path)||secretInText(file.path)||secretInText(file.text)||!/(^|\/)package\.json$/.test(file.path))continue;try{const data=JSON.parse(file.text);for(const section of ['dependencies','devDependencies','optionalDependencies'])for(const name of Object.keys(data[section]??{})){const platform=driver[name];if(!platform||typeof data[section][name]!=='string')continue;const at=file.text.indexOf('"'+name+'"');dependencies.push({path:file.path,line:file.text.slice(0,Math.max(0,at)).split('\n').length,platform});}}catch{/* Syntax diagnostics belong to the manifest reader. */}}
 const diagnostics:DocumentDiagnostic[]=[];
 for(const file of documents){if(!wantedDocument(file.path)||secretInText(file.path)||secretInText(file.text)||!/\.md$/i.test(file.path))continue;const lines=file.text.split(/\r?\n/);for(let i=0;i<lines.length;i++){const match=/^\s*(?:[-*]\s*)?(?:Primary datastore|Primary database|Database)\s*:\s*(PostgreSQL|Postgres|SQLite|SQL Server|MySQL)\s*[.]?\s*$/i.exec(lines[i]);if(!match)continue;const claimed=normalize(match[1]);if(!claimed||dependencies.some(d=>d.platform===claimed))continue;const other=dependencies.filter(d=>d.platform!==claimed);if(!other.length)continue;
   diagnostics.push({path:file.path,line:i+1,code:'ambiguous',message:'Source discrepancy candidate: '+file.path+':'+(i+1)+' explicitly names '+claimed+'; selected driver declarations name '+other.map(d=>d.platform+' at '+d.path+':'+d.line).join(', ')+'. Both sources are retained. Target/current scope or coexisting stores is unknown; review before deciding whether this is a conflict.'});if(diagnostics.length===20)return diagnostics;
 }}return diagnostics;
}
