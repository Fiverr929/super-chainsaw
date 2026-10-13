const DATABASE_NAME = "workstation-v2";
const DATABASE_VERSION = 1;
const STORE_NAME = "mockup-presets";
const PRESETS_KEY = "current";
let saveQueue: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open mockup preset storage."));
    request.onblocked = () => reject(new Error("Mockup preset storage upgrade was blocked."));
  });
}

export async function loadMockupPresets(): Promise<unknown> {
  await saveQueue;
  const database = await openDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(PRESETS_KEY);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not read mockup presets."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Reading mockup presets was aborted."));
    });
  } finally {
    database.close();
  }
}

async function writeMockupPresets(presets: unknown): Promise<void> {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(presets, PRESETS_KEY);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save mockup presets."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Saving mockup presets was aborted."));
    });
  } finally {
    database.close();
  }
}

export function saveMockupPresets(presets: unknown): Promise<void> {
  const queuedSave = saveQueue.then(() => writeMockupPresets(presets));
  saveQueue = queuedSave.catch(() => undefined);
  return queuedSave;
}
