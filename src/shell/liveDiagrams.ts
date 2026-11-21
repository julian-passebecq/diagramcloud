/** R1006: the text of every file in diagrams/, and, while `npm run dev` runs, each new version of that list.
 *  Vite's own file watching does the work: the glob re-runs when a file of diagrams/ is added, changed or deleted, and
 *  this module accepts its own update (an HMR boundary), so the shell is told without a page reload and keeps its state.
 *  A built or previewed page has no import.meta.hot: the list is the one bundled at build time and nothing listens. */
export const DIAGRAM_TEXTS=import.meta.glob<string>('/diagrams/*',{query:'?raw',import:'default',eager:true});

type Listener=(texts:Record<string,string>)=>void;
// Kept in hot.data so the listeners survive each new version of this module.
const listeners:Set<Listener>=import.meta.hot?(import.meta.hot.data.listeners??=new Set<Listener>()):new Set<Listener>();
if(import.meta.hot)import.meta.hot.accept(next=>{if(next)for(const l of listeners)l(next.DIAGRAM_TEXTS as Record<string,string>);});

/** Calls back with the new diagrams/ texts on each live change; returns the unsubscribe. Never called in a built page. */
export function onDiagramsChange(listener:Listener):()=>void{listeners.add(listener);return ()=>{listeners.delete(listener);};}
