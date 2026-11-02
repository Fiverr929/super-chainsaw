import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browserStorage, browserStorageKey } from '../src/lib/browserStorage.ts';

test('cloud browser caches start empty and are isolated from legacy data and other accounts', () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis,'window');
  const values = new Map([['worksheet','legacy local data']]);
  const mock = { __workstationStorageScope:'alice' as string | null, localStorage:{
    getItem:(key:string)=>values.get(key) ?? null,
    setItem:(key:string,value:string)=>{values.set(key,value);},
    removeItem:(key:string)=>{values.delete(key);},
  } };
  Object.defineProperty(globalThis,'window',{value:mock,configurable:true});
  try {
    assert.equal(browserStorage.getItem('worksheet'),null);
    browserStorage.setItem('worksheet','Alice draft');
    const aliceKey=browserStorageKey('worksheet');
    mock.__workstationStorageScope='bob';
    assert.equal(browserStorage.getItem('worksheet'),null);
    browserStorage.setItem('worksheet','Bob draft');
    assert.notEqual(browserStorageKey('worksheet'),aliceKey);
    mock.__workstationStorageScope='alice';
    assert.equal(browserStorage.getItem('worksheet'),'Alice draft');
    browserStorage.removeItem('worksheet');
    mock.__workstationStorageScope=null;
    assert.equal(browserStorage.getItem('worksheet'),'legacy local data');
  } finally {
    if(prior) Object.defineProperty(globalThis,'window',prior);
    else Reflect.deleteProperty(globalThis,'window');
  }
});
