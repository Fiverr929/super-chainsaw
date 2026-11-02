import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { preparePhysicalEtsyDraft, updatePhysicalEtsyDraft, validatePhysicalEtsyDraft } from '../src/lib/workspaceListingOperations.ts';
import { saveProduct } from '../src/lib/workspaceProductStore.ts';
import { readListingSheetSnapshot } from '../src/lib/workspaceListingStore.ts';
import type { WorkspaceProduct } from '../src/lib/workspaceProducts.ts';

async function fixture(){const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'agent-listing-'));const image=`data:image/png;base64,${(await sharp({create:{width:32,height:32,channels:4,background:'#8a8880'}}).png().toBuffer()).toString('base64')}`;const product:WorkspaceProduct={id:randomUUID(),revision:0,name:'Listing test tee',createdAt:'',updatedAt:'',designDataUrl:image,artworks:{front:image},generated:[{id:'front',name:'01-Front.png',dataUrl:image}],renderState:'ready',preset:{id:'shirt',name:'Test Shirt',productType:'T-Shirt',color:'Pepper',frames:[{id:'front',name:'Front',role:'Front',imageDataUrl:image,applyDesign:true,placement:{x:30,y:20,width:30,height:40,opacity:96,margin:0,realism:10,softness:1}}]}};const saved=await saveProduct(product,cwd);return{cwd,product:saved,cleanup:()=>fs.rm(cwd,{recursive:true,force:true})};}

test('prepares one revision-checked row and preserves its stable ID and existing copy',async()=>{
 const f=await fixture();try{const preset={id:'physical-preset',name:'My physical listing',category:'Shirts',price:'24.00'};const first=await preparePhysicalEtsyDraft(f.product.id,preset,'0',f.cwd);await updatePhysicalEtsyDraft(first.listingId,first.sheetRevision,{title:'My confirmed title',description:'Keep this approved description.'},f.cwd);const current=await readListingSheetSnapshot('etsy-physical',f.cwd);const again=await preparePhysicalEtsyDraft(f.product.id,preset,current!.revision,f.cwd);assert.equal(again.listingId,first.listingId);assert.equal(again.row.title,'My confirmed title');assert.equal(again.row.description,'Keep this approved description.');assert.equal((await readListingSheetSnapshot('etsy-physical',f.cwd))?.rows.length,1);await assert.rejects(preparePhysicalEtsyDraft(f.product.id,preset,'0',f.cwd),/changed/);}finally{await f.cleanup();}
});

test('applies only allowed listing fields and validates Etsy title, acronym, and tag gates',async()=>{
 const f=await fixture();try{const prepared=await preparePhysicalEtsyDraft(f.product.id,{id:'p',name:'Preset'},'0',f.cwd);await assert.rejects(updatePhysicalEtsyDraft(prepared.listingId,prepared.sheetRevision,{status:'Published'},f.cwd),/unsupported fields/);const updated=await updatePhysicalEtsyDraft(prepared.listingId,prepared.sheetRevision,{title:'Simple Shirt',alt_text:'Front print'},f.cwd);assert.equal(updated.row.alt_text,'Front print');const result=validatePhysicalEtsyDraft({...updated.row,title:'A'.repeat(141)+' SVG PNG DTG EPS',description:'Description',tags:Array.from({length:14},()=> 'longtag').join(',')});assert.ok(result.errors.some(value=>value.includes('140-character')));assert.ok(result.errors.some(value=>value.includes('capitalized')));assert.ok(result.errors.some(value=>value.includes('13 tags')));}finally{await f.cleanup();}
});
