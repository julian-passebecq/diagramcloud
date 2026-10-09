import type {ScanFile} from './scanner';
/** Artifact preference is an opt-in hybrid seam. Resolve only explicit selected
 * model paths from supported manifests; never read project_root or compiled SQL. */
export function dbtArtifactModelPaths(files:readonly ScanFile[]):Set<string>{
 const selected=new Set(files.map(f=>f.path)),paths=new Set<string>();
 for(const f of files){if(!/(^|\/)manifest\.json$/i.test(f.path))continue;
  try{const data=JSON.parse(f.text) as Record<string,unknown>,metadata=data.metadata as Record<string,unknown>|undefined,nodes=data.nodes;
   if(!metadata||typeof metadata.dbt_schema_version!=='string'||!/\/manifest\/v(?:[4-9]|1[0-2])\.json$/.test(metadata.dbt_schema_version)||!nodes||typeof nodes!=='object'||Array.isArray(nodes))continue;
   const directory=f.path.split('/').slice(0,-1);if(directory.at(-1)?.toLowerCase()==='target')directory.pop();
   for(const [id,raw] of Object.entries(nodes)){if(!/^(?:model|snapshot|seed)\./.test(id)||!raw||typeof raw!=='object'||Array.isArray(raw))continue;
    const relative=(raw as Record<string,unknown>).original_file_path;if(typeof relative!=='string'||!relative||/^(?:\/|[a-z]:)/i.test(relative)||/[\\\u0000-\u001f]/.test(relative)||relative.split('/').some(p=>!p||p==='.'||p==='..'))continue;
    const path=[...directory,relative].join('/');if(selected.has(path)&&/\.sql$/i.test(path))paths.add(path);
   }
  }catch{/* An invalid artifact cannot suppress existing source heuristics. */}
 }
 return paths;
}
