import type {DesignType,Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {architectureSvg} from './architecture';
import {explodedSvg,layerStackSvg} from './layers';
import {treeSvg} from './tree';
import type {DesignOptions} from './context';

export type {DesignOptions} from './context';
export const DESIGN_TYPE_LABEL:Record<DesignType,string>={auto:'Auto (from the view)',architecture:'Architecture',layers:'Layer stack',exploded:'Exploded stack (3D)',tree:'Drilldown tree'};
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
 return type==='layers'?layerStackSvg(input,viewId,o):type==='exploded'?explodedSvg(input,viewId,o):type==='tree'?treeSvg(input,viewId,o):architectureSvg(input,viewId,o);
}
