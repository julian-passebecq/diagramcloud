import '../styles.css';
import {LearningCatalogue} from './LearningCatalogue';
/** The project-less entry to the learning catalogue (`?catalogue`, linked from the gallery). It mounts no studio, opens no
 * project (not even the default sample), reads no saved workspace and calls no AI or network: only static authored lessons. */
export const CATALOGUE_PARAM='catalogue';
export const isCataloguePage=(search:string)=>new URLSearchParams(search).has(CATALOGUE_PARAM);
export function LearningPage(){
 return <div className="studio" data-theme="light"><main className="main-workspace" aria-label="Learning catalogue without a project" style={{padding:24,maxWidth:1100,margin:'0 auto',minWidth:0}}>
  <p><a href="./">Back to the studio</a></p>
  <p role="note">No project is open. This page loads no project, saved workspace, AI or network service; lessons are static authored content and nothing is mapped.</p>
  <LearningCatalogue/>
 </main></div>;
}
