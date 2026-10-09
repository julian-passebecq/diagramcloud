import type {Project} from '../core/model';
import {publicDocument} from '../core/operations';
import {iconFor,iconAttribution} from '../core/icons';
import {noIcons,type IconData} from './iconData';
import {rasterAvailable} from './rasterDimensions';
/** Public renderer-specific ledger. It reports limitations, never adds facts. */
export function assetFidelity(input:Project,viewId:string,renderer:'classic'|'powerpoint'|'design'|'blueprint'|'editorial',icons:IconData=noIcons){
 const p=publicDocument(input),view=p.views.find(v=>v.id===viewId)??p.views.find(v=>v.id===p.rootViewId)!,semanticOnly=['design','blueprint','editorial'].includes(renderer);
 return {format:'diagramcloud.asset-fidelity/1',projectId:p.id,projectRevision:p.revision,viewId:view.id,renderer,
  entries:p.nodes.filter(n=>view.nodeIds.includes(n.id)).map(n=>{const entry=iconFor(n.icon),asset=n.customIconAssetId?p.assets.find(a=>a.id===n.customIconAssetId):undefined;
   const available=!!asset&&rasterAvailable(asset.data),rendered=semanticOnly?'semantic-label':available?'project-asset':entry.origin==='vendor'&&icons(entry)?'vendor-artwork':'semantic-symbol';
   return {nodeId:n.id,requestedIcon:n.icon,customAssetId:asset?.id,rendered,rights:asset?.rights,origin:asset?'project-asset':entry.origin,
    reason:semanticOnly?'This profile presents semantic labels and types. Project artwork and vendor icons are omitted.':asset&&!available?'Custom raster container or dimensions unavailable; registry artwork or original semantic glyph used. Author asset and reference retained.':available?'Contained in the icon slot without cropping, recolouring or distortion.':entry.origin==='vendor'&&!icons(entry)?'Registry artwork bytes unavailable; original semantic glyph used.':'Registry selection rendered offline.',
    attribution:asset?asset.rights:iconAttribution(entry)};
  }),note:'Only this public view is inspected. Artwork does not establish provider identity, runtime verification or publication rights.'};
}
