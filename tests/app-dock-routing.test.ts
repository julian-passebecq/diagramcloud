import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The scenario modal only renders with VITE_DATAPASS_COMPARISON=1, which the Playwright build does not set,
// so these source checks guard the two App.tsx wiring rules from the 2026-11-04 stack review.
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');

test('Author B / C in Variants closes the modal with focus return and routes through routeGuard and the explorer reveal',()=>{
 const m=app.match(/onVariants=\{\(\)=>\{([^]*?)\}\}\s*onStageProject/);
 assert.ok(m,'onVariants handler not found');
 const body=m[1];
 assert.match(body,/^closeScenario\(\);routeGuard\(\(\)=>\{/,'must close through closeScenario, then route through routeGuard');
 assert.match(body,/setMode\('Edit'\);setSidebar\('variants'\)/);
 assert.match(body,/selectWorkbenchPane\(w,'explorer'\)/);
 assert.doesNotMatch(body,/setModal\(null\)/,'setModal(null) skips focus return');
});

test('opening Git or Work dock tools keeps ProjectDock mounted (hidden), never swapped out',()=>{
 const i=app.indexOf('<ProjectDock ');
 assert.ok(i>0);
 const before=app.slice(Math.max(0,i-400),i);
 assert.match(before,/hidden=\{activityPanels\.some\(p=>p==='git'\|\|p==='work'\)\}>$/,'ProjectDock must sit in an always-rendered host hidden while git/work panels show');
 assert.doesNotMatch(before,/\?<><button[^]*Back to project dock[^]*\)\}<\/>:$/,'ProjectDock must not be the else branch of the git/work ternary');
});
