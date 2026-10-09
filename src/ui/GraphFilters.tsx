import {useMemo} from 'react';
import type {Project} from '../core/model';
import {readGraphHistory,type GraphFilter} from '../intelligence/graphSnapshot';

export function GraphFilters({project,filter,onChange,prefix='Graph'}:{project:Project;filter:GraphFilter;onChange:(filter:GraphFilter)=>void;prefix?:string}){
 const generation=useMemo(()=>readGraphHistory(project).at(-1),[project]);
 if(!generation)return null;
 const choices={organization:[...new Set(generation.nodes.map(n=>n.organization))],project:generation.nodes.filter(n=>n.kind==='project').map(n=>n.externalId),family:[...new Set(generation.assertions.map(a=>a.family))],state:[...new Set(generation.nodes.map(n=>n.state))],origin:[...new Set(generation.assertions.map(a=>a.origin))]};
 const set=(key:keyof GraphFilter,value:string)=>onChange({...filter,[key]:value||undefined});
 return <div className="pi-controls graph-filter-controls"><label>Search imported facts<input aria-label={prefix+' search'} value={filter.search??''} onChange={e=>set('search',e.target.value)}/></label>{(Object.keys(choices) as (keyof typeof choices)[]).map(key=><label key={key}>{key}<select aria-label={prefix+' '+key} value={filter[key]??''} onChange={e=>set(key,e.target.value)}><option value="">All imported {key}</option>{choices[key].map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}<button onClick={()=>onChange({})}>Reset graph filters</button></div>;
}
