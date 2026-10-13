const DATABASE_NAME = 'workstation-extracted-designs';
const STORE_NAME = 'extractions';

export type SavedExtractedDesign = {
  id: string;
  file: File;
  extracted: string;
  details?: string;
  savedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open saved designs.'));
    request.onblocked = () => reject(new Error('Saved designs are blocked by another tab.'));
  });
}

async function transactStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onerror = () => reject(request.error ?? new Error('Could not access saved designs.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saved design storage was interrupted.'));
      transaction.oncomplete = () => resolve(request.result);
    });
  } finally {
    database.close();
  }
}

export async function listSavedExtractedDesigns(): Promise<SavedExtractedDesign[]> {
  const designs = await transactStore('readonly', store => store.getAll() as IDBRequest<SavedExtractedDesign[]>);
  return designs.sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveExtractedDesign(design: SavedExtractedDesign): Promise<void> {
  await transactStore('readwrite', store => store.put(design));
}

export async function deleteSavedExtractedDesign(id: string): Promise<void> {
  await transactStore('readwrite', store => store.delete(id));
}
