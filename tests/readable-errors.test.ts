import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {clone,errorMessage,formatIssues,issuePath,MAX_LISTED_ISSUES,validationIssues} from '../src/core/model';
import {applyDraft,checkDraft,type DraftBase} from '../src/core/jsonDraft';
import {contosoForecasting} from '../src/data/contosoForecasting';

test('readable errors: a schema refusal reads one "path: message" line per issue, never a raw JSON array',()=>{
 const schema=z.object({nodes:z.array(z.object({label:z.string()})),title:z.string()});
 const r=schema.safeParse({nodes:[{label:'ok'},{label:3}]});
 assert.ok(!r.success);
 const text=errorMessage(r.error);
 assert.ok(!text.trimStart().startsWith('['),text);
 assert.deepEqual(text.split('\n'),['nodes[1].label: Expected string, received number','title: Required']);
 // The same issues wrapped in a plain Error (as a caller rethrowing error.message would) read the same.
 assert.equal(errorMessage(new Error(r.error.message)),text);
});

test('readable errors: paths, the whole document, the issue cap and ordinary errors',()=>{
 assert.equal(issuePath([]),'(document)');
 assert.equal(issuePath(['views',0,'nodeIds',2]),'views[0].nodeIds[2]');
 const many=Array.from({length:MAX_LISTED_ISSUES+3},(_,i)=>({path:['nodes',i],message:'Required'}));
 const lines=formatIssues(many).split('\n');
 assert.equal(lines.length,MAX_LISTED_ISSUES+1);
 assert.equal(lines.at(-1),'… and 3 more issues.');
 assert.equal(errorMessage(new Error('Not valid JSON: x')),'Not valid JSON: x');
 assert.equal(errorMessage(new Error('[not json')),'[not json');
 assert.equal(errorMessage(new Error('[1,2]')),'[1,2]','a bracketed message that is not an issue list stays as written');
 assert.equal(validationIssues('plain'),null);
});

test('JSON drawer: a structurally invalid draft is refused with readable lines and nothing changes',()=>{
 const d=contosoForecasting(),before=clone(d),base:DraftBase={projectId:d.id,revision:d.revision,scope:{kind:'project'}};
 const draft=JSON.parse(JSON.stringify(d));draft.nodes[0].label=42;delete draft.title;
 const checked=checkDraft(base,d,JSON.stringify(draft));
 assert.equal(checked.ok,false);
 if(checked.ok)return;
 assert.ok(!/"code"|^\s*\[/.test(checked.error),checked.error);
 assert.match(checked.error,/^nodes\[0\]\.label: Expected string, received number$/m);
 assert.match(checked.error,/^title: Required$/m);
 assert.throws(()=>applyDraft(base,d,JSON.stringify(draft)),(e:Error)=>/^Refused: /.test(e.message)&&/nodes\[0\]\.label: /.test(e.message)&&/Nothing was applied\.$/.test(e.message));
 assert.deepEqual(d,before,'the applied model is untouched');
});
