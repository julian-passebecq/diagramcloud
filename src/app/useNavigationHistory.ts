import {useEffect,useRef,useState} from 'react';
type Entry={path:string[];view:string;selected:string|null};
/** Navigation history is a session projection; authoring history stays separate. */
export function useNavigationHistory(projectId:string,current:Entry,onRestore:(entry:Entry)=>void){
 const history=useRef<{entries:Entry[];index:number;skip:boolean}>({entries:[],index:-1,skip:false});
 const [,refresh]=useState(0);
 useEffect(()=>{history.current={entries:[],index:-1,skip:false};refresh(t=>t+1);},[projectId]);
 useEffect(()=>{const h=history.current;if(h.skip){h.skip=false;return;}const previous=h.entries[h.index];
  if(previous&&previous.view===current.view&&previous.selected===current.selected&&previous.path.join('/')===current.path.join('/'))return;
  h.entries=[...h.entries.slice(0,h.index+1),current].slice(-50);h.index=h.entries.length-1;refresh(t=>t+1);
 },[current.path,current.view,current.selected]);
 const go=(delta:number)=>{const h=history.current,entry=h.entries[h.index+delta];if(!entry)return;h.index+=delta;h.skip=true;onRestore(entry);refresh(t=>t+1);};
 return {go,canBack:history.current.index>0,canForward:history.current.index<history.current.entries.length-1};
}
