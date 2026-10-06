import {validateDocument,type Project} from '../core/model';
import {block,node,note,project,view} from './builders';

/**
 * Contoso Forecasting atlas: the Sales Forecasting app of the public contoso-data-studio repository, read at one
 * revision. The local lab (what the code does) is static source; the Fabric App target is a design (planned). The
 * latency figures are the repository's own report, kept as a source-derived note: they are not an Observation.
 */
const REPO='https://github.com/julian-passebecq/contoso-data-studio',REV='61353848b4e7e129e03ea8aedfc2794a17667de3';
const at=(path:string)=>`${REPO}/blob/${REV}/${path}`;

export function contosoForecasting():Project{
 const d=project('contoso-forecasting','Contoso Forecasting','A finance planner edits a monthly forecast; the change travels through a policy-checked API, an operational store, a mirrored Bronze copy and a dbt Gold model to the chart. Local lab as built, next to the Fabric App it is designed to become.','Reference',['Fabric Apps','DuckLake','dbt','Data API','Row-level policy']);
 d.author='DiagramCloud reference library';
 d.provenance=`Read from julian-passebecq/contoso-data-studio at ${REV.slice(0,12)} (main, 2026-10-07): code paths are linked on each component. The Fabric App column is the repository's port checklist, a design, not a deployment. Data is synthetic.`;
 d.sources=[
  {id:'src-readme',title:'docs/fabric-apps/README.md',location:`contoso-data-studio @ ${REV.slice(0,12)}`,url:at('docs/fabric-apps/README.md'),visibility:'public'},
  {id:'src-adr',title:'docs/fabric-apps/ADR-001.md',location:`contoso-data-studio @ ${REV.slice(0,12)}`,url:at('docs/fabric-apps/ADR-001.md'),visibility:'public'},
  {id:'src-ui',title:'apps/web/src/pages/AppsPage.tsx',location:'Forecast UI',url:at('apps/web/src/pages/AppsPage.tsx'),visibility:'public'},
  {id:'src-client',title:'apps/web/src/fabricApps/localRayfinClient.ts',location:'Local client adapter',url:at('apps/web/src/fabricApps/localRayfinClient.ts'),visibility:'public'},
  {id:'src-api',title:'apps/api/app/routers/fabric_apps.py',location:'Data API stand-in',url:at('apps/api/app/routers/fabric_apps.py'),visibility:'public'},
  {id:'src-policy',title:'apps/api/app/services/fabric_apps/policy.py',location:'Policy evaluation',url:at('apps/api/app/services/fabric_apps/policy.py'),visibility:'public'},
  {id:'src-store',title:'apps/api/app/services/fabric_apps/store.py',location:'Operational store',url:at('apps/api/app/services/fabric_apps/store.py'),visibility:'public'},
  {id:'src-mirror',title:'apps/api/app/services/fabric_apps/mirror.py',location:'Mirror worker',url:at('apps/api/app/services/fabric_apps/mirror.py'),visibility:'public'},
  {id:'src-model',title:'apps/fabric-app-lab/rayfin/data/schema.ts',location:'Rayfin data model',url:at('apps/fabric-app-lab/rayfin/data/schema.ts'),visibility:'public'},
  {id:'src-gold',title:'dbt/models/fabric_apps/gold/forecast_vs_actual.sql',location:'dbt Gold model',url:at('dbt/models/fabric_apps/gold/forecast_vs_actual.sql'),visibility:'public'},
  {id:'src-chart',title:'apps/web/src/fabricApps/MonthlyBarChart.tsx',location:'KPI and monthly chart',url:at('apps/web/src/fabricApps/MonthlyBarChart.tsx'),visibility:'public'},
 ];
 const read={basis:'static-source' as const},design={basis:'planned' as const};
 node(d,'planner','Finance planner','source',{...read,summary:'Fake local users: finance per department (Ana, Ben, Cleo) and an executive reader (Eva)',sourceIds:['src-readme']});
 node(d,'forecast-ui','Forecast UI','app',{...read,provider:'React',summary:'Apps page: edit monthly forecasts, see variance, KPIs and the trace of each save',sourceIds:['src-ui']});
 node(d,'client','Local Rayfin client','function',{...read,provider:'TypeScript',summary:'Same call shapes as RayfinClient (select/where/orderBy, create, update); REST plus X-Local-User',sourceIds:['src-client']});
 node(d,'api','Data API and policies','control',{...read,provider:'FastAPI',summary:'/api/fabric-apps: every call checks the Rayfin role policies (finance edits own department)',childViewId:'policy',sourceIds:['src-api','src-policy']});
 node(d,'operational','Operational SQL store','storage',{...read,provider:'SQLite',summary:'Stand-in for the Fabric SQL database; DDL from the exported Rayfin model',sourceIds:['src-store','src-model']});
 node(d,'mirror','Mirror worker','process',{...read,provider:'Python',summary:'On change and every 5 s: copies changed rows to Bronze, one snapshot per batch',sourceIds:['src-mirror']});
 node(d,'bronze','Bronze copy','table',{...read,provider:'DuckLake',summary:'contoso.bronze.sfapp_*: the OneLake stand-in, with table history',childViewId:'data-zones',sourceIds:['src-mirror']});
 node(d,'gold','forecast_vs_actual','model',{...read,provider:'dbt',summary:'Gold: monthly forecast vs actuals per department, variance; built from Bronze, never from the operational store',sourceIds:['src-gold']});
 node(d,'chart','KPI and monthly chart','report',{...read,provider:'React',summary:'Reads /gold, filtered by the user department (executives see all)',sourceIds:['src-chart']});
 node(d,'fabric-app','Fabric App (target)','app',{...design,provider:'Microsoft Fabric',summary:'The same app on Fabric: open the target design to see what carries over and what is replaced',childViewId:'fabric-target',sourceIds:['src-readme','src-adr']});
 view(d,'overview','Sales Forecasting | local lab as built','One save, end to end. Every component here is read from the repository at the stated revision. Open the policies, the data zones or the Fabric target.',
  ['planner','forecast-ui','client','api','operational','mirror','bronze','gold','chart','fabric-app'],
  [['planner','forecast-ui','edit forecast','control'],['forecast-ui','client','save'],['client','api','REST + X-Local-User','query'],['api','operational','write after policy'],['operational','mirror','on change + every 5 s','stream'],['mirror','bronze','snapshot per batch'],['bronze','gold','dbt build'],['gold','chart','department-filtered read','query'],['forecast-ui','fabric-app','port','dependency']],5);
 // Serpentine: the second row runs back under the operational store, so the mirror and the port routes never share a lane.
 Object.assign(d.views.find(v=>v.id==='overview')!.positions,{mirror:{x:1200,y:180},bronze:{x:900,y:180},gold:{x:600,y:180},chart:{x:300,y:180},'fabric-app':{x:0,y:180}});
 note(d,'mirror','latency-report','Reported latency (not observed here)','The repository README reports, measured locally on Windows: write to Bronze commit 0.6–0.9 s (0.1–0.3 s per batch when idle), write to Gold chart 10–20 s, dominated by dbt build. Fabric publishes no latency figure for this path. DiagramCloud did not measure this; it is the source repository’s claim.','source-derived',['src-readme']);
 block(d,'fabric-app',{id:'local-fabric-map',title:'Local lab ↔ Fabric App',type:'table',columns:['Concern','Fabric App','This lab','Same code?'],rows:[
  ['Data model','Rayfin decorators','same files, same package','Yes'],['Permissions','DAB policies','same decorators, evaluated in policy.py','Model yes'],
  ['Operational DB','Fabric SQL database','SQLite','No'],['Data API','Data API Builder (GraphQL)','FastAPI','No'],['Client','RayfinClient','LocalRayfinClient','Call sites yes'],
  ['Identity','Entra ID claims','fake users, same claim names','No'],['Mirroring','SQL DB → OneLake Delta','worker → DuckLake Bronze','No'],
  ['Transform','notebooks / dbt','dbt forecast_vs_actual','SQL mostly yes'],['Report filter','semantic model RLS','/gold by department','No'],['UI','Fabric static hosting','Apps page','Mostly yes']],
  provenance:'source-derived',sourceIds:['src-readme']});

 node(d,'role-finance','finance role','control',{...read,summary:'Create and update forecasts of the user department only',sourceIds:['src-policy','src-model']});
 node(d,'role-executive','executive role','control',{...read,summary:'Read every department; no writes',sourceIds:['src-policy','src-model']});
 node(d,'forecast-entity','Forecast','table',{...read,provider:'Rayfin',summary:'uuid id, department_id, month, amount, updated_by',sourceIds:['src-model']});
 view(d,'policy','Who may change a forecast','The policy is declared on the Rayfin entities and evaluated on every API call; the UI never decides it.',['role-finance','role-executive','forecast-entity'],
  [['role-finance','forecast-entity','create / update own department','control'],['role-executive','forecast-entity','read all','query']]);
 d.views.find(v=>v.id==='policy')!.perspective='system';

 node(d,'zone-operational','Operational zone','storage',{...read,provider:'SQLite',summary:'Forecasts, actuals and departments as the app writes them',sourceIds:['src-store']});
 node(d,'zone-bronze','Bronze zone','table',{...read,provider:'DuckLake',summary:'sfapp_forecasts, sfapp_actuals, sfapp_departments with _mirrored_at',sourceIds:['src-mirror','src-gold']});
 node(d,'zone-gold','Gold zone','model',{...read,provider:'dbt',summary:'gold.forecast_vs_actual with variance and variance_pct',sourceIds:['src-gold']});
 view(d,'data-zones','Data zones | operational → Bronze → Gold','Data zones only. The environment (local lab or Fabric) is a separate dimension: see the Fabric target view.',['zone-operational','zone-bronze','zone-gold'],
  [['zone-operational','zone-bronze','mirror'],['zone-bronze','zone-gold','dbt build']]);
 block(d,'zone-gold',{id:'gold-sql',title:'Gold model (excerpt)',type:'code',language:'sql',code:"select f.month, d.code as department_code,\n       f.forecast_amount, a.actual_amount,\n       a.actual_amount - f.forecast_amount as variance\nfrom forecasts f\njoin {{ source('fabric_app', 'sfapp_departments') }} d on d.id = f.department_id\nleft join actuals a on a.department_id = f.department_id and a.month = f.month",provenance:'source-derived',sourceIds:['src-gold']});

 node(d,'entra','Entra ID sign-in','control',{...design,provider:'Microsoft Entra ID',summary:'Replaces the fake users; app roles carry finance / executive'});
 node(d,'rayfin-client','RayfinClient','function',{...design,provider:'Microsoft Fabric',summary:'Replaces LocalRayfinClient; call sites unchanged'});
 node(d,'dab','Data API Builder','control',{...design,provider:'Microsoft Fabric',summary:'Generated by rayfin up; enforces the same policies'});
 node(d,'fabric-sql','Fabric SQL database','storage',{...design,provider:'Microsoft Fabric',summary:'rayfin up db apply'});
 node(d,'onelake','OneLake (mirrored Delta)','table',{...design,provider:'Microsoft Fabric',summary:'Built-in mirroring replaces the worker'});
 view(d,'fabric-target','Fabric App target | design','Planned, not deployed. Shared components (Forecast UI, Gold model, chart) are the same IDs as in the lab because their code carries over; the rest replaces a local adapter.',
  ['entra','forecast-ui','rayfin-client','dab','fabric-sql','onelake','gold','chart'],
  [['entra','forecast-ui','token with role claim','control'],['forecast-ui','rayfin-client','save'],['rayfin-client','dab','GraphQL','query'],['dab','fabric-sql','write after policy'],['fabric-sql','onelake','managed mirroring','stream'],['onelake','gold','transform'],['gold','chart','read','query']],4);
 // The target design is planned as a whole; the lab's connections are read from the code.
 for(const e of d.edges)e.basis=e.id.startsWith('fabric-target-')||e.target==='fabric-app'?'planned':'static-source';
 const persp:Record<string,Project['views'][number]['perspective']>={overview:'system','data-zones':'data','fabric-target':'cloud'};
 for(const v of d.views)if(persp[v.id])v.perspective=persp[v.id];
 d.atlas={activeSnapshotId:'snap-20261007',snapshots:[{id:'snap-20261007',capturedAt:'2026-10-07T00:00:00.000Z',label:'Read for the reference sample',
  repositories:[{id:'contoso',title:'Contoso Data Studio',host:'github',locator:REPO,revision:REV,ref:'main',scanStatus:'not-scanned',authority:'author',note:'Components read by hand from the files linked on each card.',visibility:'public'}],runtimeRefs:[],contextRefs:[]}]};
 d.story=[
  {title:'A planner edits a forecast',viewId:'overview',nodeId:'planner',narration:'Finance users change only their department; the executive reads everything.',highlightEdgeIds:[]},
  {title:'Policies on every call',viewId:'overview',nodeId:'api',narration:'The API evaluates the Rayfin policies, so the rule lives with the data model, not in the screen.',highlightEdgeIds:[]},
  {title:'Mirrored, never queried live',viewId:'overview',nodeId:'mirror',narration:'Analytics read a Bronze copy taken per batch; Gold is built from it, not from the operational store.',highlightEdgeIds:[]},
  {title:'What changes on Fabric',viewId:'overview',nodeId:'fabric-app',narration:'Model, policies, UI and Gold SQL carry over; identity, API, store and mirroring are replaced by Fabric services.',highlightEdgeIds:[]},
 ];
 return validateDocument(d);
}
