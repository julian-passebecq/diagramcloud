import {FORMAT_LABEL,type ImportReport} from '../core/interchange';

/** What a draw.io / Mermaid import kept and what it dropped, shown before the new project is applied. */
export function ImportReportView({report}:{report:ImportReport}){
 return <div className="import-report" data-testid="import-report">
  <p><b>{FORMAT_LABEL[report.format]} import</b> · {report.fileName} · {report.pages>1?`${report.pages} pages · `:''}{report.nodes} boxes · {report.edges} connections{report.groups?` · ${report.groups} groups`:''}. Applying adds a new project; the open project is not changed.</p>
  <div className="import-columns">
   <section aria-label="Kept"><h4>Kept</h4><ul>{report.kept.map(k=><li key={k}>{k}</li>)}</ul></section>
   <section aria-label="Not imported"><h4>Not imported or approximated</h4>{report.lost.length?<ul>{report.lost.map(k=><li key={k}>{k}</li>)}</ul>:<p>Nothing.</p>}</section>
  </div>
 </div>;
}
