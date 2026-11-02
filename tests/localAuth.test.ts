import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { localAuth } from '../src/lib/localAuth.ts';
import { createSingleAccount, verifyLogin } from '../src/lib/manualAuth.ts';

test('local account setup persists across server connections and still blocks a second account',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'workstation-local-auth-'));
  try {
    await fs.mkdir(path.join(root,'drizzle'));
    await fs.copyFile(path.join(process.cwd(),'drizzle','0001_perpetual_rogue.sql'),path.join(root,'drizzle','0001_perpetual_rogue.sql'));
    const first=await localAuth(root),password='Test-only-local-credential';
    try {await createSingleAccount(first.db,{username:'local-owner',password,confirmation:password,setupToken:first.config.localSetupToken},first.config);}
    finally {first.close();}
    const reopened=await localAuth(root);
    try {
      assert.equal((await verifyLogin(reopened.db,'local-owner',password,'local-test')).username,'local-owner');
      await assert.rejects(createSingleAccount(reopened.db,{username:'another-owner',password,confirmation:password,setupToken:reopened.config.localSetupToken},reopened.config),/already been created/);
    } finally {reopened.close();}
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
