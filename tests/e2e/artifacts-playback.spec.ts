import {test,expect,type Page} from '@playwright/test';

// Bundled samples only. Artifact entry and declared-step playback read; nothing is saved, observed or run.
async function projectJson(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const json=await page.getByLabel('Project JSON',{exact:true}).inputValue();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 return json;
}

test('artifact entry: from a storage component or a dataset reach citing components, producers and consumers, and open one in its view',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.locator('.project-card').filter({hasText:'TotalEnergies'}).click();
 await page.getByRole('button',{name:'Business overview',exact:true}).click();
 await expect(page.getByTestId('component-membership-facts')).toContainText(/unique components \(by stable ID\) · \d+ view memberships across \d+ views/);
 const artifacts=page.getByRole('region',{name:'Artifacts',exact:true}),list=artifacts.getByRole('list',{name:'Artifact list'});
 await artifacts.getByRole('button',{name:/^Storage \/ table component \(\d+\)$/}).click();
 await list.getByRole('button',{name:'Oracle project database',exact:true}).click();
 const card=artifacts.getByRole('article',{name:'Artifact: Oracle project database'});
 const trace=card.getByRole('group',{name:/^Trace in .* from Oracle project database$/});
 await expect(trace).toContainText('Producers (upstream):');
 await expect(trace.getByRole('button',{name:'SQL quality checks',exact:true})).toBeVisible();
 await artifacts.getByRole('button',{name:/^Verification check \(declared\) \(\d+\)$/}).click();
 await list.getByRole('button',{name:'SQL quality checks',exact:true}).click();
 await expect(artifacts.getByRole('article',{name:'Artifact: SQL quality checks'})).toContainText('not an observed result');
 await artifacts.getByRole('button',{name:/^Table \/ dataset \(\d+\)$/}).click();
 await list.getByRole('button',{name:'Synthetic input',exact:true}).click();
 const dataset=artifacts.getByRole('article',{name:'Artifact: Synthetic input'});
 await dataset.getByRole('list',{name:'Citing components'}).getByRole('button',{name:'Input rows',exact:true}).click();
 await expect(page.getByRole('region',{name:'Artifacts',exact:true})).toHaveCount(0);
 await expect(page.locator('.react-flow__node.selected').first()).toContainText('Input rows');
 expect(errors).toEqual([]);
});

test('declared-workflow playback walks the declared steps as a presented sequence, with no run data, without changing the document',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const filter=page.getByRole('button',{name:/^Adoption journeys/});
 if(!await filter.isVisible())await page.getByRole('button',{name:'Project gallery',exact:true}).click();
 await filter.click();
 await page.locator('.project-card').filter({hasText:'Galaxy agent process'}).click();
 const before=await projectJson(page);
 await page.locator('.side-tabs').getByRole('button',{name:'Navigate',exact:true}).click();
 const playback=page.getByRole('region',{name:'Declared workflow playback',exact:true});
 await expect(playback).toContainText('No order is invented');
 await expect(playback.getByRole('button',{name:'Play declared steps',exact:true})).toHaveCount(0);
 const navigator=page.getByTestId('project-navigator');
 await navigator.getByRole('tab',{name:'Views',exact:true}).click();
 await navigator.getByRole('button',{name:'Intended procedure',exact:true}).click();
 await expect(playback).toContainText('Declared by the view');
 await playback.getByRole('button',{name:'Play declared steps',exact:true}).click();
 const state=playback.getByRole('status',{name:'Playback state'});
 await expect(state).toHaveText('Presented sequence - not a run, not timing · Step 1 of 6 · Session');
 await expect(playback).toContainText('No run data: times and outcome UNKNOWN');
 await expect(playback.getByRole('button',{name:'Previous step',exact:true})).toBeDisabled();
 await playback.getByRole('button',{name:'Next step',exact:true}).click();
 await expect(state).toContainText('Step 2 of 6 · Worktree');
 await expect(playback.locator('li[aria-current="step"]')).toHaveText('Worktree');
 await expect(page.locator('.react-flow__node.selected').first()).toContainText('Worktree');
 await playback.getByRole('button',{name:'Stop playback',exact:true}).click();
 expect(await projectJson(page)).toBe(before);
 expect(errors).toEqual([]);
});
