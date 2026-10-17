/** Loopback ports for the Playwright servers. DIAGRAMCLOUD_E2E_PORT selects the
 * base (the Studio preview); the React viewer fixture uses base+1 and the internal
 * edge-label fixture base+2. The default base stays above 20000 so parallel
 * sessions and common dev servers (4173/5173) never collide. DIAGRAMCLOUD_FIXTURE_PORT
 * still overrides a single fixture server when it is started on its own. */
const raw=process.env.DIAGRAMCLOUD_E2E_PORT;
const base=raw===undefined||raw===''?24173:Number(raw);
if(!Number.isInteger(base)||base<1024||base>65533)throw new Error('DIAGRAMCLOUD_E2E_PORT must be an integer between 1024 and 65533');
export const e2ePorts={app:base,reactViewer:base+1,edgeLabel:base+2} as const;
export const appOrigin='http://127.0.0.1:'+e2ePorts.app;
export const reactViewerUrl='http://127.0.0.1:'+e2ePorts.reactViewer+'/tests/fixtures/react-viewer/consumer.html';
export const edgeLabelUrl='http://127.0.0.1:'+e2ePorts.edgeLabel+'/tests/fixtures/edge-label/consumer.html';
export const fixturePort=(fallback:number)=>{const value=process.env.DIAGRAMCLOUD_FIXTURE_PORT;return value===undefined||value===''?fallback:Number(value);};
