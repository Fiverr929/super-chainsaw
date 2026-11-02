import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type localFs from 'node:fs/promises';

export interface CloudDatabase {
  prepare(sql: string): { bind(...values: unknown[]): CloudStatement };
  batch(statements: CloudStatement[]): Promise<CloudResult[]>;
}
interface CloudStatement {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<CloudResult>;
}
interface CloudResult { meta: { changes: number } }
export interface CloudBucket {
  put(key: string, bytes: Uint8Array): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string | string[]): Promise<void>;
}
type Entry = { path: string; kind: string; data: string | null; object_key: string | null; size: number; modified: number; revision: string };
export class CloudStorageConflict extends Error {
  status = 409;
  code = 'WORKSPACE_STORAGE';
  constructor() { super('This record changed in another window. Reload it before saving again.'); }
}
function failure(code: string, name: string): never {
  throw Object.assign(new Error(`${code}: ${name}`), { code });
}

/** D1 owns records and the directory index; immutable R2 objects hold media bytes. */
export function createCloudWorkspaceFs(db: CloudDatabase, bucket: CloudBucket, userId: string): typeof localFs {
  if (!userId) throw new Error('A signed-in user is required for cloud storage.');
  const observed = new Map<string, string | null>();
  const root = path.resolve(process.cwd());
  function key(value: string) {
    const relative = path.relative(root, path.resolve(value)).replace(/\\/g, '/');
    if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) failure('EACCES', 'Invalid workspace path');
    if (!/^(?:\.workspace-data\/|public\/(?:workspace-products|workspace-assets|listings(?:-physical|-amazon)?)(?:\/|$)|tokens\.json$|latest_error\.json$|supabase_upload_cache\.json$)/.test(relative)) failure('EACCES', relative);
    return relative;
  }
  const statement = (sql: string, ...values: unknown[]) => db.prepare(sql).bind(...values);
  async function entry(name: string) {
    const result = await statement('SELECT * FROM workspace_entries WHERE owner = ? AND path = ?', userId, name).first<Entry>();
    observed.set(name, result?.revision ?? null);
    return result;
  }
  async function children(name: string) {
    return (await statement('SELECT * FROM workspace_entries WHERE owner = ? AND substr(path, 1, ?) = ?', userId, name.length + 1, name + '/').all<Entry>()).results;
  }
  async function put(name: string, bytes: Buffer, exclusive = false) {
    const previous = observed.has(name) ? observed.get(name)! : (await entry(name))?.revision ?? null;
    if (exclusive && previous !== null) failure('EEXIST', name);
    const structured = name.startsWith('.workspace-data/') && !/\.(?:png|jpg|jpeg|webp|mp4|webm)$/.test(name) || /(?:^|\/)\w[\w_-]*\.json(?:\.|$)/.test(name);
    if (structured && bytes.length > 1_500_000) throw Object.assign(new Error('This saved record exceeds the cloud storage limit. Split it into smaller worksheets or start a new conversation.'), { status:413, code:'WORKSPACE_STORAGE' });
    const objectKey = structured ? null : `${encodeURIComponent(userId)}/${randomUUID()}`;
    if (objectKey) await bucket.put(objectKey, bytes);
    const revision = randomUUID();
    const result = await statement(`INSERT INTO workspace_entries (owner, path, kind, data, object_key, size, modified, revision)
      SELECT ?, ?, 'file', ?, ?, ?, ?, ? WHERE ? IS NULL OR EXISTS (SELECT 1 FROM workspace_entries WHERE owner=? AND path=? AND revision=?)
      ON CONFLICT(owner, path) DO UPDATE SET data=excluded.data, object_key=excluded.object_key,
      size=excluded.size, modified=excluded.modified, revision=excluded.revision
      WHERE workspace_entries.revision = ?`, userId, name, structured ? bytes.toString('utf8') : null, objectKey, bytes.length, Date.now(), revision, previous, userId, name, previous, exclusive ? null : previous).run();
    if (!result.meta.changes) {
      if (objectKey) await bucket.delete(objectKey);
      if (exclusive) failure('EEXIST', name);
      throw new CloudStorageConflict();
    }
    observed.set(name, revision);
  }
  const backend = {
    async readFile(value: string, encoding?: string) {
      const name = key(value), record = await entry(name);
      if (!record) failure('ENOENT', name);
      if (record.kind === 'dir') failure('EISDIR', name);
      const object = record.object_key ? await bucket.get(record.object_key) : null;
      if (record.object_key && !object) failure('ENOENT', name);
      const bytes = record.data !== null ? Buffer.from(record.data) : Buffer.from(await object!.arrayBuffer());
      return encoding ? bytes.toString(encoding as BufferEncoding) : bytes;
    },
    async writeFile(value: string, data: string | Uint8Array, options?: string | { flag?: string }) {
      await put(key(value), typeof data === 'string' ? Buffer.from(data) : Buffer.from(data), typeof options === 'object' && options.flag === 'wx');
    },
    async mkdir(value: string, options?: { recursive?: boolean }) {
      const name = key(value);
      const names = options?.recursive ? name.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/')) : [name];
      for (const directory of names) {
        await statement("INSERT INTO workspace_entries (owner,path,kind,size,modified,revision) VALUES (?,?,'dir',0,?,?) ON CONFLICT(owner,path) DO NOTHING", userId, directory, Date.now(), randomUUID()).run();
      }
    },
    async access(value: string) { if (!await entry(key(value))) failure('ENOENT', key(value)); },
    async stat(value: string) {
      const name = key(value), record = await entry(name);
      if (!record) failure('ENOENT', name);
      return { size: record.size, mtimeMs: record.modified, isDirectory: () => record.kind === 'dir', isFile: () => record.kind === 'file' };
    },
    async readdir(value: string, options?: { withFileTypes?: boolean }) {
      const name = key(value);
      if (!await entry(name)) failure('ENOENT', name);
      const records = (await children(name)).filter(record => !record.path.slice(name.length + 1).includes('/'));
      return records.map(record => options?.withFileTypes ? { name: record.path.slice(name.length + 1), isDirectory: () => record.kind === 'dir', isFile: () => record.kind === 'file' } : record.path.slice(name.length + 1));
    },
    async rm(value: string, options?: { recursive?: boolean; force?: boolean }) {
      const name = key(value), expected = observed.has(key(value)) ? observed.get(key(value)) : undefined, record = await entry(name);
      if (!record) { if (options?.force) return; failure('ENOENT', name); }
      if (expected !== undefined && expected !== record.revision) throw new CloudStorageConflict();
      const records = record.kind === 'dir' ? await children(name) : [];
      if (records.length && !options?.recursive) failure('ENOTEMPTY', name);
      const result = await statement('DELETE FROM workspace_entries WHERE owner = ? AND (path = ? OR substr(path,1,?) = ?) AND (path != ? OR revision = ?)', userId, name, name.length + 1, name + '/', name, record.revision).run();
      if (!result.meta.changes) throw new CloudStorageConflict();
      const objects = [record, ...records].flatMap(item => item.object_key ? [item.object_key] : []);
      // Object names are unique to one entry; copied files receive new objects.
      for (let offset = 0; offset < objects.length; offset += 100) await bucket.delete(objects.slice(offset, offset + 100));
      observed.set(name, null);
    },
    async unlink(value: string) { return backend.rm(value); },
    async rename(from: string, to: string) {
      const source = key(from), target = key(to), record = await entry(source);
      if (!record) failure('ENOENT', source);
      if (record.kind === 'dir') {
        // A single SQL statement switches the complete exported folder index.
        if (await entry(target)) failure('EEXIST', target);
        await statement('UPDATE workspace_entries SET path = ? || substr(path, ?), revision = ? WHERE owner = ? AND (path = ? OR substr(path,1,?) = ?)', target, source.length + 1, randomUUID(), userId, source, source.length + 1, source + '/').run();
        observed.delete(source); observed.delete(target); return;
      }
      const previous = observed.has(target) ? observed.get(target)! : (await entry(target))?.revision ?? null;
      const revision = randomUUID();
      const result = await db.batch([
        statement(`INSERT INTO workspace_entries (owner,path,kind,data,object_key,size,modified,revision)
          SELECT owner,? ,kind,data,object_key,size,modified,? FROM workspace_entries WHERE owner=? AND path=? AND revision=?
          AND (? IS NULL OR EXISTS (SELECT 1 FROM workspace_entries WHERE owner=? AND path=? AND revision=?))
          ON CONFLICT(owner,path) DO UPDATE SET data=excluded.data,object_key=excluded.object_key,size=excluded.size,modified=excluded.modified,revision=excluded.revision WHERE workspace_entries.revision=?`, target, revision, userId, source, record.revision, previous, userId, target, previous, previous),
        statement('DELETE FROM workspace_entries WHERE owner=? AND path=? AND changes()=1', userId, source),
      ]);
      if (!result[0].meta.changes) throw new CloudStorageConflict();
      observed.set(target, revision); observed.set(source, null);
    },
    async copyFile(from: string, to: string) { await backend.writeFile(to, await backend.readFile(from) as Buffer); },
    async cp(from: string, to: string, options?: { recursive?: boolean }) {
      const source = key(from), record = await entry(source);
      if (!record) failure('ENOENT', source);
      if (record.kind === 'file') return backend.copyFile(from, to);
      if (!options?.recursive) failure('EISDIR', source);
      await backend.mkdir(to, { recursive: true });
      for (const child of await children(source)) {
        const destination = path.join(to, child.path.slice(source.length + 1));
        if (child.kind === 'dir') await backend.mkdir(destination, { recursive: true });
        else await backend.copyFile(path.join(root, child.path), destination);
      }
    },
  };
  return backend as unknown as typeof localFs;
}
