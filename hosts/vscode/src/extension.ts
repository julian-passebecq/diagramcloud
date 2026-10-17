/**
 * Standalone DiagramCloud viewer for VS Code and Cursor. Opens one DiagramCloud JSON document chosen by the person in
 * a webview that shows only its public projection, read-only. Capabilities are granted explicitly through the
 * `diagramcloud.viewer.grants` setting (default: none). Returns pass the host guard; closing the panel disposes the
 * session, and opening again starts a new one, so earlier returns and files are refused.
 */
import * as vscode from 'vscode';
import {randomBytes} from 'node:crypto';
import {createReturnGuard,type ReturnGuard} from '../../../src/react/hostSession';
import {openMessage,handleReturn,handleReturnFile,handleSelectionRequest,webviewHtml,type HostAction,type ViewerOpen} from './hostCore';

export function activate(context:vscode.ExtensionContext){
 const out=vscode.window.createOutputChannel('DiagramCloud viewer');context.subscriptions.push(out);
 let panel:vscode.WebviewPanel|undefined,guard:ReturnGuard|undefined,pending:ViewerOpen|undefined,ready=false;
 const act=async(action:HostAction)=>{out.appendLine(action.log);if(action.warn)void vscode.window.showWarningMessage(action.warn);if(action.reply&&panel)await panel.webview.postMessage(action.reply);
  if(action.show)await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(action.show),{preview:true,viewColumn:vscode.ViewColumn.Beside});};
 const ensurePanel=()=>{
  if(panel)return panel;
  const media=vscode.Uri.joinPath(context.extensionUri,'media'),created=vscode.window.createWebviewPanel('diagramcloud.viewer','DiagramCloud viewer',vscode.ViewColumn.Beside,{enableScripts:true,localResourceRoots:[media],retainContextWhenHidden:false});
  created.webview.html=webviewHtml(created.webview.cspSource,created.webview.asWebviewUri(vscode.Uri.joinPath(media,'webview.js')).toString(),created.webview.asWebviewUri(vscode.Uri.joinPath(media,'webview.css')).toString(),randomBytes(18).toString('hex'));
  created.onDidDispose(()=>{guard?.dispose();guard=undefined;panel=undefined;pending=undefined;ready=false;out.appendLine('Viewer session closed. Its returns and return files are now refused.');});
  created.webview.onDidReceiveMessage(raw=>{const message=raw as {type?:string;intent?:unknown}|null;if(!message||typeof message!=='object')return;
   if(message.type==='ready'){ready=true;if(pending)void created.webview.postMessage(pending);}
   else if(message.type==='return')void act(handleReturn(guard,message.intent,'live'));
   else if(message.type==='select')void act(handleSelectionRequest(guard,message.intent));
   else if(message.type==='source')out.appendLine('Source request received. Sources are never opened automatically.');});
  return panel=created;
 };
 const open=async(target?:unknown)=>{
  let uri=target instanceof vscode.Uri?target:undefined;
  if(!uri&&vscode.window.activeTextEditor?.document.languageId==='json')uri=vscode.window.activeTextEditor.document.uri;
  if(!uri)uri=(await vscode.window.showOpenDialog({canSelectMany:false,filters:{'DiagramCloud document':['json']},openLabel:'Open in DiagramCloud viewer'}))?.[0];
  if(!uri)return;
  const text=new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)),grants=vscode.workspace.getConfiguration('diagramcloud.viewer').get<string[]>('grants',[]);
  const result=openMessage(text,Array.isArray(grants)?grants.filter(g=>typeof g==='string'):[],'vscode-'+randomBytes(12).toString('hex'));
  if(!result.ok){void vscode.window.showErrorMessage(result.reason);return;}
  guard?.dispose();guard=createReturnGuard(result.binding);pending=result.message;
  const view=ensurePanel();view.title=`DiagramCloud: ${result.message.title}`.slice(0,80);view.reveal(vscode.ViewColumn.Beside);if(ready)await view.webview.postMessage(pending);
  out.appendLine(`Opened ${result.binding.projectId}@${result.binding.baseRevision} in session ${result.binding.sessionId}; granted: ${result.binding.granted.join(', ')||'none (read-only)'}.`);
 };
 const loadReturn=async()=>{
  const uri=(await vscode.window.showOpenDialog({canSelectMany:false,filters:{'DiagramCloud return':['json']},openLabel:'Load return file'}))?.[0];if(!uri)return;
  await act(handleReturnFile(guard,new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))));
 };
 context.subscriptions.push(vscode.commands.registerCommand('diagramcloud.viewer.open',open),vscode.commands.registerCommand('diagramcloud.viewer.loadReturnFile',loadReturn));
}
export function deactivate(){}
