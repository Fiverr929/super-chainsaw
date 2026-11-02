import localFs from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface WorkspaceStorageContext {
  fs: typeof localFs;
  userId: string;
  images?: unknown;
}

// Shared across the Worker entrypoint and the server rendering bundle.
const globalStorage = globalThis as typeof globalThis & { __workstationStorage?: AsyncLocalStorage<WorkspaceStorageContext> };
const context = globalStorage.__workstationStorage ??= new AsyncLocalStorage<WorkspaceStorageContext>();
export function withWorkspaceStorage<T>(value: WorkspaceStorageContext, operation: () => T): T {
  return context.run(value, operation);
}
export function workspaceStorageContext() { return context.getStore(); }
export function cloudStorageErrorResponse(error: unknown): Response | null {
  if (error instanceof Error && (error as Error & {code?:string}).code === 'WORKSPACE_STORAGE') {
    return Response.json({error:error.message},{status:(error as Error & {status:number}).status, headers:{'Cache-Control':'no-store'}});
  }
  return null;
}

// Local development continues using disk. Hosted requests supply a per-user store.
export default new Proxy(localFs, {
  get(target, name) {
    const backend = context.getStore()?.fs ?? target;
    const value = Reflect.get(backend, name);
    return typeof value === 'function' ? value.bind(backend) : value;
  },
});
