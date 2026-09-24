import test from 'node:test';
import assert from 'node:assert/strict';
import {examplePack} from '../src/experience/sample';
import {validatePack} from '../src/experience/model';
import type {ModelItem} from '../src/experience/semantic';
import {addColumn,addMeasure,addRelationship,addTable,columnRefs,removeColumn,removeMeasure,removeRelationship,removeTable,renameColumn,renameTable,setColumn,setRelationship,setTableKind,type ModelEdit} from '../src/experience/modelEdit';

const base=()=>examplePack().items.find(i=>i.id==='sm-model') as ModelItem;
/** Every edit must leave a pack that still validates. */
const valid=(e:ModelEdit)=>{const p=examplePack();p.items[p.items.findIndex(i=>i.id==='sm-model')]=e.item;assert.doesNotThrow(()=>validatePack(p),e.label);return e;};

test('renaming a table rewrites every relationship and measure that points at it',()=>{
 const e=valid(renameTable(base(),'DimRegion','DimGeography'));
 assert.equal(e.label,'Renamed table DimRegion → DimGeography');
 assert(e.item.tables.some(t=>t.name==='DimGeography')&&!e.item.tables.some(t=>t.name==='DimRegion'));
 assert(e.item.relationships.some(r=>r.to==='DimGeography.RegionKey'));
 assert(!JSON.stringify(e.item.relationships).includes('DimRegion'));
 const f=valid(renameTable(base(),'Fact_Energy','FactEnergy'));
 assert(f.item.measures.filter(x=>x.table==='FactEnergy').length===4);
 assert.equal(renameTable(base(),'DimDate','DimDate').label,'','no-op rename records nothing');
});

test('renaming a column rewrites only that column reference',()=>{
 const e=valid(renameColumn(base(),'DimDate','DateKey','DateId'));
 assert.equal(e.item.relationships.filter(r=>r.to==='DimDate.DateId').length,3);
 assert(e.item.relationships.some(r=>r.from==='Fact_Energy.DateKey'),'the fact side keeps its own column name');
});

test('removing a table or column also removes the relationships that used it, and says so',()=>{
 const t=valid(removeTable(base(),'DimScenario'));
 assert.equal(t.label,'Removed table DimScenario and 2 relationships');
 assert(!t.item.relationships.some(r=>r.to.startsWith('DimScenario.')));
 const c=valid(removeColumn(base(),'FactCapex','CurrencyKey'));
 assert.equal(c.label,'Removed column FactCapex.CurrencyKey and 1 relationship');
 const m=valid(removeTable(base(),'FactCapex'));
 assert(m.item.measures.some(x=>x.name==='Capex (USD)'&&x.table===undefined),'the measure stays, without its home table');
});

test('adding tables, columns, relationships and measures',()=>{
 let e=valid(addTable(base(),'DimGeography','dimension'));
 assert.deepEqual(e.item.tables.at(-1),{name:'DimGeography',kind:'dimension',columns:[{name:'GeographyKey',type:'int',key:'pk'}]});
 e=valid(addColumn(e.item,'FactProduction','GeographyKey','int','fk'));
 e=valid(addRelationship(e.item,'FactProduction.GeographyKey','DimGeography.GeographyKey','*:1'));
 assert.equal(e.label,'Related FactProduction.GeographyKey → DimGeography.GeographyKey');assert.equal(e.item.relationships.at(-1)!.active,true);
 e=valid(addMeasure(e.item,'Production per region','FactProduction'));
 assert(columnRefs(e.item).includes('DimGeography.GeographyKey'));
 // A second path between two tables that are already related starts inactive.
 const second=valid(addRelationship(addColumn(base(),'Fact_Energy','ShipDateKey','int','fk').item,'Fact_Energy.ShipDateKey','DimDate.DateKey','*:1'));
 assert.equal(second.item.relationships.at(-1)!.active,false);assert.match(second.label,/\(inactive\)/);
});

test('invalid edits are refused with a readable reason and change nothing',()=>{
 const m=base(),before=JSON.stringify(m);
 assert.throws(()=>addTable(m,'DimDate','dimension'),/already a table called DimDate/);
 assert.throws(()=>addTable(m,'dbo.Sales','fact'),/cannot contain a dot/);
 assert.throws(()=>addTable(m,'   ','fact'),/needs a name/);
 assert.throws(()=>renameTable(m,'DimDate','DimProduct'),/already a table called DimProduct/);
 assert.throws(()=>addColumn(m,'DimDate','Year','int',undefined),/already has a column called Year/);
 assert.throws(()=>renameColumn(m,'DimDate','DateKey','Date'),/already has a column called Date/);
 assert.throws(()=>addRelationship(m,'Fact_Energy.DateKey','DimDate.DateKey','*:1'),/already related/);
 assert.throws(()=>addRelationship(m,'DimDate.Year','DimDate.DateKey','*:1'),/two different tables/);
 assert.throws(()=>addRelationship(m,'Fact_Energy.Nope','DimDate.DateKey','*:1'),/existing column/);
 assert.throws(()=>addMeasure(m,'Total Revenue'),/already a measure/);
 assert.throws(()=>addMeasure(m,'X','Ghost'),/no longer exists/);
 assert.throws(()=>removeTable({...m,tables:[m.tables[0]],relationships:[]},m.tables[0].name),/at least one table/);
 assert.equal(JSON.stringify(m),before,'the original item is never mutated');
});

test('kind, key, cardinality, active flag and removals round-trip through validation',()=>{
 let e=valid(setTableKind(base(),'DimProject','bridge'));
 e=valid(setColumn(e.item,'DimDate','Year',{key:'pk',type:'smallint'}));
 assert.deepEqual(e.item.tables.find(t=>t.name==='DimDate')!.columns.find(c=>c.name==='Year'),{name:'Year',type:'smallint',key:'pk'});
 e=valid(setColumn(e.item,'DimDate','Year',{key:null}));
 assert.equal(e.item.tables.find(t=>t.name==='DimDate')!.columns.find(c=>c.name==='Year')!.key,undefined);
 e=valid(setRelationship(e.item,0,{cardinality:'1:1',active:false}));
 assert.deepEqual([e.item.relationships[0].cardinality,e.item.relationships[0].active],['1:1',false]);
 e=valid(removeRelationship(e.item,0));assert.equal(e.item.relationships.length,9);
 e=valid(removeMeasure(e.item,'Margin %'));assert(!e.item.measures.some(x=>x.name==='Margin %'));
});
