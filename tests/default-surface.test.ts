import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SURFACE_KEY,readDefaultSurface,resolveInitialSurface,writeDefaultSurface,type DefaultSurfaceStorage} from '../src/core/defaultSurface';

function memory(initial:Record<string,string>={}):DefaultSurfaceStorage&{data:Map<string,string>}{
 const data=new Map(Object.entries(initial));
 return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,String(v));},removeItem:k=>{data.delete(k);}};
}
const broken:DefaultSurfaceStorage={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');},removeItem:()=>{throw new Error('blocked');}};

test('the classic studio stays the default for everyone',()=>{
 assert.equal(resolveInitialSurface('',memory()),'studio');assert.equal(resolveInitialSurface('',null),'studio');
});
test('precedence: ?workspace=studio > ?workspace=v3 > stored choice > studio',()=>{
 const stored=memory({[DEFAULT_SURFACE_KEY]:'workspace'});
 assert.equal(resolveInitialSurface('',stored),'workspace');
 assert.equal(resolveInitialSurface('?workspace=studio',stored),'studio');
 assert.equal(resolveInitialSurface('?workspace=v3',memory()),'workspace');
 assert.equal(resolveInitialSurface('?workspace=v3&workspace=studio',stored),'workspace','the first value is the request');
 assert.equal(resolveInitialSurface('?workspace=other',stored),'workspace');
});
test('storage failure or a corrupt value falls back to the studio silently and is never repaired',()=>{
 assert.equal(resolveInitialSurface('',broken),'studio');assert.equal(readDefaultSurface(broken),null);
 const corrupt=memory({[DEFAULT_SURFACE_KEY]:'{"surface":"workspace"}'});
 assert.equal(resolveInitialSurface('',corrupt),'studio');assert.equal(corrupt.data.get(DEFAULT_SURFACE_KEY),'{"surface":"workspace"}');
 assert.equal(writeDefaultSurface(broken,'workspace'),false);assert.equal(writeDefaultSurface(null,'workspace'),false);
});
test('an explicit choice is written; choosing the studio removes the record',()=>{
 const s=memory();assert.equal(writeDefaultSurface(s,'workspace'),true);assert.equal(s.data.get(DEFAULT_SURFACE_KEY),'workspace');
 assert.equal(readDefaultSurface(s),'workspace');
 assert.equal(writeDefaultSurface(s,'studio'),true);assert.equal(s.data.has(DEFAULT_SURFACE_KEY),false);assert.equal(readDefaultSurface(s),null);
 assert.equal(writeDefaultSurface(s,'v3' as never),false);
});
