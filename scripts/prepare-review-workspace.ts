import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildReviewWorkspace} from '../examples/review-workspace/build';
import {linkedReadingHtml} from '../src/export/linkedReadingHtml';
import {meetingSummaryHtml} from '../src/export/meetingSummary';
import {inspectJoin} from '../src/intelligence/joinInspection';

async function main(){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--example')throw new Error('Usage: tsx scripts/prepare-review-workspace.ts --example NEW_DIRECTORY');
 const output=resolve(args[1]),f=buildReviewWorkspace();
 // Prepare bytes before the exclusively created output directory. Never run external code or replace a directory.
 const files:Record<string,string>={
  'review.project.json':JSON.stringify(f.project,null,2),
  'review.reading.json':JSON.stringify(f.reading,null,2),
  'review.publication.json':JSON.stringify(f.brief,null,2),
  'join.request.json':JSON.stringify(f.request,null,2),
  'join.result.json':JSON.stringify(inspectJoin(f.request),null,2),
  'join-review.html':linkedReadingHtml(f.project,f.reading,{now:new Date('2026-10-19T00:00:00Z')}),
  'meeting-summary.html':meetingSummaryHtml(f.project,f.brief)
 };
 await mkdir(output,{recursive:false});
 for(const [name,content]of Object.entries(files))await writeFile(resolve(output,name),content,{flag:'wx'});
 console.log(JSON.stringify({output,files:Object.keys(files),basis:'SYNTHETIC_EXAMPLE_ONLY',applied:false,executedSql:false}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
