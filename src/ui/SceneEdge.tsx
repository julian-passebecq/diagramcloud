import {BaseEdge,EdgeLabelRenderer,getSmoothStepPath,type Edge,type EdgeProps} from '@xyflow/react';
import type {ScenePoint} from '../export/scene';
import {LABEL_HEIGHT,type PlacedLabel} from './labelPlace';
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

export type SceneEdgeData={activateLabel?:()=>void;domId?:string;kind:string;speed:string;motion:boolean;dimmed:boolean;highlighted:boolean;
 /** The scene route in flow coordinates; absent when the scene has none for this connection. */
 route?:ScenePoint[];
 /** Where the label pill goes (src/ui/labelPlace.ts): clear of every card, clipped with an ellipsis when space is short. */
 labelAt?:PlacedLabel;
 /** True while an end is being dragged (or not yet committed): draw React Flow's smooth step from the live handles. */
 live?:boolean};
export type FlowEdge=Edge<SceneEdgeData,'dataflow'>;

/** Label placement state exposed on the button: `placed` is drawn, `hidden` found no room, `pending` has no scene route yet or an end is being dragged. */
export type LabelPlacement='placed'|'hidden'|'pending';
const buttonBase={height:LABEL_HEIGHT,border:0,margin:0,minWidth:0,minHeight:0,boxSizing:'border-box',fontFamily:'inherit',fontWeight:400,appearance:'none'} as const;
function LabelButton({id,text,at,selected,dimmed,activate}:{id:string;text:string;at?:PlacedLabel;selected:boolean;dimmed:boolean;activate:()=>void}){
 const placement:LabelPlacement=!at?'pending':at.hidden?'hidden':'placed',shown=placement==='placed';
 // Not drawn: zero-size, transparent, out of the Tab order and pointer-transparent, but still the same connected,
 // programmatically focusable element, so a focus held across a re-placement stays where it is.
 return <button type="button" className={`edge-label placed edge-label-button nodrag nopan${at?.clipped&&shown?' clipped':''}${shown?'':' unplaced'}`} data-placement={placement} title={text} data-full={text} data-edge-id={id} aria-label={`Select connection ${id}: ${text}`} aria-pressed={selected} tabIndex={shown?0:-1}
  onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();}} onClick={event=>{event.stopPropagation();activate();}}
  style={shown?{...buttonBase,width:at!.width,transform:`translate(-50%,-50%) translate(${at!.x}px,${at!.y}px)`,opacity:dimmed?.25:1}:{...buttonBase,width:0,padding:0,overflow:'hidden',opacity:0,pointerEvents:'none',transform:at&&!at.hidden?`translate(-50%,-50%) translate(${at.x}px,${at.y}px)`:'translate(-50%,-50%)'}}>{text}</button>;
}

export function SceneEdge(props:EdgeProps<FlowEdge>){
 const d=props.data,routed=!!d?.route&&d.route.length>1&&!d.live;
 const text=String(props.label??''),at=d?.labelAt;
 let path:string;
 if(routed){const pts=d!.route!;path=elbowPath(pts,SCENE_CORNER_RADIUS);}
 else [path]=getSmoothStepPath({...props,borderRadius:14});
 return <g className={`data-edge ${routed?'scene-routed':'smooth-step'} ${d?.motion?'moving':''} speed-${d?.speed??'medium'} ${d?.dimmed?'dimmed':''} ${d?.highlighted?'highlighted':''} ${props.selected?'edge-selected':''}`} data-route={routed?'scene':'live'}>
  <BaseEdge id={d?.domId??props.id} path={path} markerEnd={props.markerEnd} style={{stroke:d?.highlighted?'#2563eb':'#93a5be',strokeWidth:d?.highlighted?2.6:1.7,strokeDasharray:d?.kind==='control'?'5 5':undefined}}/>
  {d?.motion&&<path className="flow-dashes" d={path} fill="none" stroke="#4b78bf" strokeWidth="2" strokeDasharray="3 16" pointerEvents="none"/>}
  {text&&<EdgeLabelRenderer>{d?.activateLabel
   // One stable <button> for the whole life of an activatable label. Placement changes (a resize re-measures the
   // cards, a drag makes the route live, the placer finds no room) are attributes and styles on the same element,
   // never a swap to a <span> or an unmount, so a focused label is never detached between a key press and its click.
   ?<LabelButton id={props.id} text={text} at={routed?at:undefined} selected={!!props.selected} dimmed={!!d.dimmed} activate={d.activateLabel}/>
   :routed?(at&&!at.hidden
   ?<span className={`edge-label placed${at.clipped?' clipped':''}`} title={text} data-full={text} style={{width:at.width,height:LABEL_HEIGHT,transform:`translate(-50%,-50%) translate(${at.x}px,${at.y}px)`,opacity:d?.dimmed?.25:1}}>{text}</span>
   :<span className="edge-label placed hidden-label" title={text} data-full={text} aria-label={text}/>)
   // While an end is dragged the cards move under the label: hide it until the drop places it again.
   :null}</EdgeLabelRenderer>}
 </g>;
}
