import type {LearningMapping,Project} from '../../core/model';
import {publicDocument} from '../../core/operations';
import {targetFingerprint} from '../../core/learningMapping';

/**
 * The current fingerprint to compare with a stored mapping target. A suggestion proposed through the public projection
 * (the MCP `diagramcloud_propose_mapping` path) records `fingerprintBasis: 'public'`: its fingerprint hashes the public
 * target only, so it is compared with the public projection of the same document, never with the authoring copy (which
 * would read every target with private evidence or members as stale on arrival). Only a suggestion keeps that basis:
 * the author's review rebinds the mapping to the authoring fingerprint and drops it, and a reviewed or source-declared
 * mapping is always compared with the document it is read from.
 */
export function currentTargetFingerprint(project:Project,mapping:LearningMapping):{fingerprint:string|undefined;missing:string}{
 const where=`The mapped ${mapping.target.kind} ${mapping.target.id}`;
 if(mapping.state!=='suggested'||mapping.target.fingerprintBasis!=='public')return {fingerprint:targetFingerprint(project,mapping.target),missing:`${where} no longer exists here.`};
 if(!targetFingerprint(project,mapping.target))return {fingerprint:undefined,missing:`${where} no longer exists here.`};
 return {fingerprint:targetFingerprint(publicDocument(project),mapping.target),missing:`${where} is no longer in the public projection this suggestion was proposed from.`};
}

