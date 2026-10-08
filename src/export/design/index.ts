import type {DesignType,Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {architectureSvg} from './architecture';
import {explodedSvg,layerStackSvg} from './layers';
import {treeSvg} from './tree';
import {sequenceSvg,swimlaneSvg,timelineSvg} from './flow';
import {chartSvg} from './chart';
import {atlasSvg} from './atlas';
import {sankeySvg} from './sankey';
import {contextSvg} from './systemContext';
import {statusSvg} from './status';
import {lineageSvg} from './lineage';
import {radialSvg} from './radial';
import {deploymentSvg} from './deployment';
import {matrixSvg} from './matrix';
import {treemapSvg} from './treemap';
import {hubSvg} from './hub';
import {heatmapSvg} from './heatmap';
import {lineSvg} from './line';
import type {DesignOptions} from './context';

export type {DesignOptions} from './context';
export const DESIGN_TYPE_LABEL:Record<DesignType,string>={auto:'Auto (from the view)',architecture:'Architecture',layers:'Layer stack',exploded:'Exploded stack (3D)',tree:'Drilldown tree',swimlane:'Swimlane',sequence:'Sequence',timeline:'Story timeline',chart:'Chart (from table evidence)',deployment:'Deployment (declared zones)',matrix:'Evidence matrix (basis × confidence)',treemap:'Treemap (drilldown size)',hub:'Hub (one component and its neighbours)',heatmap:'Heatmap (from table evidence)',line:'Line chart (from table evidence)',context:'System context (boundary)',status:'Status board (designed status)',lineage:'Lineage (upstream and downstream)',radial:'Radial reach (1–3 steps)',atlas:'Atlas revisions (per repository)',sankey:'Sankey (connection quantities)'};
export const DESIGN_THEME_LABEL={light:'Light',dark:'Dark',editorial:'Editorial (full)'} as const;

/** The figure type a view gets: its design hint, else Architecture. */
export function resolveDesignType(input:Project,viewId:string,type?:DesignType):Exclude<DesignType,'auto'>{
 const requested=type&&type!=='auto'?type:publicDocument(input).views.find(v=>v.id===viewId)?.design?.type;
 return requested&&requested!=='auto'?requested:'architecture';
}

/**
 * Diagram Design mode: one static, offline, accessible SVG of a public view in diagram-design's visual grammar.
 * Built from publicDocument and the ViewSpec only, so nothing private reaches the figure; deterministic for a given `now`.
 */
export function designSvg(input:Project,viewId:string,options:DesignOptions={}):string{
 const type=resolveDesignType(input,viewId,options.type),o={...options,type};
 return type==='sankey'?sankeySvg(input,viewId,o):type==='atlas'?atlasSvg(input,viewId,o):type==='context'?contextSvg(input,viewId,o):type==='status'?statusSvg(input,viewId,o):type==='lineage'?lineageSvg(input,viewId,o):type==='radial'?radialSvg(input,viewId,o):type==='deployment'?deploymentSvg(input,viewId,o):type==='matrix'?matrixSvg(input,viewId,o):type==='treemap'?treemapSvg(input,viewId,o):type==='hub'?hubSvg(input,viewId,o):type==='heatmap'?heatmapSvg(input,viewId,o):type==='line'?lineSvg(input,viewId,o):type==='chart'?chartSvg(input,viewId,o):type==='swimlane'?swimlaneSvg(input,viewId,o):type==='sequence'?sequenceSvg(input,viewId,o):type==='timeline'?timelineSvg(input,viewId,o):type==='layers'?layerStackSvg(input,viewId,o):type==='exploded'?explodedSvg(input,viewId,o):type==='tree'?treeSvg(input,viewId,o):architectureSvg(input,viewId,o);
}
