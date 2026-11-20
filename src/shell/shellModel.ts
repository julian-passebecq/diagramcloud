/** Placeholder content for the empty DiagramCloud shell (R875). No data, no backend. */
export type TreeNode={id:string;label:string;children?:TreeNode[]};

export const RIBBON_TABS:{id:string;label:string;buttons:string[]}[]=[
 {id:'home',label:'Home',buttons:['New','Open','Save']},
 {id:'insert',label:'Insert',buttons:['Box','Arrow','Note']},
 {id:'view',label:'View',buttons:['Zoom in','Zoom out','Fit']},
];

export const TREE:TreeNode[]=[
 {id:'project',label:'Project',children:[
  {id:'views',label:'Views',children:[{id:'view-1',label:'View 1'},{id:'view-2',label:'View 2'}]},
  {id:'components',label:'Components',children:[{id:'comp-1',label:'Component A'},{id:'comp-2',label:'Component B'}]},
 ]},
 {id:'sources',label:'Sources'},
];

export const NAV_ENTRIES=['Overview','Details','Properties','History'];

/** Pane sizes in pixels, kept inside sane bounds so a pane can never vanish or swallow the canvas. */
export type PaneSizes={left:number;right:number;bottom:number};
export const DEFAULT_SIZES:PaneSizes={left:240,right:220,bottom:140};
export const LIMITS:Record<keyof PaneSizes,[number,number]>={left:[140,480],right:[140,420],bottom:[60,400]};
export const clampSize=(pane:keyof PaneSizes,value:number)=>Math.min(LIMITS[pane][1],Math.max(LIMITS[pane][0],Math.round(value)));
