import test from 'node:test';import assert from 'node:assert/strict';
import {portfolioHtml} from '../src/export/html';
import {teachingCases,teachingProject} from '../examples/pro-expressiveness/cases';
const project=()=>teachingProject(teachingCases()[0]);
test('focus export is opt-in and keeps the same native public document and renderer',()=>{
 const p=project(),classic=portfolioHtml(p),focused=portfolioHtml(p,undefined,{focusStory:true});
 assert.ok(!classic.includes('id="return-step"'));assert.ok(focused.includes('id="return-step"'));assert.ok(focused.includes('id="context"'));
 for(const html of [classic,focused]){assert.ok(html.includes('No live telemetry'));assert.ok(html.includes('const diagrams='));}
});
test('default export carries no focus-only fragment (existing calls keep their exact bytes)',()=>{
 const p=project(),classic=portfolioHtml(p);
 assert.equal(classic,portfolioHtml(p,undefined,{}));assert.equal(classic,portfolioHtml(p,undefined,{focusStory:false}));
 for(const marker of ['focus-story','focusCurrent','lastStep','blockRank','figure-region','focusContext','Source cut and contribution'])assert.ok(!classic.includes(marker),marker);
});
test('focus export puts the current architecture before its companion explanation in DOM order',()=>{
 const html=portfolioHtml(project(),undefined,{focusStory:true});assert.ok(html.indexOf('id="views"')<html.indexOf('id="details"'));
});
test('focus export retains privacy, code escaping and no-network boundaries',()=>{
 const p=project(),before=JSON.stringify(p);p.privateNotes='PRIVATE_SENTINEL_NEVER_PUBLISH';p.nodes.push({...p.nodes[0],id:'secret-node',visibility:'private',label:'SECRET_LABEL'});
 const html=portfolioHtml(p,undefined,{focusStory:true});assert.ok(!html.includes('PRIVATE_SENTINEL'));assert.ok(!html.includes('SECRET_LABEL'));assert.ok(html.includes("connect-src 'none'"));
 assert.equal(p.nodes.length,JSON.parse(before).nodes.length+1);
});
test('focused narrative can detour and explicitly return without an automatic progression timer',()=>{
 const html=portfolioHtml(project(),undefined,{focusStory:true});assert.ok(html.includes('go(lastStep)'));assert.ok(!html.includes('setInterval'));assert.ok(html.includes('focusCurrent=!focusCurrent'));
});
test('source node and evidence are not rewritten by an export option',()=>{const p=project(),old=JSON.stringify(p);portfolioHtml(p,undefined,{focusStory:true});assert.equal(JSON.stringify(p),old);});
