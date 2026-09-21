import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wrapLines,caption} from '../src/export/text';
test('presentation code keeps leading indentation',()=>assert.deepEqual(wrapLines('if valid:\n    run()\n\n    save()',95,true),['if valid:','    run()','','    save()']));
test('long code lines retain every character when wrapped',()=>{const s='    '+('value * '.repeat(30));assert.equal(wrapLines(s,95,true).join(''),s);});
test('bounded captions and normal prose wrapping',()=>{assert.equal(caption('one two three four',8,1),'one tw…');assert.ok(wrapLines('one two three four',8).every(s=>s.length<=8));});
