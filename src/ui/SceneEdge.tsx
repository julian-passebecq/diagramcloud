import {BaseEdge,EdgeLabelRenderer,getSmoothStepPath,type Edge,type EdgeProps} from '@xyflow/react';
import {routeLabel,type ScenePoint} from '../export/scene';
import {elbowPath} from '../export/design/kit';

/**
 * Canvas connection drawn along the export scene's route (src/export/scene.ts, sceneRoutes), so the canvas and the
 * SVG/PPTX/draw.io exports bend at the same places. The route is computed by the domain in view layout pixels; this
 * UI-layer edge only converts it to React Flow coordinates and draws it with the export's rounded corners.
 *
 * Coordinates: a scene box's top-left is positionFor(view,id), which is exactly the React Flow node's `position`
 * because the canvas renders with nodeOrigin [0,0] (see SCENE_NODE_ORIGIN) and no scaling of its own: the viewport
 * transform (pan/zoom) applies to nodes and edges alike. Box sizes are the cards' measured sizes, passed to the
 * scene, so route ends land on the card sides where the handles sit.
 */
export const SCENE_NODE_ORIGIN:[number,number]=[0,0];
/**
 * Scene (view layout px) to React Flow flow coordinates: the identity, offset 0 and scale 1, because both use the
 * box top-left at view.positions. A non-zero nodeOrigin would shift each box by origin x its own size, which no
 * single translation of a route could follow, so the canvas pins the origin instead of converting.
 */
export const sceneToFlow=(points:ScenePoint[]):ScenePoint[]=>points;
/** Corner radius of the export's rounded right-angle connectors (Diagram Design elbowPath default). */
export const SCENE_CORNER_RADIUS=8;

export type SceneEdgeData={kind:string;speed:string;motion:boolean;dimmed:boolean;highlighted:boolean;
 /** The scene route in flow coordinates; absent when the scene has none for this connection. */
 route?:ScenePoint[];
 /** True while an end is being dragged (or not yet committed): draw React Flow's smooth step from the live handles. */
 live?:boolean};
export type FlowEdge=Edge<SceneEdgeData,'dataflow'>;

export function SceneEdge(props:EdgeProps<FlowEdge>){
 const d=props.data,routed=!!d?.route&&d.route.length>1&&!d.live;
 let path:string,x:number,y:number;
 if(routed){const pts=d!.route!;path=elbowPath(pts,SCENE_CORNER_RADIUS);const at=routeLabel(pts);x=at.x;y=at.y;}
 else [path,x,y]=getSmoothStepPath({...props,borderRadius:14});
 return <g className={`data-edge ${routed?'scene-routed':'smooth-step'} ${d?.motion?'moving':''} speed-${d?.speed??'medium'} ${d?.dimmed?'dimmed':''} ${d?.highlighted?'highlighted':''} ${props.selected?'edge-selected':''}`} data-route={routed?'scene':'live'}>
  <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={{stroke:d?.highlighted?'#2563eb':'#93a5be',strokeWidth:d?.highlighted?2.6:1.7,strokeDasharray:d?.kind==='control'?'5 5':undefined}}/>
  {d?.motion&&<path className="flow-dashes" d={path} fill="none" stroke="#4b78bf" strokeWidth="2" strokeDasharray="3 16" pointerEvents="none"/>}
  <EdgeLabelRenderer><span className="edge-label" style={{transform:`translate(-50%,-50%) translate(${x}px,${y}px)`,opacity:d?.dimmed?.25:1}}>{String(props.label??'')}</span></EdgeLabelRenderer>
 </g>;
}
