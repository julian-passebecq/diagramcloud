import {useState} from 'react';
import type {Project} from '../core/model';

/** Gallery buckets: the author's portfolio, the cloud architecture reference gallery, and the user's own or imported projects. */
export type GalleryFilter='all'|'portfolio'|'cloud'|'mine';
export const GALLERY_FILTERS:{id:GalleryFilter;label:string}[]=[{id:'all',label:'All'},{id:'portfolio',label:'Portfolio'},{id:'cloud',label:'Cloud architectures'},{id:'mine',label:'Your projects'}];
export function galleryBucket(p:Project):Exclude<GalleryFilter,'all'>{return p.category==='Portfolio'?'portfolio':p.category==='Reference'?'cloud':'mine';}

const MARKS:Record<string,string>={'Microsoft Fabric':'F',Databricks:'D',AWS:'A',Azure:'Az','Google Cloud':'G',Kubernetes:'K8',Imported:'↧'};
/** The small letter mark on a gallery card, from the project's first technology tag. */
export function projectMark(p:Project):string{
 if(p.title.startsWith('Foil'))return 'F′';
 for(const t of p.tags)if(MARKS[t])return MARKS[t];
 if(MARKS[p.title])return MARKS[p.title];
 return p.category==='Blank'?'+':p.title.trim()[0]?.toUpperCase()??'·';
}

/** Release note card, dismissed per browser (storage may be unavailable: then it simply shows). */
export const WHATS_NEW_ID='whats-new-1.1';
export function WhatsNew({onShow}:{onShow:(what:'import'|'cloud')=>void}){
 const [hidden,setHidden]=useState(()=>{try{return localStorage.getItem(WHATS_NEW_ID)==='hidden';}catch{return false;}});
 if(hidden)return null;
 const hide=()=>{setHidden(true);try{localStorage.setItem(WHATS_NEW_ID,'hidden');}catch{/* private window: keep it hidden for this visit only */}};
 return <section className="whats-new" aria-label="What's new">
  <div className="eyebrow">WHAT'S NEW · 1.1</div>
  <ul>
   <li><button type="button" className="link-button" onClick={()=>onShow('import')}>Import draw.io and Mermaid</button> diagrams: boxes, labels, connections, groups and pages, with a report of what was not imported.</li>
   <li><button type="button" className="link-button" onClick={()=>onShow('cloud')}>Cloud architecture gallery</button>: AWS, Azure, Google Cloud, Kubernetes and event-driven references with drilldowns and evidence.</li>
  </ul>
  <button type="button" className="link-button dismiss" onClick={hide} aria-label="Dismiss what's new">Dismiss</button>
 </section>;
}
