import React,{useCallback,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReactFlow,ReactFlowProvider,MarkerType,applyNodeChanges,type NodeChange,type Node} from '@xyflow/react';
import {DiagramCloudViewer,type ViewerSelection,type ViewerSelectionIntent,type ViewerSourceIntent} from '../../../src/react';
import {documentSchema,validateDocument,type Project} from '../../../src/core/model';

// Synthetic only: no observations/review decisions, client identifiers or tokens.
function fixture(id:string,prefix:string):Project{return validateDocument(documentSchema.parse({schemaVersion:1,id,revision:7,title:'UNRELATED_GLOBAL_TITLE',summary:'UNRELATED_GLOBAL_SUMMARY',rootViewId:'home',nodes:[
 {id:'a',label:prefix+' input',kind:'app',icon:'azure-functions',childViewId:'child',sourceIds:['selected-source'],blockIds:['note'],basis:'planned'},
 {id:'b',label:prefix+' output',childViewId:'hidden',summary:'PRIVATE_CAPTION_SENTINEL',sourceIds:['private-source']},
 {id:'code',label:prefix+' child implementation'},{id:'outside-node',label:'UNGRANTED_PUBLIC_NODE',sourceIds:['outside-source']},{id:'private-node',label:'PRIVATE_NODE_SENTINEL',visibility:'private'},{id:'root-entry',label:'UNGRANTED_ROOT_PARENT',childViewId:'root'},{id:'outside-entry',label:'UNGRANTED_OUTSIDE_PARENT',childViewId:'outside'}],
 edges:[{id:'flow',source:'a',target:'b',basis:'planned'},{id:'ungranted-edge',source:'a',target:'b',label:'UNGRANTED_EDGE'}],views:[
 {id:'root',title:prefix+' root architecture',nodeIds:['a','b','private-node'],edgeIds:['flow'],positions:{a:{x:0,y:0},b:{x:300,y:0},'private-node':{x:600,y:0}}},
 {id:'child',title:prefix+' child architecture',nodeIds:['code'],positions:{code:{x:0,y:0}}},
 {id:'outside',title:'UNGRANTED_VIEW_TITLE',nodeIds:['outside-node','a','b'],edgeIds:['ungranted-edge']},{id:'home',title:'UNGRANTED_HOME_TITLE',nodeIds:['root-entry','outside-entry']},{id:'hidden',title:'UNGRANTED_HIDDEN_CHILD',nodeIds:['outside-node']}],
 sources:[{id:'selected-source',title:prefix+' selected synthetic citation',location:'Synthetic selected locator',url:'https://example.invalid/synthetic-selected'},{id:'private-source',title:'PRIVATE_SOURCE_SENTINEL',location:'PRIVATE_SOURCE_LOCATOR',visibility:'private'},{id:'outside-source',title:'UNGRANTED_SOURCE_SENTINEL'}],
 blocks:[{id:'note',title:'Synthetic selected explanation',type:'text',text:prefix+' illustrative context, not execution.',sourceIds:['selected-source'],provenance:'synthetic'},{id:'analysis-context-0',title:'PRIVATE_RECEIPT_SENTINEL',type:'code',language:'json',code:'PRIVATE_RECEIPT_BYTES',visibility:'private'}]}));}
function Host(){
 const [a,setA]=useState(()=>fixture('synthetic-viewer-a','A')),[b]=useState(()=>fixture('synthetic-viewer-b','B'));
 const [selectedA,setSelectedA]=useState<ViewerSelection>({projectId:a.id,baseRevision:7,viewId:'root',nodeId:'a'}),[selectedB,setSelectedB]=useState<ViewerSelection>({projectId:b.id,baseRevision:7,viewId:'root',nodeId:'a'});
 const [accept,setAccept]=useState(true),[capabilities,setCapabilities]=useState(true),[mounted,setMounted]=useState(true),[key,setKey]=useState(0),[narrow,setNarrow]=useState(false),[logs,setLogs]=useState<unknown[]>([]);
 const [formSubmits,setFormSubmits]=useState(0);
 const scopesA=useMemo(()=>narrow?['root']:['root','child'],[narrow]),scopeB=useMemo(()=>['root'],[]);
 const [hostNodes,setHostNodes]=useState<Node[]>([{id:'a',position:{x:0,y:0},data:{label:'Host A'},selected:true},{id:'b',position:{x:160,y:0},data:{label:'Host B'}}]);
 const hostEdges=useMemo(()=>[{id:'flow',source:'a',target:'b',markerEnd:{type:MarkerType.ArrowClosed}}],[]);
 const selectA=useCallback((intent:ViewerSelectionIntent)=>{setLogs(old=>[...old,{viewer:'A',kind:'selection',intent}]);if(accept)setSelectedA(intent);},[accept]);
 const navigateA=useCallback((intent:ViewerSelectionIntent)=>{setLogs(old=>[...old,{viewer:'A',kind:'navigate',intent}]);if(accept)setSelectedA(intent);},[accept]);
 const sourceA=useCallback((intent:ViewerSourceIntent)=>{setLogs(old=>[...old,{viewer:'A',kind:'source',intent}]);},[]);
 const selectB=useCallback((intent:ViewerSelectionIntent)=>{setLogs(old=>[...old,{viewer:'B',kind:'selection',intent}]);setSelectedB(intent);},[]);
 const before=useMemo(()=>JSON.stringify({a,b}),[]);
 return <><nav aria-label="Synthetic host controls"><button onClick={()=>setAccept(old=>!old)}>{accept?'Reject selection intents':'Accept selection intents'}</button><button onClick={()=>setCapabilities(old=>!old)}>{capabilities?'Withdraw callbacks':'Restore callbacks'}</button><button onClick={()=>{setNarrow(true);setSelectedA({projectId:a.id,baseRevision:a.revision,viewId:'root',nodeId:'a'});}}>Narrow A scope</button><button onClick={()=>setA(old=>structuredClone(old))}>Replace A with same revision clone</button><button onClick={()=>{setA(old=>({...old,revision:old.revision+1}));setSelectedA(old=>({...old,baseRevision:old.baseRevision+1}));}}>Advance A revision</button><button onClick={()=>setMounted(old=>!old)}>{mounted?'Unmount A':'Mount A'}</button><button onClick={()=>setKey(old=>old+1)}>Remount A</button><button onClick={()=>setSelectedA(old=>({...old,viewId:'outside'}))}>Invalid A selection</button></nav>
 <div className="fixture-host-flow" aria-label="Actual host React Flow"><ReactFlow id="host-canvas" nodes={hostNodes} edges={hostEdges} onNodesChange={(changes:NodeChange[])=>setHostNodes(old=>applyNodeChanges(changes,old))} fitView nodesDraggable={false}/></div>
 <form aria-label="Actual host form" onSubmit={event=>{event.preventDefault();setFormSubmits(old=>old+1);}}><div className="fixture-viewers">{mounted&&<DiagramCloudViewer key={key} label="Viewer A" apiVersion={1} document={a} allowedViewIds={scopesA} selection={selectedA} onSelectionChange={capabilities?selectA:undefined} onNavigateView={capabilities?navigateA:undefined} onOpenSource={capabilities?sourceA:undefined}/>}<DiagramCloudViewer label="Viewer B" apiVersion={1} document={b} allowedViewIds={scopeB} selection={selectedB} onSelectionChange={selectB}/></div><button type="submit">Submit host form</button><button type="button" onClick={()=>setFormSubmits(0)}>Reset host form count</button></form><output aria-label="Host form submissions">{formSubmits}</output>
 <output aria-label="A controlled selection">{JSON.stringify(selectedA)}</output><output aria-label="B controlled selection">{JSON.stringify(selectedB)}</output><output aria-label="Host canonical documents unchanged">{String(JSON.stringify({a,b})===before)}</output><pre aria-label="Permitted host callback log">{JSON.stringify(logs)}</pre></>;
}
createRoot(document.getElementById('consumer-root')!).render(<ReactFlowProvider><Host/></ReactFlowProvider>);
