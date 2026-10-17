import {test,expect,type Page,type Locator} from '@playwright/test';

/** Names of inputs an independent, no-Git, one-source journey must never be asked for. */
const FORBIDDEN=/cloud|tenant|subscription|agent|model|metric|telemetry|organi[sz]ation|\borg\b|api key|token|password|account/i;
async function controlNames(scope:Locator){
 return scope.locator('input:visible,select:visible,textarea:visible').evaluateAll(list=>list.map(el=>{const e=el as HTMLInputElement;if(e.type==='radio')return '';const label=e.getAttribute('aria-label')||e.labels?.[0]?.textContent||e.placeholder||e.name||'';return label.trim();}).filter(Boolean));
}
async function noForbiddenInput(scope:Locator,where:string){for(const name of await controlNames(scope))expect(name,`${where}: "${name}" asks for an outside input`).not.toMatch(FORBIDDEN);}

test('independent journey: one non-Git process with one source opens without cloud, agent, metrics or organisation input and is complete for learning',async({page})=>{
 const outside:string[]=[];page.on('request',r=>{const u=new URL(r.url());if(!['127.0.0.1','localhost'].includes(u.hostname)&&!u.protocol.startsWith('data')&&!u.protocol.startsWith('blob'))outside.push(r.url());});
 await page.goto('/');
 await page.locator('.header-actions').getByRole('button',{name:'New analysis',exact:true}).click();
 const start=page.getByTestId('project-start');
 await page.getByRole('radio',{name:/Guided/}).check();
 await noForbiddenInput(start,'New analysis');
 await page.getByLabel('Guided project title').fill('One declared process');
 await page.getByLabel('Guided project steps').fill('Reconcile invoices');
 await noForbiddenInput(start,'Guided form');
 await page.getByRole('button',{name:'Preview project',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await noForbiddenInput(dialog,'Import review');
 await page.getByRole('button',{name:'Apply imported document',exact:true}).click();
 await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
 await expect(page.getByTestId('project-navigator')).toContainText('Reconcile invoices');
 await openReadiness(page);
 const panel=page.getByTestId('project-readiness');
 await panel.getByLabel('Readiness purpose').selectOption('education');
 await expect(panel.getByText('Minimum output plan',{exact:true})).toBeVisible();
 await expect(panel).not.toContainText('(missing-required)');
 await panel.getByLabel('Readiness purpose').selectOption('portfolio');
 await expect(panel.getByText('Contribution is not described',{exact:true})).toBeVisible();
 await expect(panel).toContainText('(missing-required)');
 expect(outside,'no request leaves the local app').toEqual([]);
});

async function openReadiness(page:Page){
 await page.getByRole('button',{name:'JSON / AI',exact:true}).click();
 const panel=page.getByTestId('project-readiness');await panel.locator('summary').click();
}
