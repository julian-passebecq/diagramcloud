import {MAX_DOCUMENT_BYTES,type Project} from './model';

/**
 * Full authoring copy, including private and unattached content. Keep ordinary
 * copies readable without making a saved project too large for its importer.
 * An oversized unsaved draft is still backed up in full; serialization does
 * not validate it, acknowledge a save, or promise that it can be reimported.
 */
export function authoringJson(project:Project):string{
 const pretty=JSON.stringify(project,null,2);
 return new TextEncoder().encode(pretty).byteLength<=MAX_DOCUMENT_BYTES?pretty:JSON.stringify(project);
}
