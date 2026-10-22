/** Opt-in deployed smoke scope. Never turn the whole local fixture suite on a remote host. */
export type DeploymentTarget = Readonly<{origin:string;sourceRevision:string;productVersion:string}>;
const keys=['DIAGRAMCLOUD_DEPLOYMENT_URL','DIAGRAMCLOUD_EXPECTED_SHA','DIAGRAMCLOUD_EXPECTED_VERSION'] as const;
const stableHosts=new Set(['diagramcloud.vercel.app','diagramcloud-julian-passebecqs-projects.vercel.app','diagramcloud-git-main-julian-passebecqs-projects.vercel.app']);

export function deploymentTarget(env:Readonly<Record<string,string|undefined>>):DeploymentTarget|null{
 if(keys.every(key=>env[key]===undefined))return null;
 if(keys.some(key=>!env[key]||env[key]!==env[key]?.trim()))throw new Error('Deployed smoke requires URL, exact source SHA and version together, without whitespace');
 const raw=env.DIAGRAMCLOUD_DEPLOYMENT_URL!;
 let url:URL;try{url=new URL(raw);}catch{throw new Error('Deployed smoke URL is invalid');}
 const owned=stableHosts.has(url.hostname)||/^diagramcloud-[a-z0-9]+-julian-passebecqs-projects\.vercel\.app$/.test(url.hostname);
 if(url.protocol!=='https:'||!owned||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||raw.includes('\\'))throw new Error('Deployed smoke needs an HTTPS DiagramCloud deployment origin, without credentials, bypass tokens, query or path');
 const sourceRevision=env.DIAGRAMCLOUD_EXPECTED_SHA!,productVersion=env.DIAGRAMCLOUD_EXPECTED_VERSION!;
 if(!/^[a-f0-9]{40}$/.test(sourceRevision))throw new Error('Deployed smoke requires a full lowercase 40-character Git SHA');
 if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(productVersion))throw new Error('Deployed smoke requires an explicit stable product version');
 return Object.freeze({origin:url.origin,sourceRevision,productVersion});
}

export function deploymentTestSelection(target:DeploymentTarget|null):{testMatch?:string[];testIgnore:string[]}{
 return target?{testMatch:['**/deployed-smoke.spec.ts'],testIgnore:[]}:{testIgnore:['**/deployed-smoke.spec.ts']};
}

/** Identity is checked before any App interaction; a matching badge alone is insufficient. */
export function assertDeploymentHandshake(value:unknown,target:DeploymentTarget):void{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Deployment handshake is not an object');
 const row=value as Record<string,unknown>;
 if(row.schema_version!==1||row.app_id!=='diagramcloud'||row.product_version!==target.productVersion||row.source_revision!==target.sourceRevision||row.galaxy_level!=='G0'||row.standalone!==true)throw new Error('Deployment handshake does not match the selected exact DiagramCloud source/version/G0');
}
