
import test from 'node:test';import assert from 'node:assert/strict';
import {buildFullStackPractice} from '../examples/interview-client/build';
import {validateDocument} from '../src/core/model';
import {publicDocument} from '../src/core/operations';
import {prepareLinkedReading} from '../src/core/linkedReading';
import {prepareReadingWayfinder} from '../src/core/readingWayfinder';
test('full-stack reference is an ordinary validated Project, no observations',()=>{const {project}=buildFullStackPractice();assert.equal(validateDocument(project).id,project.id);assert.equal(project.observations.length,0);assert.equal(project.views.length,5);});
test('all paired reference perspectives are available without a provider',()=>{const {project,reading}=buildFullStackPractice();assert.equal(prepareLinkedReading(project,reading).chapters.length,4);assert.equal(project.assets.length,0);});
test('request keeps its parent, data has explicit alternative entry routes',()=>{const {project}=buildFullStackPractice();assert.ok(prepareReadingWayfinder(project,'public',['overview','architecture','request'],'request').available);const tree=prepareReadingWayfinder(project,'public',['overview'],'overview').tree;assert.equal(tree.filter(x=>x.pick.viewId==='data').length,2);});
test('reference stays synthetic and does not invent client private data or measured outcome',()=>{const {project}=buildFullStackPractice();assert.equal(publicDocument(project).nodes.length,project.nodes.length);assert.ok(project.blocks.every(b=>b.provenance==='synthetic'));assert.ok(!JSON.stringify(project).includes('foil-wind-dev'));});
