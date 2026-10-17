import {documentSchema} from './model';

/**
 * Schema compatibility for whole-document imports. A document from a newer or different DiagramCloud may carry
 * top-level modules this version does not know. They are reported as unsupported, and the rest of the document is
 * imported only after the author confirms that exact list. Known fields stay strict (validateDocument still refuses
 * an unknown field inside them), an unknown module grants nothing (it is dropped, not kept aside or quarantined),
 * and an unknown schemaVersion is refused outright.
 */
export const SUPPORTED_SCHEMA_VERSION=1;
export const KNOWN_MODULES:readonly string[]=Object.keys(documentSchema.shape);

export class UnknownModulesError extends Error{
 constructor(readonly modules:readonly string[]){
  super(`Unsupported module${modules.length===1?'':'s'} in this document: ${modules.join(', ')}. This DiagramCloud does not read ${modules.length===1?'it':'them'}. Nothing was imported. Confirm to import the rest without ${modules.length===1?'it':'them'}; ${modules.length===1?'it is':'they are'} dropped, not kept.`);
  this.name='UnknownModulesError';
 }
}

export type ModuleInspection={unknown:string[]};
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Looks only at a whole document: top-level keys and schemaVersion. Throws on an unsupported schemaVersion. */
export function inspectModules(input:unknown):ModuleInspection{
 if(!isRecord(input))return {unknown:[]};
 if('schemaVersion' in input&&input.schemaVersion!==SUPPORTED_SCHEMA_VERSION)throw new Error(`Unsupported schemaVersion ${JSON.stringify(input.schemaVersion)}: this DiagramCloud reads schemaVersion ${SUPPORTED_SCHEMA_VERSION} only. Nothing was imported.`);
 return {unknown:Object.keys(input).filter(k=>!KNOWN_MODULES.includes(k)).sort()};
}

/**
 * Returns the document without its unknown top-level modules, or throws UnknownModulesError when the author has not
 * confirmed exactly that list (a different or partial confirmation is not consent for a new module).
 */
export function withoutUnknownModules(input:unknown,confirmed:readonly string[]=[]):{document:unknown;dropped:string[]}{
 const {unknown}=inspectModules(input);if(!unknown.length)return {document:input,dropped:[]};
 const same=unknown.length===confirmed.length&&unknown.every(k=>confirmed.includes(k));
 if(!same)throw new UnknownModulesError(unknown);
 const rest={...(input as Record<string,unknown>)};for(const k of unknown)delete rest[k];
 return {document:rest,dropped:unknown};
}
