import React from 'react';import {createRoot} from 'react-dom/client';
import {WorkspacePreviewProvider,useWorkspacePreview,useWorkspacePreviewActions} from '../../../src/ui/workspacePreview';
import {samples} from '../../../src/data/samples';
const sample=samples.find(p=>p.id==='retail-operations')!;
const counts={app:0,canvas:0,publisher:0,consumer:0};(window as any).counts=counts;
function Canvas(){counts.canvas++;return <div>Canvas remains mounted</div>;}
function Publisher(){counts.publisher++;const actions=useWorkspacePreviewActions();return <button onClick={()=>actions.preview({nodeId:sample.nodes[0].id})}>Preview</button>;}
function Consumer(){counts.consumer++;const preview=useWorkspacePreview();return <output>{preview?.nodeId??'none'}</output>;}
function App(){counts.app++;return <WorkspacePreviewProvider project={sample}><Canvas/><Publisher/><Consumer/></WorkspacePreviewProvider>;}
createRoot(document.getElementById('root')!).render(<App/>);
