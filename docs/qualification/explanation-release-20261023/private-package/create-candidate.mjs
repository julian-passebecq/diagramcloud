import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const source='130c70744ec8fdeefebb784c56afb53c182f8dfa';
const base='.local/continuation';
const evidenceCommit=JSON.parse(fs.readFileSync(`${base}/release-evidence-commit.json`,'utf8')).commit;
const proof=`https://github.com/julian-passebecq/diagramcloud/blob/${evidenceCommit}/docs/qualification/explanation-release-20261023/`;
const ci='https://github.com/julian-passebecq/diagramcloud/actions/runs/39985734370';
const check=(id,status,refs,method)=>({id,status,evidenceRefs:refs,inspectedBy:'Codex agent team',method});
const evidence={sourceSha:source,ci:{sourceSha:source,url:ci,conclusion:'success'},checks:[
 check('typecheck','PASS',[ci,proof+'ci/ARTIFACT-VERIFICATION.md'],'Successful exact-source main CI typecheck step'),
 check('unit','PASS',[ci,proof+'ci/ARTIFACT-VERIFICATION.md'],'Main CI: 2030 passed, 3 explicit skips'),
 check('build','PASS',[ci,proof+'local/build-130c707-canonical-final.log'],'Main CI plus fresh canonical local production build'),
 check('browser','PASS',[ci,proof+'ci/browser-summary.json',proof+'browser/canonical-browser-receipt.json'],'Main CI: 362 passed, 5 skipped; canonical local supplement: 6 passed'),
 check('real-atlas-quality','PASS',[proof+'local/qualification-130c707-canonical.json'],'Selected local atlas geometry: 3 passed; private input and raw log excluded'),
 check('pptx-zip','PASS',[proof+'pptx/zip-inventory.json',proof+'pptx/render-receipt.json'],'Synthetic deck: 46 ZIP entries, CRC pass, 2 slides, no external relationships'),
 check('pptx-visual','PASS',[proof+'pptx/VISUAL-REVIEW.md'],'AI inspection of two native PowerPoint PNG renders; no human acceptance inferred'),
 check('bundled-cli','PASS',[proof+'local/bundled-client-receipt.json',proof+'local/qualified-cli-inventory-130c707-canonical.json'],'21 isolated CLI/MCP cases passed with labelled synthetic inputs'),
 check('installed-vscode','FAIL',[proof+'local/vscode-host-130c707-canonical.json',proof+'local/vscode-host-diagnosis-130c707-canonical.json'],'Optional host check: two attempts each 4 pass/3 fail, unresolved quick-input timeout'),
 check('installed-cursor','NOT_RUN',[proof+'local/cursor-host-130c707-canonical.json'],'Optional host check not run; existing harness hides onboarding'),
 check('deployed-web','PASS',[proof+'editor/deployed-smoke.json',proof+'editor/editor-result.json'],'Exact production source: 4 smoke cases and 2 viewport explanation journeys passed')
]};
fs.writeFileSync(`${base}/candidate-evidence.json`,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/package-campaign.ts','--evidence',`${base}/candidate-evidence.json`,'--out',`${base}/candidate-1.33.1-130c707`],{stdio:'inherit'});
