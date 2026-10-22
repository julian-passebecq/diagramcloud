import {documentSchema,validateDocument,MAX_DOCUMENT_BYTES,type Project} from '../../src/core/model';

/** Synthetic private evidence whose compact UTF-8 form fits but indentation does not. */
export function authoringBoundaryProject():Project{
 const doc=validateDocument(documentSchema.parse({schemaVersion:1,id:'authoring-boundary',title:'Synthetic authoring boundary',rootViewId:'root',nodes:[],edges:[],views:[{id:'root',title:'Root',nodeIds:[],positions:{}}],blocks:Array.from({length:84},(_,i)=>({id:`note-${i}`,type:'text',title:'Synthetic evidence',text:'界'.repeat(50000),provenance:'synthetic',visibility:'private'})),sources:[]}));
 const excess=new TextEncoder().encode(JSON.stringify(doc)).byteLength-(MAX_DOCUMENT_BYTES-1000),last=doc.blocks.at(-1)!;
 if(last.type!=='text')throw new Error('Synthetic fixture must end in a text block');
 last.text=last.text.slice(0,-Math.ceil(excess/3));
 return validateDocument(doc);
}
