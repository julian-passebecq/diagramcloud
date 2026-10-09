import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDomainFiles,extendWithDomainFacts} from '../src/intelligence/domainAdapters';
import {documentSchema,validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {wantedFile} from '../src/core/scan/scanner';

const blank=()=>documentSchema.parse({schemaVersion:1,id:'synthetic-native',title:'Synthetic native adapters',rootViewId:'root',nodes:[{id:'project',label:'Synthetic project'}],edges:[],views:[{id:'root',title:'Project',nodeIds:['project']} ]});
test('Databricks includes select authorized glob matches and preserve bundle/target scope',()=>{
 const result=analyzeDomainFiles([
  {path:'a/databricks.yml',text:'bundle:\n  name: Synthetic A\ninclude:\n  - resources/*.yml\n  - ../forbidden.yml\n  - missing/*.yml\ntargets:\n  dev:\n    mode: development\n    resources:\n      jobs:\n        load:\n          name: Development override\n'},
  {path:'a/resources/load.yml',text:'resources:\n  pipelines:\n    transform:\n      name: Synthetic transform\n  jobs:\n    load:\n      tasks:\n        - task_key: source\n        - task_key: transform\n          depends_on:\n            - task_key: source\n          pipeline_task:\n            pipeline_id: ${resources.pipelines.transform.id}\n'},
  {path:'b/databricks.yml',text:'bundle:\n  name: Synthetic B\nresources:\n  jobs:\n    load:\n      tasks:\n        - task_key: source\n'},
 ]);
 assert.equal(result.facts.filter(f=>f.key.includes(':jobs:load')).length,6);
 assert.ok(result.facts.some(f=>f.label==='Synthetic transform'));
 assert.equal(result.links.filter(l=>l.label==='explicit bundle resource reference').length,1);
 assert.equal(result.links.find(l=>l.label==='explicit bundle resource reference')?.line,13);
 assert.equal(result.links.find(l=>l.label==='declared depends_on')?.line,11,'dependency cites its reference, not the first task declaration');
 assert.ok(result.links.some(l=>l.label==='declared target override; not effective merge'));
 assert.ok(result.diagnostics.some(d=>d.includes('Unsafe or unsupported include')));
 assert.ok(result.diagnostics.some(d=>d.includes('Include has no selected match')));
 assert.ok(!result.links.some(l=>l.from.includes('a/databricks')&&l.to.includes('b/databricks')));
 assert.doesNotThrow(()=>validateDocument(extendWithDomainFacts(blank(),result)));
});
test('Databricks include cycles and omitted notebooks remain explicit gaps',()=>{
 const result=analyzeDomainFiles([{path:'databricks.yml',text:'include:\n  - databricks.yml\nresources:\n  jobs:\n    load:\n      tasks:\n        - task_key: source\n          notebook_task:\n            notebook_path: notebooks/missing.py\n'}]);
 assert.ok(result.diagnostics.some(d=>d.includes('Include cycle')));
 assert.ok(result.diagnostics.some(d=>d.includes('Notebook/library not selected')));
 assert.ok(result.facts.every(f=>f.domain==='databricks'));
});
test('nested Databricks include paths resolve relative to the declaring file, never an unrelated root filename',()=>{
 const result=analyzeDomainFiles([{path:'databricks.yml',text:'bundle:\n name: Synthetic nested\ninclude:\n - ./configs/group.yml\n'},
  {path:'configs/group.yml',text:'include:\n - ./jobs.yml\n - ../outside.yml\n'},
  {path:'configs/jobs.yml',text:'resources:\n jobs:\n  expected:\n   name: Correct declaring-file job\n'},
  {path:'jobs.yml',text:'resources:\n jobs:\n  wrong:\n   name: Wrong root job\n'},
  {path:'outside.yml',text:'resources:\n jobs:\n  unsafe:\n   name: Unsupported traversal job\n'}]);
 assert(result.facts.some(f=>f.key==='databricks:databricks.yml:base:jobs:expected'&&f.path==='configs/jobs.yml'&&f.line===3));
 assert(!result.facts.some(f=>f.label==='Wrong root job'||f.label==='Unsupported traversal job'));
 assert(result.diagnostics.some(d=>d.includes('configs/group.yml: Unsafe or unsupported include pattern refused')));
 assert.equal(result.links.find(l=>l.to.endsWith(':jobs:expected'))?.path,'configs/jobs.yml');
});
test('Fabric relationship endpoints attach to their own relationship and quoted columns',()=>{
 const result=analyzeDomainFiles([
  {path:'Synthetic.SemanticModel/.platform',text:'{"metadata":{"type":"SemanticModel","displayName":"Synthetic model"},"config":{"logicalId":"synthetic-item"}}'},
  {path:'Synthetic.SemanticModel/definition/tables/Sales.tmdl',text:"table 'Sales Orders'\n    column 'Customer ID'\n    column 'Date ID'\n    measure 'Revenue' = SUM('Sales Orders'[Amount])"},
  {path:'Synthetic.SemanticModel/definition/tables/Customer.tmdl',text:"table Customer\n    column ID"},
  {path:'Synthetic.SemanticModel/definition/tables/Date.tmdl',text:"table Date\n    column ID"},
  {path:'Synthetic.SemanticModel/definition/relationships.tmdl',text:"relationship 'Customer link'\n    fromColumn: 'Sales Orders'.'Customer ID'\n    toColumn: Customer.ID\n\nrelationship 'Date link'\n    fromColumn: 'Sales Orders'.'Date ID'\n    toColumn: Date.ID"},
  {path:'Synthetic.Report/definition.pbir',text:'{"version":"4.0","datasetReference":{"byPath":{"path":"../Synthetic.SemanticModel"}}}'},
 ]);
 const endpoints=result.links.filter(l=>/^TMDL (?:from|to)Column$/.test(l.label));
 assert.equal(endpoints.length,4);assert.equal(new Set(endpoints.map(l=>l.to)).size,2);
 assert.ok(endpoints.some(l=>l.from.endsWith(':column:Sales Orders/Date ID')&&l.to.endsWith(':relationship:Date link')));
 assert.ok(!endpoints.some(l=>l.from.endsWith(':column:Date/ID')&&l.to.endsWith(':relationship:Customer link')));
 assert.ok(result.links.some(l=>l.label==='PBIR declared datasetReference'));
 assert.equal(result.diagnostics.length,0);
 assert.doesNotThrow(()=>validateDocument(extendWithDomainFacts(blank(),result)));
});
test('Fabric missing columns and unrelated models never become approximate joins',()=>{
 const result=analyzeDomainFiles([
  {path:'A.SemanticModel/definition/a.tmdl',text:'table Sales\n  column ID\nrelationship r\n  fromColumn: Sales.Missing\n  toColumn: Customer.ID'},
  {path:'B.SemanticModel/definition/a.tmdl',text:'table Customer\n  column ID'},
 ]);assert.equal(result.links.filter(l=>l.label.startsWith('TMDL from')||l.label.startsWith('TMDL to')).length,0);
 assert.ok(result.diagnostics.some(d=>d.includes('TMDL column not selected')));
 assert.ok(result.diagnostics.some(d=>d.includes('Unresolved or ambiguous TMDL')));
});
test('ASP.NET and EF recognize literal declarations, excluding comments and quoted examples',()=>{
 const result=analyzeDomainFiles([{path:'Api/Controllers/OrdersController.cs',text:`// class Fake : ControllerBase {}
[Route("api/[controller]")]
public class OrdersController : ControllerBase {
 [HttpGet("{id}")]
 public object Get() => null;
 string example = "app.MapGet(\\\"/false\\\", x)";
}
public class StoreContext : DbContext {
 public DbSet<Order> Orders {get;set;}
 public DbSet<Customer> Customers {get;set;}
 void Configure() { modelBuilder.Entity<Order>().HasOne<Customer>(); }
}
app.MapGet("/health", () => "ok");
`}]);
 assert.ok(result.facts.some(f=>f.label==='GET api/Orders/{id}'));
 assert.ok(result.facts.some(f=>f.label==='GET /health'));
 assert.ok(!result.facts.some(f=>f.label.includes('/false')||f.label==='Fake'));
 assert.ok(result.links.some(l=>l.label==='EF literal HasOne declaration'));
 assert.doesNotThrow(()=>validateDocument(extendWithDomainFacts(blank(),result)));
});
test('ASP.NET attribute routes remain scoped to their own controller in a multi-controller source',()=>{
 const result=analyzeDomainFiles([{path:'Controllers.cs',text:'[Route("one")]\nclass OneController : ControllerBase { [HttpGet("item")] public object Get()=>null; }\n[Route("two")]\nclass TwoController : ControllerBase { [HttpPost("item")] public object Post()=>null; }'}]);
 assert.ok(result.facts.some(f=>f.label==='GET one/item'));assert.ok(result.facts.some(f=>f.label==='POST two/item'));assert.ok(!result.facts.some(f=>f.label==='POST one/item'));
});
test('EF DbSet declarations attach only inside their owning selected DbContext body',()=>{
 const result=analyzeDomainFiles([{path:'Contexts.cs',text:'class First : DbContext { public DbSet<Order> Orders {get;set;} }\nclass Ordinary { public DbSet<Ghost> Ghosts {get;set;} }\nclass Second : DbContext { public DbSet<Customer> Customers {get;set;} }'}]);
 const sets=result.links.filter(l=>l.label.startsWith('declares DbSet'));assert.equal(sets.length,2);assert(sets.some(l=>l.from.endsWith(':context:First')&&l.to.endsWith(':Order')));assert(sets.some(l=>l.from.endsWith(':context:Second')&&l.to.endsWith(':Customer')));assert(!sets.some(l=>l.to.endsWith(':Ghost')));
});
test('C# multiline raw-string examples cannot create routes or hide subsequent real mappings',()=>{
 const quote='"',source='var example = '+quote.repeat(3)+'\nA quote: '+quote+'\napp.MapGet("/quoted-example", () => 1);\nclass FakeContext : DbContext { public DbSet<Fake> Fakes {get;set;} }\n'+quote.repeat(3)+';\napp.MapGet("/real", () => 1);\n';
 const result=analyzeDomainFiles([{path:'Program.cs',text:source}]);assert.deepEqual(result.facts.map(f=>f.label),['GET /real']);assert.equal(result.facts[0].line,6);
 const interpolated=analyzeDomainFiles([{path:'Program.cs',text:'var example = $$'+quote.repeat(4)+'\nUnbalanced quote: "\napp.MapGet("/also-fake", () => 1);\n'+quote.repeat(4)+';\napp.MapGet("/actual", () => 1);'}]);assert.deepEqual(interpolated.facts.map(f=>f.label),['GET /actual']);
});
test('Azure Bicep symbolic dependencies, ARM exact dependencies and azd joins use selected sources',()=>{
 const result=analyzeDomainFiles([
 {path:'infra/main.bicep',text:"resource store 'Microsoft.Storage/storageAccounts@2023-05-01' = {\n name: 'synthetic'\n}\nresource api 'Microsoft.App/containerApps@2024-03-01' = {\n dependsOn: [store]\n properties: { storeId: store.id }\n}\nmodule extra './extra.bicep' = { name: 'extra' }\n// resource fake 'Microsoft.App/containerApps@2024-03-01' = {}"},
 {path:'infra/extra.bicep',text:"resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {}"},
 {path:'azuredeploy.json',text:JSON.stringify({$schema:'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',resources:[{type:'Microsoft.Web/serverfarms',name:'plan',apiVersion:'2024-04-01'},{type:'Microsoft.Web/sites',name:'app',apiVersion:'2024-04-01',dependsOn:["[resourceId('Microsoft.Web/serverfarms', 'plan')]","[variables('dynamic')]"]}]})},
 {path:'azure.yaml',text:'name: synthetic\nservices:\n  api:\n    project: ./Api\n    host: containerapp'},
 {path:'Api/Api.csproj',text:'<Project></Project>'},
 {path:'Fn/Trigger/function.json',text:'{"bindings":[{"type":"httpTrigger","direction":"in","name":"req"},{"type":"http","direction":"out","name":"res"}]}'},
 ]);
 for(const label of ['Bicep explicit dependsOn','Bicep symbolic resource reference','declares selected module resource','ARM exact dependsOn','azd explicit selected service project','Functions declared in binding'])assert.ok(result.links.some(l=>l.label===label),label);
 assert.ok(!result.facts.some(f=>f.label==='fake'));
 assert.ok(result.diagnostics.some(d=>d.includes('ARM dependsOn expression unresolved')));
 assert.doesNotThrow(()=>validateDocument(extendWithDomainFacts(blank(),result)));
});
test('Helm and Kustomize resolve only selected local packaging, not cluster state or remote dependencies',()=>{
 const result=analyzeDomainFiles([
  {path:'charts/app/Chart.yaml',text:'apiVersion: v2\nname: synthetic-app\nversion: 1.0.0\ndependencies:\n  - name: base\n    version: 1.0.0\n    repository: file://../base\n  - name: unavailable\n    version: 2.0.0\n    repository: https://example.invalid/charts'},
  {path:'charts/base/Chart.yaml',text:'apiVersion: v2\nname: synthetic-base\nversion: 1.0.0'},
  {path:'k8s/base/kustomization.yaml',text:'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n  - deployment.yaml'},
  {path:'k8s/base/deployment.yaml',text:'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: synthetic-api'},
  {path:'k8s/prod/kustomization.yaml',text:'resources:\n  - ../base\n  - https://example.invalid/manifests\npatches:\n  - path: patch.yaml'},
  {path:'k8s/prod/patch.yaml',text:'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: synthetic-api'},
 ]);
 for(const label of ['Helm local chart dependency 1.0.0','Kustomize selected resource','Kustomize selected package reference','Kustomize selected patch'])assert.ok(result.links.some(l=>l.label===label),label);
 assert.ok(result.diagnostics.some(d=>d.includes('remote dependency not fetched')));
 assert.ok(result.diagnostics.some(d=>d.includes('remote/unsafe reference refused')));
 const candidate=extendWithDomainFacts(blank(),result);assert.doesNotThrow(()=>validateDocument(candidate));
 assert.ok(!JSON.stringify(publicDocument(candidate)).includes('synthetic-api'));
});
test('azd literal selected root folder resolves only its unique root project and retains ambiguity',()=>{
 const config={path:'azure.yaml',text:'name: Synthetic root\nservices:\n api:\n  project: ./\n  host: appservice\n'},root={path:'Api.csproj',text:'<Project />'},nested={path:'nested/Other.csproj',text:'<Project />'};
 const selected=analyzeDomainFiles([config,root,nested]),join=selected.links.find(l=>l.label==='azd explicit selected service project');assert.equal(join?.from,'dotnet:project:Api.csproj');assert.equal(join?.path,'azure.yaml');assert.equal(join?.line,4);assert.equal(selected.diagnostics.length,0);
 const ambiguous=analyzeDomainFiles([config,root,{path:'Second.csproj',text:'<Project />'}]);assert(!ambiguous.links.some(l=>l.label==='azd explicit selected service project'));assert(ambiguous.diagnostics.some(d=>d.includes('no unique selected .NET project')));
 const nestedOnly=analyzeDomainFiles([config,nested]);assert(!nestedOnly.links.some(l=>l.label==='azd explicit selected service project'));
});
test('native direct callers reject unsafe paths and sensitive content before parsing',()=>{
 const result=analyzeDomainFiles([{path:'../main.bicep',text:"resource nope 'Microsoft.App/containerApps@2024-03-01' = {}"},{path:'secrets.json',text:'{"resources":[]}'},{path:'main.bicep',text:"resource valid 'Microsoft.App/containerApps@2024-03-01' = {}"}]);
 assert.equal(result.facts.length,1);assert.ok(result.diagnostics[0].includes('2 files omitted'));
 for(const path of ['Api/Program.cs','azuredeploy.json','Fn/function.json','infra/main.bicep','k8s/Kustomization'])assert.equal(wantedFile(path),true,path);
});
test('native direct analysis respects selected nested-repository and worktree boundaries',()=>{
 const source='{"name":"synthetic-hidden","version":"1.0.0"}',result=analyzeDomainFiles([{path:'nested/.git',text:'gitdir: ../.git/modules/nested'},{path:'nested/package.json',text:source},{path:'.worktrees/other/package.json',text:source},{path:'.claude/worktrees/other/package.json',text:source},{path:'root/package.json',text:'{"name":"synthetic-selected","version":"1.0.0"}'}]);
 assert.equal(result.contracts.length,1);assert.equal(result.contracts[0].identity,'synthetic-selected');assert(!JSON.stringify(result.facts).includes('synthetic-hidden'));
});
test('Azure multiline Bicep references and repeated ARM names cite their precise declaration paths',()=>{
 const result=analyzeDomainFiles([{path:'infra/main.bicep',text:"resource base 'Microsoft.Storage/storageAccounts@2024-01-01' = {}\nresource app\n 'Microsoft.App/containerApps@2024-03-01' =\n {\n  dependsOn: [\n    base\n  ]\n  properties: {\n    endpoint: base.id\n  }\n }"},
 {path:'azuredeploy.json',text:'{\n"$schema":"https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",\n"resources":[\n {"type":"Microsoft.App/containerApps", "name":"same"},\n {"type":"Microsoft.Storage/storageAccounts", "name":"same"}\n]\n}'}]);
 assert.equal(result.links.find(l=>l.label==='Bicep explicit dependsOn')?.line,6);assert.equal(result.links.find(l=>l.label==='Bicep symbolic resource reference')?.line,9);
 assert.deepEqual(result.facts.filter(f=>f.path==='azuredeploy.json').map(f=>f.line),[4,5]);
});
test('MSBuild and solution XML comments/CDATA cannot masquerade as source references or package producers',()=>{
 const result=analyzeDomainFiles([{path:'Api/Api.csproj',text:'<Project>\n<!-- <PackageReference Include="Synthetic.Hidden" Version="1.0.0" />\n<ProjectReference Include="../Hidden/Hidden.csproj" /> -->\n<![CDATA[<PackageReference Include="Synthetic.Hidden" Version="1.0.0" />]]>\n<PackageReference Include="Synthetic.Real" Version="1.0.0" />\n<ProjectReference Include="../Real/Real.csproj" />\n</Project>'},
  {path:'Hidden/Hidden.csproj',text:'<Project><!-- <PackageId>Synthetic.Hidden</PackageId><Version>1.0.0</Version><IsPackable>true</IsPackable> --></Project>'},
  {path:'Real/Real.csproj',text:'<Project><PackageId>Synthetic.Real</PackageId><Version>1.0.0</Version><IsPackable>true</IsPackable></Project>'},
  {path:'Synthetic.slnx',text:'<Solution>\n<!-- <Project Path="Hidden/Hidden.csproj" /> -->\n<Project Path="Real/Real.csproj" />\n</Solution>'}]);
 assert(!result.contracts.some(c=>c.identity==='Synthetic.Hidden'));assert.equal(result.contracts.filter(c=>c.identity==='Synthetic.Real').length,2);
 assert.equal(result.links.filter(l=>l.label==='ProjectReference').length,1);assert.equal(result.links.find(l=>l.label==='ProjectReference')?.line,6);
 assert.equal(result.links.filter(l=>l.label==='solution member').length,1);assert.equal(result.links.find(l=>l.label==='solution member')?.line,3);
 assert.equal(result.contracts.find(c=>c.role==='consumer')?.line,5);
});
test('Container Apps config maps only declared app/container names, never environment values or provisioning claims',()=>{
 const result=analyzeDomainFiles([{path:'infra/containerapp.yaml',text:'name: synthetic-app\nproperties:\n  provisioningState: Succeeded\n  template:\n    containers:\n      - name: api\n        image: synthetic.invalid/image:v1\n        env:\n          - name: LABEL\n            value: SHOULD_NOT_COPY\n    initContainers:\n      - name: initializer\n        command: [NEVER_EXECUTE]\n'},{path:'bad/containerapp.json',text:'{"name":"not-enough-to-classify"}'}]);
 assert.deepEqual(result.facts.map(f=>f.label),['synthetic-app','api','initializer']);assert.equal(result.links.length,2);assert.equal(result.facts.find(f=>f.label==='api')?.line,6);assert.equal(result.facts.find(f=>f.label==='initializer')?.line,12);
 for(const value of ['SHOULD_NOT_COPY','NEVER_EXECUTE','Succeeded','synthetic.invalid/image'])assert(!JSON.stringify(result.facts).includes(value));assert(result.diagnostics.some(d=>d.includes('Unsupported Container Apps config shape')));
});
