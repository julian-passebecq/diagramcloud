
import {validateDocument,type Project,type ProjectNode} from '../../src/core/model';
import {linkedReadingKey,type LinkedReadingOptions} from '../../src/core/linkedReading';
/** A fictional case, not a scan or reconstruction of Galaxy, FOIL or an employer. */
export function buildFullStackPractice():{project:Project;reading:LinkedReadingOptions}{
 const p=validateDocument({schemaVersion:1,id:'beacon-evidence-library',title:'Beacon Evidence Library — fictional full-stack case',category:'Reference',rootViewId:'overview',
 summary:'An original teaching case: explain the business, application, request, data and delivery without confusing their identities. No runtime, customer or deployment claims.',
 nodes:[],edges:[],views:[{id:"overview",title:"Overview",nodeIds:[],edgeIds:[],positions:{}}],blocks:[],sources:[],assets:[],story:[],observations:[],tours:[]});
 p.views.length=0;
 const refs=[
 ['http','HTTP method semantics','https://datatracker.ietf.org/doc/html/rfc9110','RFC 9110; reference, not an implementation guarantee.'],
 ['sql','PostgreSQL table expressions','https://www.postgresql.org/docs/18/queries-table-expressions.html','PostgreSQL 18 SQL semantics; no database is connected.'],
 ['ci','GitHub Actions secure use','https://docs.github.com/en/actions/reference/security/secure-use','Retrieved 2026-10-20; no CI job is executed.'],
 ['iac','Terraform plan','https://developer.hashicorp.com/terraform/cli/commands/plan','Plan is a proposed change, not apply or release evidence.']
 ];
 for(const [id,title,url,location]of refs)p.sources.push({id,title,url,location,visibility:'public'});
 function block(id:string,title:string,text:string,sourceIds:string[]=[]){p.blocks.push({id,title,type:'text',text,provenance:'synthetic',visibility:'public',sourceIds});return id;}
 function node(id:string,label:string,kind:ProjectNode['kind'],summary:string,childViewId?:string){
  p.nodes.push({id,label,kind,summary,tags:[],provider:'Fictional reference',icon:'generic',role:'Authored design; not observed runtime.',status:'idle',basis:'planned',visibility:'public',sourceIds:[],blockIds:[block('b.'+id,'Meaning, assumptions and next question',summary)],...(childViewId?{childViewId}:{})});
 }
 node('business','Business question','source','Help a reviewer find permitted source material and understand why it matters. A public site sees only deliberately published excerpts, not the private originals.');
 node('application','Application capability','app','Browse, search and inspect source-backed entries. A feature is not identical to a route, package or UI control.','architecture');
 node('domain','Business objects and data','model','Entry, asset version, permission label and editorial claim have distinct identities and grains.','data');
 node('delivery','Delivery and infrastructure','control','Repository, build, artifact, environment and release receipt are separate. A preview is not production.','operations');
 node('decision','Review and publication','report','An editor explicitly chooses material for an audience. Search must operate on that permitted cut; hiding a card after searching private content is insufficient.');
 node('browser','Browser UI','app','Displays permitted entries and an inspector. Keeps reading state separate from editable content and never stores service credentials.');
 node('api','API boundary','app','Validates the caller and request, checks resource-level permissions, and returns an explicit result. A browser button is not server authorization.');
 node('identity','Identity and authorization','control','Authenticates the caller and enforces requested resource/action scope. A role display in the UI does not establish a server-side check.');
 node('metadata','Metadata database','storage','Stores stable entry IDs, asset-version references and editorial state. One row has a defined grain; do not turn every rendered occurrence into another entity.');
 node('objects','Original asset store','storage','Contains approved example bytes. A locator does not grant access. Public derivatives are separate from private originals.');
 node('index','Permitted search projection','model','Search returns only the allowed audience/scope. Derived index text is not an additional source of truth.');
 node('worker','Bounded processing worker','process','Produces derived metadata/thumbnails for selected bytes. A reported success must bind to the exact input and output identities.');
 node('telemetry','Diagnostic evidence','report','Records sanitized outcomes and correlation IDs. It must not leak raw answers, credentials or private document contents.');
 node('entry','Entry','model','One catalogued item with an ID, title, subject and publication state.');
 node('asset-version','Asset version','storage','One exact immutable file version, digest and source locator. An edited file is a new version.');
 node('claim','Editorial claim','model','One authored statement with supporting source references. A citation is inspectable support, not automatic truth.');
 node('mapping','Explicit correspondence','process','Connects an entry, business subject and source version. Name similarity does not establish identity.');
 node('request-input','Permitted request','source','Example: fetch one entry by stable ID. Input is checked by the API; displayed snippets never run here.');
 node('response','Response or refusal','report','A response is scoped and schema-checked. Missing and unauthorized resources should not leak private existence through rich diagnostics.');
 node('repo','Source repository','storage','Owns application code and reviewed changes. Company membership and repository ownership are not the same relation.');
 node('ci-job','Build and tests','process','Runs selected checks on a specified source revision with an explicit environment. A workflow definition is not a passing run.');
 node('artifact','Versioned artifact','storage','Produced files have an identity separate from the source commit and their eventual installed location.');
 node('environment','Target environment','app','An environment may be local, test or production only when supplied. This example defines no real target and grants no deployment.');
 node('iac-plan','IaC plan review','control','The candidate infrastructure change is reviewed separately from executing it. Secret-bearing plan/state data does not belong in the public explanation.');
 node('receipt','Qualification and release evidence','report','Bindings distinguish built, installed, qualified and delivered. An unresolved gate remains unknown or open; no elapsed time is inferred.');
 node('open-request','Inspect a request','control','Navigation to one request path; not another API service.','request');
 node('open-data','Inspect the data representation','control','Navigation to data meaning; it does not create or execute a query.','data');
 node('open-ops','Inspect delivery and boundaries','control','Navigation to delivery design; it does not create an infrastructure resource.','operations');
 function edge(id:string,a:string,b:string,label:string){p.edges.push({id,source:a,target:b,label,kind:'dependency',speed:'medium',basis:'planned',visibility:'public'});}
 const links=[
 ['e01','business','application','requires capability'],['e02','application','domain','uses business data'],['e03','application','delivery','is delivered through'],['e04','decision','application','publishes permitted cut'],
 ['e10','browser','api','request'],['e11','api','identity','authorization check'],['e12','api','metadata','read/write within scope'],['e13','metadata','objects','exact version locator'],['e14','worker','objects','selected input'],['e15','worker','index','derived projection'],['e16','api','index','permitted query'],['e17','api','telemetry','sanitized result'],
 ['e20','entry','asset-version','references exact version'],['e21','claim','asset-version','cites'],['e22','entry','mapping','declares correspondence'],
 ['e30','request-input','api','validated request'],['e31','api','response','scoped result or refusal'],
 ['e40','repo','ci-job','source cut'],['e41','ci-job','artifact','build output'],['e42','artifact','environment','candidate installation'],['e43','iac-plan','environment','proposed infrastructure'],['e44','environment','receipt','requires evidence']
 ];
 for(const l of links)edge(l[0],l[1],l[2],l[3]);
 function view(id:string,title:string,ids:string[],edgeIds:string[],type:'architecture'|'layers'='architecture'){
  p.views.push({id,title,description:'Fictional architecture, not an observed deployment or runtime trace.',nodeIds:ids,edgeIds,positions:Object.fromEntries(ids.map((n,i)=>[n,{x:(i%3)*300,y:Math.floor(i/3)*170}])),visibility:'public',design:{type,focal:[]}});
 }
 view('overview','Business and capability overview',['business','application','domain','delivery','decision'],['e01','e02','e03','e04']);
 view('architecture','Full-stack responsibilities',['browser','api','identity','metadata','objects','index','worker','telemetry','open-request','open-data','open-ops'],links.filter(x=>/^e1/.test(x[0])).map(x=>x[0]),'layers');
 view('request','One request and its trust boundaries',['request-input','browser','api','identity','metadata','response','telemetry'],['e10','e11','e12','e17','e30','e31']);
 view('data','Data grain and provenance',['entry','asset-version','claim','mapping','metadata','objects','index'],['e13','e20','e21','e22']);
 view('operations','Source, infrastructure and delivery',['repo','ci-job','artifact','iac-plan','environment','receipt'],['e40','e41','e42','e43','e44']);
 p.blocks.push({id:'request-contract',title:'Display-only request contract',type:'code',language:'json',code:JSON.stringify({method:'GET',path:'/entries/{entry_id}',required:'authenticated caller and entry read scope',outcome:'permitted representation or generic refusal'},null,2),provenance:'synthetic',visibility:'public',sourceIds:['http']});
 p.nodes.find(n=>n.id==='api')!.blockIds!.push('request-contract');
 p.blocks.push({id:'data-grains',title:'Data-model reading',type:'table',columns:['Entity','Row grain','Key','Limit'],rows:[
 ['Entry','One catalogued item','entry_id','Does not prove an asset is public'],
 ['AssetVersion','One exact version','asset_version_id','Digest equality is not permission'],
 ['Claim','One authored statement','claim_id','Evidence must be reviewed'],
 ['Mapping','One declared relationship','mapping_id','No name-based identity inference']
 ],provenance:'synthetic',visibility:'public',sourceIds:['sql']});
 p.nodes.find(n=>n.id==='metadata')!.blockIds!.push('data-grains');
 for(const id of ['repo','ci-job','artifact','environment','iac-plan'])p.nodes.find(n=>n.id===id)!.sourceIds=['ci','iac'];
 const project=validateDocument(p);
 return {project,reading:{projectId:project.id,sourceKey:linkedReadingKey(project),theme:'light',chapters:[
  {id:'orientation',leftViewId:'overview',rightViewId:'architecture',leftDesign:'architecture',rightDesign:'layers'},
  {id:'request-detail',parentId:'orientation',leftViewId:'architecture',rightViewId:'request',leftDesign:'layers',rightDesign:'architecture'},
  {id:'data-detail',parentId:'orientation',leftViewId:'architecture',rightViewId:'data',leftDesign:'layers',rightDesign:'architecture'},
  {id:'delivery-detail',parentId:'orientation',leftViewId:'overview',rightViewId:'operations',leftDesign:'architecture',rightDesign:'architecture'}
 ]}};
}
