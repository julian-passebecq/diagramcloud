import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDomainFiles} from '../src/intelligence/domainAdapters';
import {buildSourceAnalysisBundle} from '../src/intelligence/sourceBundle';
import {buildDocumentAnalysisBundle} from '../src/intelligence/documentBundle';
import {analysisProfile,validateAnalysisBundle} from '../src/intelligence/profile';
import {actionForGapCause} from '../src/intelligence/gapDetails';
import type {ScanFile} from '../src/core/scan/scanner';

const identity={repositoryId:'synthetic',revision:'a'.repeat(40)};
const file=(path:string,data:unknown):ScanFile=>({path,text:JSON.stringify(data,null,2)});
const dbt=(extra:Record<string,unknown>={})=>({metadata:{dbt_schema_version:'https://schemas.getdbt.com/dbt/manifest/v12.json'},nodes:{
 'model.synthetic.a':{name:'a',depends_on:{nodes:['model.synthetic.b']}},'model.synthetic.b':{name:'b',depends_on:{nodes:[]}},
},...extra});
const arm=(dependsOn:string[])=>file('infra/template.json',{$schema:'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',resources:[
 {name:'same',type:'Microsoft.Example/first',apiVersion:'2026-01-01'},
 {name:'same',type:'Microsoft.Example/second',apiVersion:'2026-01-01'},
 {name:'consumer',type:'Microsoft.Example/app',apiVersion:'2026-01-01',dependsOn},
]});

test('explicit unsupported native versions and shapes retain selected source and specialist advice',()=>{
 const selected=[file('data/manifest.json',dbt({metadata:{dbt_schema_version:'https://schemas.getdbt.com/dbt/manifest/v99.json'}})),
  file('report/definition.pbir',{version:'99.0'}),file('api/openapi.json',{openapi:'9.0.0',info:{title:'Synthetic'},paths:{}}),
  file('cloud/containerapp.json',{containers:[]}),{path:'chart/Chart.yaml',text:'apiVersion: v99\nname: synthetic\nversion: 0.1.0'}];
 const before=structuredClone(selected),report=analyzeDomainFiles(selected);
 assert.deepEqual(selected,before);assert.equal(report.facts.length,0);assert.equal(report.links.length,0);
 assert.equal(report.diagnosticDetails?.length,5);
 for(const detail of report.diagnosticDetails!){assert.equal(detail.cause,'unsupported-analyzer');assert.equal(detail.code,'unsupported');assert.deepEqual(detail.action,actionForGapCause('unsupported-analyzer'));assert.ok(selected.some(f=>f.path===detail.path));assert.ok(detail.line&&detail.line>0);assert.ok(report.diagnostics.some(text=>text.includes(detail.message)));}
});

test('dbt contradictory structured parents are conflicting evidence without choosing a relationship',()=>{
 const selected=file('data/manifest.json',dbt({parent_map:{'model.synthetic.a':[]}})),report=analyzeDomainFiles([selected],{domains:['dbt']});
 assert.deepEqual(report.facts.map(f=>f.key).sort(),['dbt:model.synthetic.a','dbt:model.synthetic.b']);assert.equal(report.links.length,0);
 const detail=report.diagnosticDetails?.find(d=>d.cause==='conflicting-evidence');assert.ok(detail);assert.equal(detail.path,selected.path);assert.equal(detail.action?.kind,'review-evidence');assert.match(detail.message,/parent_map contradicts depends_on/);assert.ok(selected.text.split('\n')[detail.line!-1].includes('model.synthetic.a'));
});

test('only recognized ARM parameter/variable expressions get dynamic advice; ambiguous literals remain unclassified',()=>{
 const selected=arm(["[parameters('resourceName')]","[variables('resourceId')]","[resourceId('Microsoft.Example/first', parameters('name'))]",'same',"literal(parameters('x'))","[resourceId('Microsoft.Example/first', 'parameters(''not-a-call'')')]","[[parameters('escaped')]]"]);
 const report=analyzeDomainFiles([selected],{domains:['azure']}),details=report.diagnosticDetails??[];
 assert.equal(report.facts.length,3);assert.equal(report.links.length,0);assert.equal(details.length,3);assert.ok(details.every(d=>d.cause==='dynamic-unresolved'&&d.action?.kind==='verify-runtime'&&d.path===selected.path));
 assert.equal(report.diagnostics.filter(d=>d.endsWith('expression unresolved or ambiguous; not evaluated.')).length,4);
 const literalOnly=analyzeDomainFiles([arm(['same',"parameters('x')"])],{domains:['azure']});assert.equal(literalOnly.diagnosticDetails,undefined);
});

test('unsupported-looking legacy messages are not parsed into a cause',()=>{
 const report=analyzeDomainFiles([{path:'databricks.yml',text:'bundle:\n  name: synthetic\ninclude:\n  - ../outside.yml'}],{domains:['databricks']});
 assert.ok(report.diagnostics.some(d=>d.includes('Unsafe or unsupported include pattern')));assert.equal(report.diagnosticDetails,undefined);
});

test('document and native advice survives configured bundle merging without changing source identity or facts',async()=>{
 const selected=[{path:'README.md',text:'# Synthetic\n[Details](details.md#section)\n[Missing](missing.md)'},{path:'details.md',text:'# Section'},file('data/manifest.json',dbt({parent_map:{'model.synthetic.a':[]}})),arm(["[parameters('name')]"])];
 const profile=analysisProfile('standard',{analyzers:['documents','dbt','azure']}),before=structuredClone(selected),bundle=await buildSourceAnalysisBundle(selected,identity,profile),again=await buildSourceAnalysisBundle([...selected].reverse(),identity,profile);
 assert.deepEqual(bundle,again);assert.deepEqual(selected,before);assert.ok(bundle.parserVersion.includes(';gaps1'));
 for(const cause of ['unsupported-analyzer','conflicting-evidence','dynamic-unresolved'])assert.ok(bundle.diagnosticDetails?.some(d=>d.cause===cause));
 assert.ok(bundle.diagnosticDetails?.some(d=>d.path==='README.md'&&d.code==='unresolved'&&d.cause===undefined&&d.action?.kind==='select-source'));
 assert.ok(bundle.sources.every(s=>s.repositoryId===identity.repositoryId&&s.revision===identity.revision));assert.ok(bundle.items.every(i=>i.sourceIds.length));assert.ok(bundle.links.every(l=>l.sourceIds.length));assert.ok(!('observations' in bundle));assert.doesNotThrow(()=>validateAnalysisBundle(bundle));
 const docs=await buildDocumentAnalysisBundle(selected,identity,profile);assert.ok(docs.diagnosticDetails?.some(d=>d.cause==='unsupported-analyzer'));assert.ok(docs.diagnostics.length>0);
});

test('analysis detail schema is additive, bounded, path safe, credential free and inert',async()=>{
 const bundle=await buildSourceAnalysisBundle([{path:'README.md',text:'# Synthetic'}],identity,analysisProfile('quick',{analyzers:['documents']}));
 const legacy=structuredClone(bundle);delete legacy.diagnosticDetails;legacy.diagnostics=['Unsupported-looking old message, cause unknown'];assert.equal(validateAnalysisBundle(legacy).diagnosticDetails,undefined);
 const detail={path:'README.md',line:1,code:'unsupported' as const,message:'Unsupported selected declaration.',cause:'unsupported-analyzer' as const,action:actionForGapCause('unsupported-analyzer')};
 assert.deepEqual(validateAnalysisBundle({...bundle,diagnosticDetails:[detail]}).diagnosticDetails,[detail]);
 for(const path of ['../private.md','C:/private.md','/private.md','folder\\private.md','.env','config/secrets.json','.git/config','node_modules/pkg/a.ts','bad\npath'])assert.throws(()=>validateAnalysisBundle({...bundle,diagnosticDetails:[{...detail,path}]}));
 for(const bad of [{...detail,message:'password=PRIVATE_SENTINEL'},{...detail,action:{...detail.action,label:'api_key=PRIVATE_SENTINEL'}},{...detail,action:{...detail.action,command:'execute'}},{...detail,action:actionForGapCause('dynamic-unresolved')},{...detail,line:0},{...detail,path:'x'.repeat(501)}])assert.throws(()=>validateAnalysisBundle({...bundle,diagnosticDetails:[bad]}));
 assert.throws(()=>validateAnalysisBundle({...bundle,diagnosticDetails:Array.from({length:2001},()=>detail)}));
});
