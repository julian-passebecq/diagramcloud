import type {Project} from './model';

/**
 * Icon registry: the only place an icon ID gets meaning. Original symbols are DiagramCloud artwork (MIT). A vendor
 * icon is third-party artwork under its owner's terms, never under this repository's MIT licence, so every vendor
 * entry records where the file came from (repository, commit, package version and git blob of the exact file)
 * and the controlling usage terms. `scripts/icons.ts` fails the build when a file in public/icons is missing
 * here or no longer matches its recorded blob, which also catches cropped, recoloured or otherwise edited copies.
 */
export type IconSource={repository:string;path:string;commit:string;blob:string;packageName?:string;packageVersion?:string;url:string};
export type IconEntry={
 id:string;label:string;origin:'original'|'vendor';alt:string;
 /** Path under public/, served next to the app. Vendor entries only. */
 file?:string;vendor?:string;represents?:string;source?:IconSource;
 terms?:{name:string;url:string};rules?:string[];
};

/*
 * Curated, not exhaustive: Microsoft Fabric items used by the samples and the DataPass ecosystem. Azure and
 * Databricks concepts use the original generic symbols: Azure artwork ships as a separate download with its own
 * terms, and Databricks publishes no icon usage terms, so neither is bundled. Adding one is a per-icon decision
 * with its terms checked first.
 */
/** A Microsoft Fabric item icon from the same pinned FabricTools/fabric-icons commit and terms as the entries above. */
function fabricIcon(id:string,upstream:string,label:string,represents:string,blob:string):IconEntry{
 const path=`node_modules/@fabric-msft/svg-icons/svg/${upstream}_48_item.svg`;
 return {id,label,origin:'vendor',alt:`${label} icon`,file:`icons/${id}.svg`,vendor:'Microsoft',represents,
  source:{repository:'FabricTools/fabric-icons',path,commit:'e206270f367dc440b5bf6bc94f0f6267b922d596',blob,packageName:'@fabric-msft/svg-icons',packageVersion:'8.2.0',
   url:`https://github.com/FabricTools/fabric-icons/blob/e206270f367dc440b5bf6bc94f0f6267b922d596/${path}`},
  terms:{name:'Microsoft Fabric icons usage terms',url:'https://learn.microsoft.com/en-us/fabric/fundamentals/icons'},
  rules:[`Use only to represent ${represents}, labelled as such.`,'Do not crop, flip, rotate, recolour or distort the artwork.','Do not use it as a logo for DiagramCloud or any other product.','Not covered by the DiagramCloud MIT licence, nor by the source repository\'s licence.']};
}

export const ICON_REGISTRY:IconEntry[]=[
 ...['api','job','test','ci','git','owner','document','decision','artifact'].map(role=>({id:'generic-'+role,label:'Generic '+role+' symbol',origin:'original' as const,alt:role+' semantic symbol',represents:role,rules:['Original DiagramCloud semantic geometry in src/core/iconGlyph.ts (MIT).','Offline line artwork; theme ink applies only to these original symbols. No vendor branding.']})),
 ...(['source','process','storage','model','report','app','control','function','table'] as const).map(kind=>({id:'generic-'+kind,label:'Generic '+kind+' symbol',origin:'original' as const,alt:kind+' component',represents:kind,rules:['Original DiagramCloud semantic symbol (MIT).','Uses the existing kind glyph on the canvas; exports retain the semantic kind. No vendor branding.']})),
 {id:'generic',label:'Generic component symbol',origin:'original',alt:'',
  rules:['Original DiagramCloud line symbols chosen by component kind. Not a vendor logo.']},
 {id:'fabric-lakehouse',label:'Microsoft Fabric Lakehouse',origin:'vendor',alt:'Microsoft Fabric Lakehouse icon',
  file:'icons/fabric-lakehouse.svg',vendor:'Microsoft',represents:'a Microsoft Fabric Lakehouse item',
  source:{repository:'FabricTools/fabric-icons',path:'node_modules/@fabric-msft/svg-icons/svg/lakehouse_48_item.svg',
   commit:'e206270f367dc440b5bf6bc94f0f6267b922d596',blob:'a06e893bb2ecafcc6a563a607e7b4c2064b7a7d9',
   packageName:'@fabric-msft/svg-icons',packageVersion:'8.2.0',
   url:'https://github.com/FabricTools/fabric-icons/blob/e206270f367dc440b5bf6bc94f0f6267b922d596/node_modules/@fabric-msft/svg-icons/svg/lakehouse_48_item.svg'},
  terms:{name:'Microsoft Fabric icons usage terms',url:'https://learn.microsoft.com/en-us/fabric/fundamentals/icons'},
  rules:['Use only to represent the Microsoft Fabric Lakehouse item it depicts, labelled as such.','Do not crop, flip, rotate, recolour or distort the artwork.','Do not use it as a logo for DiagramCloud or any other product.','Not covered by the DiagramCloud MIT licence, nor by the source repository\'s licence.']},
 {id:'fabric-pipeline',label:'Microsoft Fabric Pipeline',origin:'vendor',alt:'Microsoft Fabric Pipeline icon',
  file:'icons/fabric-pipeline.svg',vendor:'Microsoft',represents:'a Microsoft Fabric Data Factory pipeline item',
  source:{repository:'FabricTools/fabric-icons',path:'node_modules/@fabric-msft/svg-icons/svg/pipeline_48_item.svg',
   commit:'e206270f367dc440b5bf6bc94f0f6267b922d596',blob:'fb8b9c4db4b97a4346f56c6fb7ed1228550419db',
   packageName:'@fabric-msft/svg-icons',packageVersion:'8.2.0',
   url:'https://github.com/FabricTools/fabric-icons/blob/e206270f367dc440b5bf6bc94f0f6267b922d596/node_modules/@fabric-msft/svg-icons/svg/pipeline_48_item.svg'},
  terms:{name:'Microsoft Fabric icons usage terms',url:'https://learn.microsoft.com/en-us/fabric/fundamentals/icons'},
  rules:['Use only to represent the Microsoft Fabric pipeline item it depicts, labelled as such.','Do not crop, flip, rotate, recolour or distort the artwork.','Do not use it as a logo for DiagramCloud or any other product.','Not covered by the DiagramCloud MIT licence, nor by the source repository\'s licence.']},
 fabricIcon('fabric-data-warehouse','data_warehouse','Microsoft Fabric Warehouse','a Microsoft Fabric Warehouse item','624222e8fad1dfb1285aab130884645895d22aad'),
 fabricIcon('fabric-notebook','notebook','Microsoft Fabric Notebook','a Microsoft Fabric Notebook item','f329876b4e02ccabd1b2cdc01d26102f008c47c0'),
 fabricIcon('fabric-semantic-model','semantic_model','Microsoft Fabric Semantic model','a Microsoft Fabric / Power BI semantic model item','8fe5fc93fe7d6f536629b5e5ba0d5f314a7bc516'),
 fabricIcon('fabric-sql-database','sql_database','Microsoft Fabric SQL database','a Microsoft Fabric SQL database item','04e1ead5f1239138b4c19dcb89423597012afb3a'),
 fabricIcon('fabric-eventstream','eventstream','Microsoft Fabric Eventstream','a Microsoft Fabric Real-Time Intelligence Eventstream item','bfe104a0ec081b3c3f7db5bbab56959d18632905'),
 fabricIcon('fabric-kql-database','kql_database','Microsoft Fabric KQL database','a Microsoft Fabric Real-Time Intelligence KQL database item (inside an Eventhouse)','894da8130df7afc8f5fa977be04721ae1945a3cd'),
];

const BY_ID=new Map(ICON_REGISTRY.map(e=>[e.id,e]));
export const GENERIC_ICON=BY_ID.get('generic')!;
export function isRegisteredIcon(id:string):boolean{return BY_ID.has(id);}
/** The entry to draw for an icon ID. Unregistered IDs draw the generic symbol, never an unknown file. */
export function iconFor(id:string|undefined):IconEntry{return (id&&BY_ID.get(id))||GENERIC_ICON;}
/** Vendor artwork a document shows, in first-use order. */
export function vendorIconsIn(doc:Pick<Project,'nodes'>):IconEntry[]{
 const out:IconEntry[]=[];for(const n of doc.nodes){const e=iconFor(n.icon);if(e.origin==='vendor'&&!out.includes(e))out.push(e);}return out;
}
/** One plain-text attribution line per vendor icon. */
export function iconAttribution(e:IconEntry):string{
 if(e.origin!=='vendor'||!e.source||!e.terms)return `${e.label}: original DiagramCloud artwork (MIT).`;
 const s=e.source;
 return `${e.label} icon: ${e.vendor} artwork, representing ${e.represents}. File ${s.path} from ${s.repository} at ${s.commit.slice(0,7)}${s.packageName?` (${s.packageName} ${s.packageVersion})`:''}, git blob ${s.blob}. Used under the ${e.terms.name} (${e.terms.url}); not covered by the DiagramCloud MIT licence.`;
}
/** Plain-text notice for the delivery bundle (public/third-party-licenses.txt). */
export function iconNotices():string{
 return ['ICON REGISTRY (src/core/icons.ts)',...ICON_REGISTRY.map(e=>[`- ${iconAttribution(e)}`,...(e.origin==='vendor'?(e.rules??[]).map(r=>`    · ${r}`):[])].join('\n'))].join('\n');
}
