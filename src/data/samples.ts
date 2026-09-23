import {documentSchema,nodeSchema,edgeSchema,viewSchema,blockSchema,validateDocument,type Project,type ProjectNode,type ProjectEdge,type EvidenceBlock} from '../core/model';

function project(id:string,title:string,summary:string,category:Project['category'],tags:string[]):Project{return documentSchema.parse({schemaVersion:1,id,title,summary,category,tags,rootViewId:'overview',author:category==='Portfolio'?'Julian Passebecq':'DiagramCloud reference library',provenance:category==='Portfolio'?'Reconstructed from the user-provided portfolio PDFs. Tables, code and visual flow speeds in this app are synthetic teaching examples, not verified employer data or measured performance.':'Independently authored educational example. Not an official or vendor-approved architecture.',nodes:[],edges:[],views:[{id:'overview',title:'Architecture overview'}]});}
function node(d:Project,id:string,label:string,kind:ProjectNode['kind'],options:Partial<ProjectNode>={}){d.nodes.push(nodeSchema.parse({id,label,kind,...options}));return id;}
function view(d:Project,id:string,title:string,description:string,names:string[],links:[string,string,string,ProjectEdge['kind']?][],columns=3){const edgeIds=links.map(([source,target,label,kind],i)=>{const eid=`${id}-e${i}`;d.edges.push(edgeSchema.parse({id:eid,source,target,label,kind:kind??'batch',speed:kind==='stream'?'fast':kind==='control'?'slow':'medium'}));return eid;});const v=viewSchema.parse({id,title,description,nodeIds:names,edgeIds,positions:Object.fromEntries(names.map((id,i)=>[id,{x:(i%columns)*300,y:Math.floor(i/columns)*180}]))});const old=d.views.findIndex(v=>v.id===id);if(old<0)d.views.push(v);else d.views[old]=v;}
function block(d:Project,nodeId:string,value:unknown){const b=blockSchema.parse(value);d.blocks.push(b);d.nodes.find(n=>n.id===nodeId)!.blockIds.push(b.id);}
function note(d:Project,nodeId:string,id:string,title:string,text:string,provenance:EvidenceBlock['provenance']='synthetic',sourceIds:string[]=[]){block(d,nodeId,{id,title,type:'text',text,provenance,sourceIds});}
const portfolioSources=[{id:'pdf-six',title:'Total_Foilo_Portfolio_6_pages (2).pdf',location:'User-supplied six-page portfolio; illustrative/synthetic labels retained.',visibility:'public' as const},{id:'pdf-eighteen',title:'Julian_Passebecq_Portfolio_TotalEnergies_First_NoGlossary (2).pdf',location:'User-supplied 18-page portfolio; TotalEnergies first, then Foil\u2019O.',visibility:'public' as const}];

const total=project('total-project-controls','TotalEnergies','From cost and schedule updates to a report a project controller can trust. Explore the architecture, then open the validation work behind it.','Portfolio',['Project controls','Oracle','SQL','Power BI']);
total.sources=structuredClone(portfolioSources);
node(total,'business','Business inputs','source',{summary:'Planning, drilling, cost estimates and revisions',sourceIds:['pdf-six']});
node(total,'excel','Excel preparation','process',{provider:'Excel',summary:'Assumptions, structures and update files',sourceIds:['pdf-six'],role:'Data maintenance and schedule coordination'});
node(total,'oracle','Oracle project database','storage',{provider:'Oracle',summary:'Consolidated project cost and schedule',childViewId:'data-model',sourceIds:['pdf-six']});
node(total,'checks','SQL quality checks','control',{provider:'SQL',summary:'Validate, reconcile and explain discrepancies',childViewId:'validation',status:'running',sourceIds:['pdf-six'],role:'Checked data consistency and prepared reporting views'});
node(total,'powerbi','Power BI reporting','report',{provider:'Power BI',summary:'Planning snapshots, CAPEX phasing, variance',childViewId:'reporting',sourceIds:['pdf-six','pdf-eighteen']});
view(total,'overview','Project controls | end-to-end','A readable overview. Click SQL quality checks to open the task underneath, then a check to inspect its SQL and sample rows.',['business','excel','oracle','checks','powerbi'],[['business','excel','update files'],['excel','oracle','load'],['oracle','checks','validate','query'],['checks','powerbi','trusted views']]);
node(total,'mandatory','Required fields','function',{provider:'SQL',summary:'WBS, dates and costs must be populated',childViewId:'check-detail'});
node(total,'dates','Date sequence','function',{provider:'SQL',summary:'Start date must not follow finish date'});
node(total,'reconcile','Cost reconciliation','function',{provider:'SQL',summary:'Detail cost must agree with the reporting total'});
node(total,'exceptions','Review exceptions','table',{summary:'Separate suspect records; keep the reason visible',status:'warning'});
view(total,'validation','What the validation task does','Source: six-page portfolio, page 3. The SQL implementation and sample records below are newly authored examples.',['mandatory','dates','reconcile','exceptions'],[['mandatory','dates','presence OK'],['dates','reconcile','dates OK'],['reconcile','exceptions','review results']]);
node(total,'sample-rows','Input rows','table',{summary:'Small synthetic schedule extract'});
node(total,'check-function','Validation query','function',{provider:'SQL',summary:'A readable, deterministic row-level check'});
node(total,'check-output','Flagged records','table',{summary:'Return exceptions, not a misleading clean result'});
view(total,'check-detail','Inside one quality check','A third level of explanation: input, function and output. This is displayed code, not a database execution environment.',['sample-rows','check-function','check-output'],[['sample-rows','check-function','evaluate','query'],['check-function','check-output','exceptions']]);
const sql="SELECT wbs_code, activity_name, start_date, finish_date,\n       forecast_cost_eur\nFROM staging_schedule\nWHERE wbs_code IS NULL\n   OR start_date IS NULL\n   OR finish_date IS NULL\n   OR forecast_cost_eur IS NULL\n   OR start_date > finish_date\n   OR forecast_cost_eur < 0;";
block(total,'check-function',{id:'sql-quality',title:'Row-level validation',type:'code',language:'sql',code:sql,provenance:'synthetic'});
block(total,'sample-rows',{id:'schedule-input',title:'Synthetic input',type:'table',columns:['WBS','Activity','Start','Finish','Cost EUR'],rows:[['wbs-01','Site preparation','2026-01-10','2026-01-31',120000],['wbs-02','Drilling','2026-03-20','2026-03-01',420000],['wbs-03','Commissioning','2026-07-01','2026-07-15',-1000]],provenance:'synthetic'});
block(total,'check-output',{id:'schedule-errors',title:'Expected exceptions',type:'table',columns:['WBS','Reason'],rows:[['wbs-02','Start occurs after finish'],['wbs-03','Negative forecast cost']],provenance:'synthetic'});
note(total,'mandatory','mandatory-explanation','Why check this?','The six-page portfolio identifies missing WBS, dates and costs as a quality-control concern. In an interview, explain the grain of the record, the mandatory fields, the owner of an exception and whether a failed check blocks publication.','source-derived',['pdf-six']);
block(total,'dates',{id:'date-query',title:'Date logic',type:'code',language:'sql',code:'SELECT wbs_code, revision_id\nFROM staging_schedule\nWHERE start_date > finish_date;',provenance:'synthetic'});
note(total,'reconcile','reconciliation','Define the comparison before the SQL','Aggregate the same revision, currency and reporting scope on each side. Explain any tolerance and rounding rule. Do not compare the latest detailed estimate with a different baseline and call the difference a data error.');
note(total,'exceptions','exceptions-story','My contribution versus the system','The supplied portfolio describes maintaining project data, updating milestones, checking consistency, preparing views and supporting reviews. This reconstruction does not claim sole ownership of the platform.','source-derived',['pdf-six']);
node(total,'fact-schedule','FactSchedule','table',{summary:'Illustrative grain: WBS item per revision'});node(total,'dim-project','DimProject','table',{summary:'Project identity and reporting attributes'});node(total,'dim-date','DimDate','table',{summary:'Calendar used for scheduling and phasing'});
view(total,'data-model','Data structure | not just a database icon','The detailed 18-page portfolio includes a much broader semantic model. This intentionally small model is an illustrative project-controls subset, not a transcription of all 35 tables.',['dim-project','fact-schedule','dim-date'],[['dim-project','fact-schedule','project key','dependency'],['dim-date','fact-schedule','date key','dependency']]);
block(total,'fact-schedule',{id:'fact-columns',title:'Explain the grain first',type:'table',columns:['Column','Type','Meaning'],rows:[['wbs_code','STRING','Work breakdown item'],['revision_id','STRING','Estimate version'],['start_date','DATE','Planned start'],['finish_date','DATE','Planned finish'],['forecast_cost_eur','DECIMAL','Illustrative forecast amount']],provenance:'synthetic',sourceIds:['pdf-six']});
node(total,'schedule','Schedule view','report',{summary:'Milestones and delivery sequence'});node(total,'cost','Cost phasing','report',{summary:'Quarterly spending and cumulative values'});node(total,'decision','Management review','process',{summary:'Explain changes and uncertainties'});
view(total,'reporting','Reporting and the decision it supports','No employer performance claim is inferred from the sample figures.',['schedule','cost','decision'],[['schedule','decision','delivery status'],['cost','decision','cost outlook']]);
block(total,'cost',{id:'cost-table',title:'Illustrative quarterly phasing',type:'table',columns:['Quarter','CAPEX EUR m','Cumulative EUR m'],rows:[['Q1',120,120],['Q2',180,300],['Q3',220,520],['Q4',260,780]],provenance:'synthetic',sourceIds:['pdf-six']});
note(total,'decision','interview','Interview narrative','Context: cost and schedule information came from multiple sources. Contribution: maintained and checked data, prepared reporting views and supported project reviews. Decision: make revisions and discrepancies visible. Evidence: a synthetic row-level check and a small example data model, not confidential employer records.','source-derived',['pdf-six']);
total.story=[{title:'Start with the business problem',viewId:'overview',nodeId:'business',narration:'Project controllers need a consistent view of cost and schedule, not another disconnected spreadsheet.',highlightEdgeIds:[]},{title:'Explain your contribution',viewId:'overview',nodeId:'checks',narration:'Separate the overall architecture from my work on consistency checks and reporting preparation.',highlightEdgeIds:[]},{title:'Open one concrete task',viewId:'validation',nodeId:'mandatory',narration:'Show the required fields, date logic and reconciliation before discussing the implementation.',highlightEdgeIds:[]},{title:'Show the evidence',viewId:'check-detail',nodeId:'check-function',narration:'A small query and clearly labelled synthetic rows make the work understandable without disclosing employer data.',highlightEdgeIds:[]},{title:'Close on the decision',viewId:'reporting',nodeId:'decision',narration:'Explain who uses the output and what it changes about a project review.',highlightEdgeIds:[]}];

const foilo=project('foilo-databricks','Foil\u2019O \u00c9cologie','Connect the physical energy system to a reproducible Databricks workflow and a decision-support application.','Portfolio',['Databricks','PySpark','Delta','MLflow','Streamlit']);
foilo.sources=structuredClone(portfolioSources);
node(foilo,'site','Site and machine inputs','source',{summary:'Hydrology, telemetry and machine configuration',childViewId:'hydrofoil',sourceIds:['pdf-six']});
node(foilo,'bronze','Bronze | raw inputs','storage',{provider:'Databricks',summary:'Preserve source values and ingestion context'});
node(foilo,'spark','PySpark simulation','process',{provider:'Databricks',summary:'Parameter sweeps and derived outputs',childViewId:'simulation',status:'running',role:'Databricks development, PySpark workflow and modelling inputs',sourceIds:['pdf-eighteen','pdf-six']});
node(foilo,'gold','Gold | scenario outputs','storage',{provider:'Delta Lake',summary:'Curated technical and economic datasets',childViewId:'economics'});
node(foilo,'streamlit','Streamlit decision app','app',{provider:'Streamlit',summary:'Compare assumptions and explain results'});
node(foilo,'governance','Jobs, catalog and tracking','control',{provider:'Databricks',summary:'Unity Catalog, Lakeflow Jobs and MLflow',childViewId:'governance'});
view(foilo,'overview','From water current to decision support','Reconstructed architecture from the supplied PDFs. Animated flow is authored illustration, not a running Databricks job.',['site','bronze','spark','governance','gold','streamlit'],[['site','bronze','ingest'],['bronze','spark','prepared inputs'],['spark','gold','scenario outputs'],['gold','streamlit','curated data','query'],['governance','spark','orchestrate','control']]);
node(foilo,'water','Water current','physics',{summary:'River or tidal flow resource'});node(foilo,'foil','Lift and foil motion','physics',{summary:'Controlled heave and pitch'});node(foilo,'pto','Power take-off','physics',{summary:'Motion transferred into usable power'});node(foilo,'electricity','Electricity','physics',{summary:'Generator and electrical output'});
view(foilo,'hydrofoil','Physical system | the project behind the cloud','The six-page portfolio, page 6, explains an oscillating hydrofoil rather than a conventional turbine. This is a conceptual chain, not a validated physics simulator.',['water','foil','pto','electricity'],[['water','foil','flow energy','stream'],['foil','pto','mechanical motion'],['pto','electricity','conversion']]);
block(foilo,'foil',{id:'telemetry',title:'Example input contract',type:'table',columns:['Field','Type','Synthetic example'],rows:[['timestamp_utc','TIMESTAMP','2026-01-15T10:00:00Z'],['current_velocity_ms','DOUBLE','1.5'],['foil_pitch_deg','DOUBLE','12.0'],['generator_rpm','DOUBLE','185']],provenance:'synthetic',sourceIds:['pdf-six']});
node(foilo,'config','Scenario configuration','table',{summary:'Versioned parameters and assumptions'});node(foilo,'silver','Silver | validated inputs','storage',{provider:'Delta Lake',summary:'Consistent units, keys and constraints'});node(foilo,'sweep','Parameter sweep','function',{provider:'PySpark',summary:'Evaluate a small set of scenarios',childViewId:'spark-detail'});node(foilo,'results','Scenario aggregates','table',{summary:'Group outputs by a stable scenario key'});
view(foilo,'simulation','Inside the simulation workflow','The source PDFs mention distributed scenarios and Monte Carlo. V1 illustrates the data-engineering pattern; it does not implement or verify the scientific solver.',['config','silver','sweep','results'],[['config','silver','validate'],['silver','sweep','scenario inputs'],['sweep','results','aggregate']]);
node(foilo,'parameters','Input parameter table','table',{summary:'Small synthetic scenario grid'});node(foilo,'transform','PySpark transformation','function',{provider:'PySpark',summary:'Typed calculation with explicit units'});node(foilo,'write','Delta output','storage',{provider:'Delta Lake',summary:'Persist traceable results'});
view(foilo,'spark-detail','Code and contract | a deliberately small example','A pedagogical available-power calculation. It is not an oscillating-foil performance model or a claim of validated electrical output.',['parameters','transform','write'],[['parameters','transform','input rows'],['transform','write','calculated rows']]);
block(foilo,'parameters',{id:'scenario-parameters',title:'Synthetic parameter grid',type:'table',columns:['scenario_id','velocity_ms','area_m2','cp'],rows:[['s-01',1.2,2,0.35],['s-02',1.5,2,0.35],['s-03',1.8,2,0.35]],provenance:'synthetic'});
block(foilo,'transform',{id:'spark-code',title:'Illustrative available-power proxy',type:'code',language:'python',code:"from pyspark.sql import functions as F\n\n# Teaching proxy only, not a validated hydrofoil solver.\n# rho: kg/m3; area: m2; velocity: m/s; output: kW.\nvalid = inputs.filter(\n    (F.col('velocity_ms') >= 0) &\n    (F.col('area_m2') > 0) &\n    F.col('cp').between(0, 1)\n)\nresult = valid.withColumn(\n    'power_proxy_kw',\n    0.5 * F.lit(1000.0) * F.col('area_m2') *\n    F.col('cp') * F.pow('velocity_ms', 3) / 1000.0\n)\nresult.select('scenario_id', 'power_proxy_kw')",provenance:'synthetic'});
note(foilo,'write','delta-contract','Persist context, not just a number','A useful output contract includes scenario_id, input_version, model_version and run_id. Decide whether reruns append a new version or replace a known partition. Record units and assumptions alongside the outputs.');
node(foilo,'aep','Energy assumptions','table',{summary:'Production estimates and scenario identity'});node(foilo,'finance','Economic assumptions','table',{summary:'CAPEX, OPEX, price, lifetime, discount rate'});node(foilo,'indicators','Decision indicators','report',{summary:'LCOE, NPV and sensitivity, with assumptions'});
view(foilo,'economics','Techno-economic decision layer','The PDFs contain different illustrative scenarios. Do not combine their headline numbers into one claimed result.',['aep','finance','indicators'],[['aep','indicators','production assumptions'],['finance','indicators','cost and price assumptions']]);
block(foilo,'indicators',{id:'source-scenarios',title:'Source figures are not verified achievements',type:'table',columns:['Source','NPV shown','Status'],rows:[['Six-page PDF, page 4','EUR 12.4 million','Synthetic portfolio example'],['18-page PDF, page 15','EUR 27 million','Different illustrated scenario; not reconciled']],provenance:'source-derived',sourceIds:['pdf-six','pdf-eighteen']});
note(foilo,'streamlit','app-story','Show how a person uses the output','The supplied portfolio describes scenario exploration in Streamlit: engineering and economic parameters, comparison views and decision support. In a walkthrough, show one assumption change, the affected dataset and the result it explains.','source-derived',['pdf-eighteen']);
node(foilo,'catalog','Unity Catalog','control',{provider:'Databricks',summary:'Catalogs, schemas, access and discoverability'});node(foilo,'jobs','Lakeflow Jobs','control',{provider:'Databricks',summary:'Dependencies and repeatable execution'});node(foilo,'mlflow','MLflow tracking','control',{provider:'MLflow',summary:'Parameters, runs and comparable metrics'});
view(foilo,'governance','Governance, orchestration and reproducibility','These are different responsibilities, not interchangeable product icons.',['catalog','jobs','mlflow'],[['catalog','jobs','governed data','control'],['jobs','mlflow','run context','control']]);
note(foilo,'mlflow','tracking','What makes two runs comparable?','Track input and model versions, parameter values, units and a consistent definition of every metric. A diagram cannot prove reproducibility; it can expose the contract to discuss and test.');
foilo.story=[{title:'Explain the physical system',viewId:'hydrofoil',nodeId:'foil',narration:'Begin with the project, not the vendor logos: controlled foil motion converts river or tidal flow into power.',highlightEdgeIds:[]},{title:'Show the data path',viewId:'overview',nodeId:'spark',narration:'Separate raw inputs, computation, curated results and the decision-support app.',highlightEdgeIds:[]},{title:'Open the implementation',viewId:'spark-detail',nodeId:'transform',narration:'This small synthetic code example illustrates units and traceability; it is not the project scientific solver.',highlightEdgeIds:[]},{title:'Keep scenario claims honest',viewId:'economics',nodeId:'indicators',narration:'The two portfolio documents contain different illustrative financial figures. Keep their provenance visible.',highlightEdgeIds:[]}];

function medallion(platform:'Microsoft Fabric'|'Databricks'):Project{
 const fabric=platform==='Microsoft Fabric';const d=project(fabric?'fabric-medallion':'databricks-reference',platform,fabric?'A Fabric lakehouse reference: ingestion, medallion layers, a semantic model and Power BI.':'A Databricks reference: governed raw, validated and curated data with orchestration and consumption.','Reference',[platform,'Medallion','Lakehouse','Governance']);
 d.sources=[{id:'official-guide',title:`${platform} medallion guidance`,url:fabric?'https://learn.microsoft.com/en-us/fabric/onelake/onelake-medallion-lakehouse-architecture':'https://docs.databricks.com/gcp/en/lakehouse/medallion',location:'Independently authored diagram based on this official documentation; not a copied official drawing.',visibility:'public'}];
 node(d,'sources','Operational sources','source',{summary:'Files, application exports and events',sourceIds:['official-guide']});
 node(d,'ingestion',fabric?'Data Factory pipeline':'Lakeflow ingestion','process',{provider:platform,icon:fabric?'fabric-data-factory':'generic',summary:'Land source data with ingestion metadata',childViewId:'ingestion-detail'});
 node(d,'bronze','Bronze','storage',{provider:platform,icon:fabric?'fabric-lakehouse':'generic',summary:'Raw, traceable records'});node(d,'silver','Silver','storage',{provider:platform,summary:'Validated, deduplicated and conformed',childViewId:'silver-detail',status:'running'});node(d,'gold','Gold','model',{provider:platform,summary:'Business-ready datasets at a declared grain'});node(d,'consumption',fabric?'Semantic model + Power BI':'SQL and application consumers','report',{provider:fabric?'Power BI':'Databricks',summary:'Serve governed, documented outputs'});
 view(d,'overview',`${platform} | medallion reference`,'One illustrative implementation, not a universal deployment recipe. Actual storage, compute, security and cost choices require project-specific decisions.',['sources','ingestion','bronze','silver','gold','consumption'],[['sources','ingestion','extract'],['ingestion','bronze','land'],['bronze','silver','validate'],['silver','gold','model'],['gold','consumption','consume','query']]);
 node(d,'extract','Extract','process',{summary:'Choose full load, incremental or CDC'});node(d,'land','Land raw data','storage',{summary:'Keep ingestion time and source identity'});node(d,'checkpoint','Checkpoint','control',{summary:'Advance only after successful durable output'});
 view(d,'ingestion-detail','Ingestion is a contract','Decide on source identity, retries, checkpointing, permissions and recovery before drawing an arrow.',['extract','land','checkpoint'],[['extract','land','records'],['land','checkpoint','commit checkpoint','control']]);
 note(d,'checkpoint','checkpoint-contract','Discuss the failure boundary','If a batch writes successfully but checkpoint advancement fails, replay must not create incorrect duplicates. The mechanism depends on the source and sink; an arrow labelled incremental is not enough.','reference',['official-guide']);
 node(d,'schema','Validate schema','control',{summary:'Required columns and compatible types'});node(d,'dedup','Deduplicate','function',{summary:'Stable business key and ordering'});node(d,'contract','Publish contract','table',{summary:'Document grain, keys and quality rules'});
 view(d,'silver-detail','Inside the Silver transformation','This child view is a teaching example. The exact implementation depends on the workload.',['schema','dedup','contract'],[['schema','dedup','valid records'],['dedup','contract','conformed records']]);
 block(d,'dedup',{id:'sql-dedup',title:'Deterministic ordering requires a tie-breaker',type:'code',language:'sql',code:'WITH ranked AS (\n  SELECT *, ROW_NUMBER() OVER (\n    PARTITION BY order_id\n    ORDER BY updated_at DESC, ingestion_id DESC\n  ) AS row_rank\n  FROM bronze_orders\n)\nSELECT order_id, customer_id, order_total, updated_at\nFROM ranked\nWHERE row_rank = 1;',provenance:'synthetic'});
 block(d,'contract',{id:'silver-contract',title:'Illustrative table contract',type:'table',columns:['Property','Definition'],rows:[['Grain','One current row per order'],['Business key','order_id'],['Ordering','updated_at, then unique ingestion_id'],['Quality','order_id is present; totals meet business rules'],['Security','No real customer rows in this demo']],provenance:'synthetic'});
 d.story=[{title:'Three responsibilities, not three colours',viewId:'overview',nodeId:'bronze',narration:'Raw records, validated data and business-ready models have different responsibilities.',highlightEdgeIds:[]},{title:'Explain a transformation',viewId:'silver-detail',nodeId:'dedup',narration:'A declared key and deterministic ordering are more useful than an unexplained Spark icon.',highlightEdgeIds:[]}];return validateDocument(d);
}

const platform=project(
 'datapass-platform',
 'Datapass | project architecture map',
 'A clickable map of the current learning and portfolio infrastructure. Start at the overall platform, open Foil or the GCP asset hub, then continue to a concrete table, task or example row.',
 'Reference',
 ['Datapass','Foil','GCP','BigQuery','Fabric','Databricks','DuckLake','Airflow']
);
platform.provenance='Author-created architecture plan for the Datapass/Foil lab. Product names describe intended responsibilities; static example rows and tasks are pedagogical and do not imply live cloud connections.';

node(platform,'workstation','VS Code + local tools','app',{provider:'VS Code',summary:'Authoring surface for DiagramCloud, Datapass Studio and project code',childViewId:'studio-workspace'});
node(platform,'foil-project','Foil data platform','process',{provider:'Multi-cloud',summary:'Operational data, streaming, historical analytics and ML',childViewId:'foil-platform'});
node(platform,'gcp-hub','GCP asset + analytics hub','storage',{provider:'Google Cloud',summary:'Drive archives, object storage and BigQuery metadata/analytics',childViewId:'gcp-assets'});
node(platform,'portfolio','Portfolio + CV + website','app',{provider:'DiagramCloud',summary:'Architecture stories and generated PNG/PDF/PPTX artifacts',childViewId:'portfolio-flow'});
node(platform,'learning','Datapass Studio','app',{provider:'Local-first',summary:'Notebook, Spark, dbt, Airflow, Fabric and warehouse learning surface',childViewId:'learning-stack'});
view(platform,'overview','Datapass | overall architecture','Use this as the top-level map. Each major project opens into its own macro architecture; leaf components expose static task tables, code or example data rather than querying a live system.',['workstation','foil-project','gcp-hub','portfolio','learning'],[
 ['workstation','foil-project','develop'],
 ['workstation','portfolio','author'],
 ['workstation','learning','learn'],
 ['portfolio','gcp-hub','archive outputs'],
 ['foil-project','gcp-hub','historical analytics']
],3);

node(platform,'dc','DiagramCloud','app',{provider:'React + Fluent UI',summary:'Architecture editor, drilldown model and export engine'});
node(platform,'google-ext','Official Google tooling','control',{provider:'Google Cloud',summary:'Use official BigQuery/Cloud tooling rather than rebuild a SQL explorer'});
node(platform,'project-json','Project JSON','storage',{provider:'Local',summary:'Validated source-of-truth documents and AI-editable architecture state'});
node(platform,'exports','PNG / PDF / PPTX','report',{provider:'DiagramCloud',summary:'Generated project artifacts for sharing and portfolio use'});
view(platform,'studio-workspace','VS Code workspace | author and inspect','DiagramCloud owns project storytelling and exports. Official provider extensions own provider-specific browsing/query experiences.',['dc','project-json','google-ext','exports'],[
 ['project-json','dc','load/edit'],
 ['dc','exports','generate'],
 ['google-ext','dc','reference architecture','dependency']
]);

node(platform,'simulator','Wind / hydrofoil simulator','source',{provider:'Foil lab',summary:'Synthetic machine and sensor events'});
node(platform,'oracle-op','Oracle operational DB','storage',{provider:'Oracle',summary:'Machine config, maintenance, runs and operational state',childViewId:'oracle-tables'});
node(platform,'kafka','Kafka event bus','process',{provider:'Kafka',summary:'Transport high-frequency telemetry to real-time consumers'});
node(platform,'fabric-rt','Fabric real-time analytics','report',{provider:'Microsoft Fabric',summary:'Eventstream / Eventhouse / KQL / Power BI for live operational views',childViewId:'fabric-tasks'});
node(platform,'airflow','Airflow orchestration','control',{provider:'Apache Airflow',summary:'Scheduled extraction, aggregation and cross-system jobs',childViewId:'airflow-tasks'});
node(platform,'bigquery','BigQuery historical analytics','storage',{provider:'Google Cloud',summary:'Serverless SQL for curated logs, JSON and telemetry history',childViewId:'bigquery-detail'});
node(platform,'ducklake','MotherDuck / DuckLake','storage',{provider:'MotherDuck',summary:'Separate Bronze / Silver / Gold learning lakehouse',childViewId:'ducklake-detail'});
node(platform,'databricks-ml','Databricks ML','model',{provider:'Databricks',summary:'PySpark feature engineering, experiments and MLflow',childViewId:'databricks-detail'});
view(platform,'foil-platform','Foil | macro data architecture','The same Foil source can feed different responsibilities: Oracle for operational state, Kafka/Fabric for real time, Airflow/BigQuery for historical analytics, DuckLake for medallion practice and Databricks for ML.',['simulator','oracle-op','kafka','fabric-rt','airflow','bigquery','ducklake','databricks-ml'],[
 ['simulator','oracle-op','operational writes'],
 ['simulator','kafka','telemetry','stream'],
 ['kafka','fabric-rt','live events','stream'],
 ['oracle-op','airflow','scheduled extract','batch'],
 ['airflow','bigquery','logs + snapshots','batch'],
 ['airflow','ducklake','training pipeline','batch'],
 ['ducklake','databricks-ml','curated features','dependency']
],4);

node(platform,'oracle-machine','machines','table',{provider:'Oracle',summary:'Machine identity, deployment and configuration'});
node(platform,'oracle-run','simulation_runs','table',{provider:'Oracle',summary:'One operational run with status, timestamps and version'});
node(platform,'oracle-maint','maintenance_events','table',{provider:'Oracle',summary:'Inspection and maintenance state'});
view(platform,'oracle-tables','Oracle | operational schema examples','Static example tables clarify what belongs in the operational system.',['oracle-machine','oracle-run','oracle-maint'],[
 ['oracle-machine','oracle-run','machine_id','dependency'],
 ['oracle-machine','oracle-maint','machine_id','dependency']
]);
block(platform,'oracle-run',{id:'oracle-run-table',title:'simulation_runs example',type:'table',columns:['run_id','machine_id','started_at','status','config_version'],rows:[
 ['run-1042','foil-01','2026-09-23T11:00:00Z','completed','cfg-18'],
 ['run-1043','foil-01','2026-09-23T12:00:00Z','running','cfg-18']
],provenance:'synthetic'});

node(platform,'eventstream','Eventstream ingestion','process',{provider:'Microsoft Fabric',summary:'Receive Kafka/event source and route operational events'});
node(platform,'eventhouse','Eventhouse / KQL','storage',{provider:'Microsoft Fabric',summary:'Low-latency event analytics'});
node(platform,'live-bi','Power BI live dashboard','report',{provider:'Power BI',summary:'Current machine status, alerts and recent telemetry'});
view(platform,'fabric-tasks','Fabric | real-time responsibility','Keep this branch focused on current operational visibility rather than historical lakehouse duplication.',['eventstream','eventhouse','live-bi'],[
 ['eventstream','eventhouse','ingest','stream'],
 ['eventhouse','live-bi','KQL model','query']
]);
block(platform,'live-bi',{id:'live-kpis',title:'Illustrative live KPI panel',type:'table',columns:['KPI','Example','Refresh intent'],rows:[
 ['active_machine','foil-01','near real time'],
 ['power_kw','18.7','near real time'],
 ['current_velocity_ms','1.6','near real time'],
 ['open_alerts','1','near real time']
],provenance:'synthetic'});

node(platform,'extract-job','Oracle snapshot DAG','process',{provider:'Airflow',summary:'Extract changed operational rows on a schedule'});
node(platform,'log-job','Log aggregation DAG','process',{provider:'Airflow',summary:'Aggregate API/job logs into analytical records'});
node(platform,'catalog-job','Asset catalog DAG','process',{provider:'Airflow',summary:'Index generated file metadata for the GCP catalog'});
view(platform,'airflow-tasks','Airflow | orchestration examples','Airflow schedules repeatable work. It is deliberately not the telemetry message bus.',['extract-job','log-job','catalog-job'],[
 ['extract-job','log-job','independent schedule','dependency'],
 ['log-job','catalog-job','shared run metadata','dependency']
]);
block(platform,'extract-job',{id:'airflow-extract-task',title:'DAG task contract',type:'table',columns:['Task','Input','Output','Cadence'],rows:[
 ['extract_oracle_telemetry','Oracle telemetry rows','staged Parquet/JSON','15 min'],
 ['load_bigquery_history','staged batch','foil.telemetry_history','15 min'],
 ['compact_training_snapshot','validated batch','DuckLake Bronze','hourly']
],provenance:'synthetic'});

node(platform,'bq-telemetry','foil.telemetry_history','table',{provider:'BigQuery',summary:'Partitioned historical telemetry for serverless SQL',childViewId:'bq-telemetry-table'});
node(platform,'bq-logs','foil.job_logs','table',{provider:'BigQuery',summary:'Analytical job/API log events'});
node(platform,'bq-assets','datapass.asset_catalog','table',{provider:'BigQuery',summary:'Searchable metadata for generated project artifacts',childViewId:'bq-asset-table'});
node(platform,'bq-json','JSON / nested examples','function',{provider:'BigQuery',summary:'Practice STRUCT, ARRAY and JSON without duplicating the lakehouse'});
view(platform,'bigquery-detail','BigQuery | historical + metadata layer','BigQuery is not the binary file store and not a second Bronze/Silver/Gold system. It holds queryable history and metadata around project assets.',['bq-telemetry','bq-logs','bq-assets','bq-json'],[
 ['bq-telemetry','bq-json','analyze','query'],
 ['bq-logs','bq-json','analyze','query'],
 ['bq-assets','bq-json','search','query']
]);

node(platform,'telemetry-row','Example telemetry rows','table',{summary:'Static synthetic rows at five-minute grain'});
node(platform,'telemetry-sql','Historical SQL task','function',{provider:'GoogleSQL',summary:'Example aggregation task; displayed only'});
node(platform,'telemetry-output','Expected result','table',{summary:'Expected result from the synthetic rows'});
view(platform,'bq-telemetry-table','BigQuery | from table to task','This leaf demonstrates the final drill-down level: table rows, a query task and the expected output. DiagramCloud displays them; it does not execute BigQuery.',['telemetry-row','telemetry-sql','telemetry-output'],[
 ['telemetry-row','telemetry-sql','input rows','query'],
 ['telemetry-sql','telemetry-output','expected result','query']
]);
block(platform,'telemetry-row',{id:'bq-telemetry-rows',title:'Synthetic telemetry_history rows',type:'table',columns:['event_ts','machine_id','power_kw','velocity_ms','status'],rows:[
 ['2026-09-23T12:00:00Z','foil-01',18.2,1.55,'ok'],
 ['2026-09-23T12:05:00Z','foil-01',18.7,1.60,'ok'],
 ['2026-09-23T12:10:00Z','foil-01',0,1.61,'alert']
],provenance:'synthetic'});
block(platform,'telemetry-sql',{id:'bq-history-sql',title:'Example GoogleSQL task',type:'code',language:'sql',code:"SELECT\n  machine_id,\n  DATE(event_ts) AS day,\n  AVG(power_kw) AS avg_power_kw,\n  COUNTIF(status = 'alert') AS alerts\nFROM foil.telemetry_history\nGROUP BY machine_id, day;",provenance:'synthetic'});
block(platform,'telemetry-output',{id:'bq-history-result',title:'Expected aggregation',type:'table',columns:['machine_id','day','avg_power_kw','alerts'],rows:[
 ['foil-01','2026-09-23',12.3,1]
],provenance:'synthetic'});

node(platform,'asset-row','Asset catalog rows','table',{summary:'Metadata points to files stored elsewhere'});
node(platform,'asset-search','Search task','function',{provider:'GoogleSQL',summary:'Find architecture outputs by project and type'});
view(platform,'bq-asset-table','BigQuery | project asset catalog','Binary files remain in Drive or Cloud Storage. BigQuery stores searchable metadata, provenance and lifecycle information.',['asset-row','asset-search'],[
 ['asset-row','asset-search','filter metadata','query']
]);
block(platform,'asset-row',{id:'asset-catalog-rows',title:'Synthetic asset metadata',type:'table',columns:['project','file_name','mime_type','storage','version'],rows:[
 ['foil','foil_macro_v3.pptx','application/pptx','Google Drive','v3'],
 ['portfolio','cloud_architecture.png','image/png','Cloud Storage','v5'],
 ['cv','cv_cloud_bi.pdf','application/pdf','Google Drive','2026-09']
],provenance:'synthetic'});
block(platform,'asset-search',{id:'asset-search-sql',title:'Find architecture exports',type:'code',language:'sql',code:"SELECT project, file_name, storage, version\nFROM datapass.asset_catalog\nWHERE REGEXP_CONTAINS(LOWER(file_name), r'architecture|macro')\nORDER BY project, version DESC;",provenance:'synthetic'});

node(platform,'drive-vault','Google Drive archive','storage',{provider:'Google Drive',summary:'Human-accessible PNG/PDF/PPTX archive created from DiagramCloud'});
node(platform,'gcs-objects','Cloud Storage objects','storage',{provider:'Google Cloud Storage',summary:'Optional object layer for scalable asset/object workflows'});
node(platform,'bq-catalog','BigQuery asset catalog','storage',{provider:'BigQuery',summary:'Metadata, logs, JSON and analytical history'});
node(platform,'object-link','Object metadata link','process',{provider:'GCP',summary:'URI + metadata connects files to queryable catalog records'});
view(platform,'gcp-assets','GCP | assets and analytics','Drive is the convenient archive already integrated in V1.2. Cloud Storage is the object layer when needed; BigQuery indexes/query metadata rather than holding PPTX/PDF/PNG bytes.',['drive-vault','gcs-objects','object-link','bq-catalog'],[
 ['drive-vault','object-link','archive metadata'],
 ['gcs-objects','object-link','object URI'],
 ['object-link','bq-catalog','catalog row','batch']
]);
block(platform,'drive-vault',{id:'drive-export-contract',title:'DiagramCloud export archive',type:'table',columns:['Artifact','Generated by','Archive target','Queryable metadata'],rows:[
 ['PNG','DiagramCloud','Google Drive / optional GCS','BigQuery asset_catalog'],
 ['PDF','Browser print','Google Drive / optional GCS','BigQuery asset_catalog'],
 ['PPTX','DiagramCloud','Google Drive / optional GCS','BigQuery asset_catalog']
],provenance:'synthetic'});

node(platform,'bronze-local','Bronze','storage',{provider:'DuckLake',summary:'Raw files/events with ingestion context'});
node(platform,'silver-local','Silver','storage',{provider:'DuckLake',summary:'Validated and conformed data'});
node(platform,'gold-local','Gold','storage',{provider:'DuckLake',summary:'Business-ready learning datasets'});
view(platform,'ducklake-detail','DuckLake | medallion responsibility','This is the dedicated Bronze/Silver/Gold learning path. BigQuery does not duplicate it.',['bronze-local','silver-local','gold-local'],[
 ['bronze-local','silver-local','validate'],
 ['silver-local','gold-local','model']
]);

node(platform,'features','Feature dataset','table',{provider:'Databricks',summary:'Curated training features from stable inputs'});
node(platform,'experiment','ML experiment','model',{provider:'MLflow',summary:'Parameters, metrics and model version'});
node(platform,'scored','Scored scenarios','table',{provider:'Databricks',summary:'Predictions or experiment outputs for comparison'});
view(platform,'databricks-detail','Databricks | ML responsibility','Keep Databricks focused on PySpark/ML/MLflow experimentation rather than duplicating BigQuery historical SQL or Fabric real-time dashboards.',['features','experiment','scored'],[
 ['features','experiment','train'],
 ['experiment','scored','score']
]);
block(platform,'features',{id:'feature-contract',title:'Example feature contract',type:'table',columns:['feature','type','meaning'],rows:[
 ['velocity_mean_15m','DOUBLE','Recent mean current velocity'],
 ['power_std_15m','DOUBLE','Recent output variability'],
 ['alert_count_1h','INT','Recent operational alerts']
],provenance:'synthetic'});

node(platform,'notebook','Notebook / Mosaic','app',{provider:'Datapass Studio',summary:'Flexible notebook and explanation surface'});
node(platform,'sparklab','SparkLab','process',{provider:'PySpark',summary:'Simulated Spark learning kernel'});
node(platform,'dbt-lab','dbt + lineage','process',{provider:'dbt',summary:'Transformations, tests and model graph'});
node(platform,'fabric-lab','Fabric lab','app',{provider:'Microsoft Fabric',summary:'Notebook/pipeline/event architecture exercises'});
view(platform,'learning-stack','Datapass Studio | learning toolbox','One teaching platform composes reusable tools instead of splitting each technology into a separate app.',['notebook','sparklab','dbt-lab','fabric-lab'],[
 ['notebook','sparklab','execute'],
 ['sparklab','dbt-lab','dataset'],
 ['dbt-lab','fabric-lab','architecture exercise','dependency']
]);

node(platform,'diagram-author','DiagramCloud model','app',{provider:'DiagramCloud',summary:'Author project architecture and evidence'});
node(platform,'artifact-export','Generate PNG/PDF/PPTX','report',{provider:'DiagramCloud',summary:'Create static/shareable project outputs'});
node(platform,'archive-file','Archive output','storage',{provider:'Google Drive',summary:'Keep human-readable project versions'});
node(platform,'catalog-file','Catalog metadata','storage',{provider:'BigQuery',summary:'Index project, type, version and URI'});
view(platform,'portfolio-flow','Portfolio artifacts | author to archive','Use the same architecture model to generate portfolio visuals, then archive the files and optionally catalog their metadata.',['diagram-author','artifact-export','archive-file','catalog-file'],[
 ['diagram-author','artifact-export','export'],
 ['artifact-export','archive-file','upload'],
 ['archive-file','catalog-file','metadata record','batch']
]);

platform.story=[
 {title:'Start from the overall map',viewId:'overview',nodeId:'foil-project',narration:'The top layer separates projects and shared infrastructure before opening provider detail.',highlightEdgeIds:[]},
 {title:'Open the Foil macro architecture',viewId:'foil-platform',nodeId:'bigquery',narration:'Assign one primary responsibility to each platform: operational, streaming, historical SQL, medallion learning or ML.',highlightEdgeIds:[]},
 {title:'Go down to a concrete BigQuery task',viewId:'bq-telemetry-table',nodeId:'telemetry-sql',narration:'Finish the explanation on synthetic rows, a displayed GoogleSQL task and its expected result rather than an abstract product box.',highlightEdgeIds:[]},
 {title:'Show how project artifacts are managed',viewId:'gcp-assets',nodeId:'drive-vault',narration:'Generated PNG, PDF and PPTX files can be archived in Drive while BigQuery catalogs metadata around them.',highlightEdgeIds:[]}
];

const blank=project('blank-project','Start from a blank project','Build a small architecture, attach evidence, then add one drilldown at a time.','Blank',['Your project']);
node(blank,'first-node','Your first component','process',{summary:'Switch to Edit to change this component.'});view(blank,'overview','Architecture overview','A diagram is the entry point; the evidence explains the work.',['first-node'],[]);
export const samples:Project[]=[validateDocument(platform),validateDocument(foilo),validateDocument(total),medallion('Microsoft Fabric'),medallion('Databricks'),validateDocument(blank)];
