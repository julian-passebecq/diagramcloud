import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isValidElement,type ReactNode} from 'react';
import {LocalSaveNotice,attemptLocalBackup,LOCAL_BACKUP_FAILED} from '../src/ui/LocalSaveNotice';
import {validateDocument} from '../src/core/model';
const doc=(id:string,title:string)=>validateDocument({schemaVersion:1,id,title,rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Overview',nodeIds:[],edgeIds:[],positions:{}}],blocks:[],sources:[],assets:[],observations:[],story:[]});
function nodes(value:ReactNode):{type:unknown;props:Record<string,unknown>}[]{
 if(Array.isArray(value))return value.flatMap(nodes);if(!isValidElement(value))return [];
 const el=value as {type:unknown;props:Record<string,unknown>};return [el,...nodes(el.props.children as ReactNode)];
}
const base=()=>({error:'PRIVATE_RAW_ERROR',publicMode:false,project:doc('b','Current'),library:[doc('a','PRIVATE_DRAFT'),doc('b','Current')],unsavedProjectIds:['a'],onCurrentBackup:()=>{},onBackup:()=>{}});
test('no error produces no recovery banner',()=>{assert.equal(LocalSaveNotice({...base(),error:''}),null);});
test('public audience has no private error, title, IDs or full-backup actions',()=>{
 const el=LocalSaveNotice({...base(),publicMode:true}),text=JSON.stringify(el);
 assert.ok(!text.includes('PRIVATE'));assert.equal(nodes(el).filter(n=>n.type==='button').length,0);
});
test('other unsaved draft backup targets its exact in-memory project, not current project',()=>{
 const props=base();const seen:unknown[]=[];
 const el=LocalSaveNotice({...props,onBackup:d=>{seen.push(d);}}),buttons=nodes(el).filter(n=>n.type==='button');
 assert.equal(buttons.length,2);(buttons[1].props.onClick as ()=>void)();assert.equal(seen[0],props.library[0]);
});
test('current backup retains the existing explicit full-backup callback',()=>{
 let calls=0;const el=LocalSaveNotice({...base(),onCurrentBackup:()=>{calls++;}});
 (nodes(el).find(n=>n.type==='button')!.props.onClick as ()=>void)();assert.equal(calls,1);
});
test('duplicate and absent identities do not invent or duplicate backup targets',()=>{
 const el=LocalSaveNotice({...base(),unsavedProjectIds:['a','a','b','missing']});assert.equal(nodes(el).filter(n=>n.type==='button').length,2);
});
test('reading recovery notice changes no document, performs no save and downloads nothing',()=>{
 const props=base(),before=JSON.stringify(props);let calls=0;LocalSaveNotice({...props,onBackup:()=>{calls++;},onCurrentBackup:()=>{calls++;}});assert.equal(calls,0);assert.equal(JSON.stringify(props),before);
});


test('a refused other-draft backup reports a generic recoverable failure',async()=>{
 const seen:string[]=[];const props=base();const before=JSON.stringify(props.library);
 const el=LocalSaveNotice({...props,onBackup:()=>{throw Error('PRIVATE_BACKUP_ERROR');},onBackupError:message=>seen.push(message)});
 (nodes(el).filter(n=>n.type==='button')[1].props.onClick as ()=>void)();
 await new Promise(r=>setImmediate(r));assert.deepEqual(seen,[LOCAL_BACKUP_FAILED]);assert.ok(!seen[0].includes('PRIVATE_'));assert.equal(JSON.stringify(props.library),before);
});
test('an asynchronous backup refusal is handled without an unhandled rejection',async()=>{
 const messages:string[]=[];await attemptLocalBackup(async()=>{throw Error('private path');},message=>messages.push(message));assert.deepEqual(messages,[LOCAL_BACKUP_FAILED]);
});
test('starting a backup is not a save acknowledgement or success claim',async()=>{
 let started=0;const messages:string[]=[];await attemptLocalBackup(()=>{started++;},message=>messages.push(message));assert.equal(started,1);assert.deepEqual(messages,[]);
});

test('App wires generic backup failures and scopes quarantine acknowledgement by repaired project',async()=>{
 const {readFileSync}=await import('node:fs');const app=readFileSync('src/App.tsx','utf8');
 assert.match(app,/onBackupError=\{setMessage\}/);assert.match(app,/!saveQueue\.unsaved\(next\.id\)\)setQuarantine/);
});
