import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ProjectDock} from '../../../src/ui/ProjectDock';
import {documentSchema,validateDocument} from '../../../src/core/model';
import {publicDocument} from '../../../src/core/operations';
const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'git-browser',title:'Private checkout fixture',rootViewId:'overview',nodes:[],edges:[],views:[{id:'overview',title:'Overview'}],atlas:{activeSnapshotId:'snapshot',snapshots:[{id:'snapshot',capturedAt:'2026-11-04T00:00:00Z',repositories:[{id:'source',title:'Supplied source',host:'local',locator:'browser-fixture',scanStatus:'not-scanned',authority:'author',visibility:'private'}]}]}}));
const saved=JSON.stringify(doc);
function Fixture(){const [audience,setAudience]=useState<'author'|'public'>('author'),[other,setOther]=useState(false);const project=other?{...doc,id:'other-project',title:'Other project'}:doc;return <><button onClick={()=>setAudience(a=>a==='author'?'public':'author')}>Toggle audience</button><button onClick={()=>setOther(v=>!v)}>Switch project</button><output aria-label="Current audience">{audience}</output><output aria-label="Project unchanged">{JSON.stringify(doc)===saved?'unchanged':'mutated'}</output><output hidden aria-label="Public export">{JSON.stringify(publicDocument(doc))}</output><ProjectDock project={project} audience={audience} activeViewId="overview" onNavigate={()=>{}} onStory={()=>{}} localCheckoutHost/></>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
