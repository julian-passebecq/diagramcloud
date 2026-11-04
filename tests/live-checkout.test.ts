import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProjectDock} from '../src/ui/ProjectDock';
import {documentSchema} from '../src/core/model';
import {checkoutCapability,inspectCheckout} from '../src/ui/liveCheckoutClient';
const identity={repositoryId:'source',host:'local',locator:'fixture'};
test('public dock never mounts checkout controls regardless of host grant',()=>{
 const project=documentSchema.parse({schemaVersion:1,id:'private-project',title:'Example',rootViewId:'overview',nodes:[],edges:[],views:[{id:'overview',title:'Overview'}]});
 const html=renderToStaticMarkup(React.createElement(ProjectDock,{project,audience:'public',activeViewId:'overview',onNavigate(){},onStory(){},localCheckoutHost:true}));
 assert(!html.includes('Private local checkout'));assert(!html.includes('Check local checkout capability'));
 const author=renderToStaticMarkup(React.createElement(ProjectDock,{project,audience:'author',activeViewId:'overview',onNavigate(){},onStory(){},localCheckoutHost:false}));assert(!author.includes('Private local checkout'));
});
test('client requests strict identity only and refuses foreign binding, malformed host response and output overflow',async()=>{
 const prior=globalThis.fetch;const calls:{url:string;body:unknown}[]=[];
 const data={schema:'diagramcloud.local-git/1',projectId:'project',...identity,head:null,branch:'main',headState:'unborn',staged:[],unstaged:[],untracked:[],conflicts:[],dirty:false,startedAt:'2026-11-04T00:00:00Z',capturedAt:'2026-11-04T00:00:00Z',scope:'local'};
 let reply:unknown=data,status=200;
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),body:JSON.parse(String(options?.body))});assert.equal(options?.method,'POST');assert.equal(options?.credentials,'same-origin');return new Response(typeof reply==='string'?reply:JSON.stringify(reply),{status});};
 try{
  await inspectCheckout('project',identity,new AbortController().signal);assert.deepEqual(calls[0].body,{projectId:'project',audience:'author',repository:identity});
  reply={...data,projectId:'other'};await assert.rejects(inspectCheckout('project',identity,new AbortController().signal),/different repository binding/);
  reply={...data,root:'/private-path'};await assert.rejects(inspectCheckout('project',identity,new AbortController().signal));
  reply='x'.repeat(512*1024+1);await assert.rejects(inspectCheckout('project',identity,new AbortController().signal),/budget/);
  status=404;reply={};await assert.rejects(checkoutCapability('project',[identity],new AbortController().signal),/unavailable on this host/);
 }finally{globalThis.fetch=prior;}
});
