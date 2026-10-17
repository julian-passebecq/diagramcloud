/** The subset of the VS Code extension API this host uses (no @types/vscode dependency in the repository). */
declare module 'vscode' {
 export interface Disposable{dispose():unknown}
 export interface Event<T>{(listener:(e:T)=>unknown):Disposable}
 export class Uri{static joinPath(base:Uri,...segments:string[]):Uri;readonly fsPath:string;readonly scheme:string;toString():string}
 export interface ExtensionContext{readonly extensionUri:Uri;readonly subscriptions:Disposable[]}
 export interface OutputChannel extends Disposable{appendLine(value:string):void}
 export interface Webview{html:string;readonly cspSource:string;asWebviewUri(uri:Uri):Uri;postMessage(message:unknown):Thenable<boolean>;onDidReceiveMessage:Event<unknown>}
 export interface WebviewPanel extends Disposable{readonly webview:Webview;title:string;onDidDispose:Event<void>;reveal(column?:ViewColumn):void}
 export enum ViewColumn{Active=-1,Beside=-2,One=1}
 export interface TextDocument{readonly uri:Uri;readonly languageId:string;getText():string}
 export interface TextEditor{readonly document:TextDocument}
 export interface OpenDialogOptions{canSelectMany?:boolean;filters?:Record<string,string[]>;openLabel?:string}
 export namespace window{
  const activeTextEditor:TextEditor|undefined;
  function createOutputChannel(name:string):OutputChannel;
  function createWebviewPanel(viewType:string,title:string,column:ViewColumn,options:{enableScripts?:boolean;localResourceRoots?:Uri[];retainContextWhenHidden?:boolean}):WebviewPanel;
  function showOpenDialog(options:OpenDialogOptions):Thenable<Uri[]|undefined>;
  function showErrorMessage(message:string):Thenable<unknown>;
  function showWarningMessage(message:string):Thenable<unknown>;
  function showInformationMessage(message:string):Thenable<unknown>;
  function showTextDocument(document:TextDocument,options?:{preview?:boolean;viewColumn?:ViewColumn}):Thenable<TextEditor>;
 }
 export namespace workspace{
  const fs:{readFile(uri:Uri):Thenable<Uint8Array>};
  function getConfiguration(section:string):{get<T>(key:string,defaultValue:T):T};
  function openTextDocument(options:{language:string;content:string}):Thenable<TextDocument>;
 }
 export namespace commands{function registerCommand(command:string,callback:(...args:unknown[])=>unknown):Disposable}
}
