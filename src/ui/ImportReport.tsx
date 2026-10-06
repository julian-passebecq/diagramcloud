import {FORMAT_LABEL,type ImportReport} from '../core/interchange';

/** What an import (draw.io, Mermaid, Visio) or a repository scan kept and what it dropped, shown before applying. */
export function ImportReportView({report}:{report:ImportReport}){
 const scan=report.format==='repository'||report.format==='atlas';
 return <div className="import-report" data-testid="import-report">
  {report.format==='atlas'
   ?<p><b>Project atlas</b> · {report.fileName} · {report.groups?`${report.groups} repositories · `:''}{report.pages} views · {report.nodes} components · {report.edges} connections. Each repository keeps its own revision; IDs are stable, so the review shows exactly what changed before you apply.</p>
   :scan
   ?<p><b>Repository scan</b> · {report.fileName} · {report.pages} views · {report.nodes} components · {report.edges} connections{report.groups?` · ${report.groups} containers`:''}. The same repository always gives the same IDs: scanning it again later shows what changed before you apply.</p>
   :<p><b>{FORMAT_LABEL[report.format]} import</b> · {report.fileName} · {report.pages>1?`${report.pages} pages · `:''}{report.nodes} boxes · {report.edges} connections{report.groups?` · ${report.groups} groups`:''}. Applying adds a new project; the open project is not changed.</p>}
  <div className="import-columns">
   <section aria-label="Kept"><h4>{scan?'Found':'Kept'}</h4><ul>{report.kept.map(k=><li key={k}>{k}</li>)}</ul></section>
   <section aria-label="Not imported"><h4>{scan?'Not detected or skipped':'Not imported or approximated'}</h4>{report.lost.length?<ul>{report.lost.map(k=><li key={k}>{k}</li>)}</ul>:<p>Nothing.</p>}</section>
  </div>
 </div>;
}
