import assert from 'node:assert/strict';
import { test } from 'node:test';
import nativeSharp from 'sharp';
import workerSharp from '../src/lib/sharp-shim.ts';

test('Worker PNG metadata and alpha checks distinguish transparent art from opaque images',async () => {
  const bytes=await nativeSharp({create:{width:4,height:4,channels:4,background:{r:20,g:30,b:40,alpha:0.5}}}).png().toBuffer();
  const info=await workerSharp(bytes).metadata();
  assert.equal(info.width,4); assert.equal(info.height,4); assert.equal(info.hasAlpha,true);
  const alpha=await workerSharp(bytes).extractChannel(3).raw().toBuffer();
  assert.equal(alpha.length,16); assert.ok(alpha.every(value=>value===128));
  const opaque=await nativeSharp(bytes).removeAlpha().png().toBuffer();
  assert.equal((await workerSharp(opaque).metadata()).hasAlpha,false);
  await assert.rejects(workerSharp(Buffer.from('not an image')).metadata());
  await assert.rejects(workerSharp(bytes,{limitInputPixels:4}).metadata(),/exceeds/);
});
