import {useState} from 'react';
import type {Project} from '../core/model';

/** Gallery buckets: the author's portfolio, the cloud architecture reference gallery, and the user's own or imported projects. */
export type GalleryFilter='all'|'portfolio'|'cloud'|'mine';
export const GALLERY_FILTERS:{id:GalleryFilter;label:string}[]=[{id:'all',label:'All'},{id:'portfolio',label:'Portfolio'},{id:'cloud',label:'Cloud architectures'},{id:'mine',label:'Your projects'}];
/** The DataPass planning maps are reference-category documents about the author's own work, so they sit with the portfolio. */
export function galleryBucket(p:Project):Exclude<GalleryFilter,'all'>{
 if(p.category==='Portfolio'||p.category==='Reference'&&p.tags.some(t=>t==='Portfolio'||t==='Datapass'))return 'portfolio';
 return p.category==='Reference'?'cloud':'mine';
}
/** The small caption above a gallery card's title. */
export function galleryCaption(p:Project):string{
 if(p.tags.includes('Imported'))return `Imported · ${p.tags[1]??'diagram'}`;
 if(p.tags.includes('Scanned'))return 'Scanned repository';
 const bucket=galleryBucket(p);
 if(bucket==='portfolio')return p.category==='Portfolio'?'Portfolio':'Portfolio map';
 if(bucket==='cloud')return `Cloud architecture${p.tags[0]&&p.tags[0]!==p.title?` · ${p.tags[0]}`:''}`;
 return p.category;
}

const MARKS:Record<string,string>={'Microsoft Fabric':'F',Databricks:'D',AWS:'A',Azure:'Az','Google Cloud':'G',Kubernetes:'K8',Imported:'↧',Scanned:'⎇'};
/** The small letter mark on a gallery card, from the project's first technology tag. */
export function projectMark(p:Project):string{
 if(p.title.startsWith('Foil'))return 'F′';
 for(const t of p.tags)if(MARKS[t])return MARKS[t];
 if(MARKS[p.title])return MARKS[p.title];
 return p.category==='Blank'?'+':p.title.trim()[0]?.toUpperCase()??'·';
}

/** Release note card, dismissed per browser (storage may be unavailable: then it simply shows). */
export const WHATS_NEW_ID='whats-new-1.9';
export function WhatsNew({onShow}:{onShow:(what:'import'|'cloud'|'scan')=>void}){
 const [hidden,setHidden]=useState(()=>{try{return localStorage.getItem(WHATS_NEW_ID)==='hidden';}catch{return false;}});
 if(hidden)return null;
 const hide=()=>{setHidden(true);try{localStorage.setItem(WHATS_NEW_ID,'hidden');}catch{/* private window: keep it hidden for this visit only */}};
 return <section className="whats-new" aria-label="What's new">
  <div className="eyebrow">WHAT'S NEW · 1.9</div>
  <ul>
   <li><button type="button" className="link-button" onClick={()=>onShow('scan')}>Diagram from a repository</button>: pick a local Git folder and get its system context, containers, modules, files, data lineage and infrastructure, each link with its file and line and a confirmed / inferred / possible tag.</li>
   <li><b>MosaicStudio</b>: export any view as a concept spec for the layer cake, isometric and 3D viewers, with IDs kept and every loss listed.</li>
   <li><b>Contoso Forecasting</b>: a reference atlas read from a public repository at one revision, the local lab as built next to its Fabric App target design. Project manifests can now also be a Claude Control galaxy map.</li>
   <li><b>Blueprint</b>: an engineering-drawing rendering of the canvas, and Blueprint and Editorial SVG exports with a title block, legend and revision vector.</li>
   <li><b>Perspectives</b>: select a component to see it in System, Code, Data, Cloud or CI/CD views (or why it is not available), with Back / Forward and a basis filter.</li>
   <li><b>Project atlas</b>: import a project manifest (or a DataPass project file) to see a project made of several repositories, each at its own revision; rescan one repository at a time and compare snapshots.</li>
   <li><b>AtlasNote cheatsheet</b> in Export &amp; share: every public view becomes a printable AtlasNote page with its diagram, component table and story, ready for AtlasNote's cheatsheet import.</li>
   <li><button type="button" className="link-button" onClick={()=>onShow('import')}>Import draw.io, Mermaid and Visio</button> diagrams: boxes, labels, connections, groups and pages, with a report of what was not imported. Export any project back to draw.io.</li>
   <li><button type="button" className="link-button" onClick={()=>onShow('cloud')}>Cloud architecture gallery</button>: AWS, Azure, Google Cloud, Kubernetes and event-driven references with drilldowns and evidence.</li>
  </ul>
  <button type="button" className="link-button dismiss" onClick={hide} aria-label="Dismiss what's new">Dismiss</button>
 </section>;
}
