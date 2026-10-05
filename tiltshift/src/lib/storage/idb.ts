/** 极简 IndexedDB Promise 封装：无后端，本地保存命名场景。 */

const DB_NAME = 'tiltshift-scenes';
const STORE = 'scenes';
const DB_VERSION = 1;

export interface StoredScene {
  /** 主键（本地生成的稳定 id） */
  id: string;
  name: string;
  updatedAt: number;
  input: import('../optics/types').SceneInput;
  unit: import('../optics/types').LengthUnit;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
        t.onerror = () => reject(t.error);
      }),
  );
}

export function saveScene(scene: StoredScene): Promise<IDBValidKey> {
  return tx('readwrite', (store) => store.put({ ...scene, updatedAt: Date.now() }));
}

export function loadScene(id: string): Promise<StoredScene | undefined> {
  return tx<StoredScene | undefined>('readonly', (store) => store.get(id) as IDBRequest<StoredScene | undefined>);
}

export function listScenes(): Promise<StoredScene[]> {
  return tx<StoredScene[]>('readonly', (store) => store.getAll() as IDBRequest<StoredScene[]>).then((rows) =>
    [...rows].sort((a, b) => b.updatedAt - a.updatedAt),
  );
}

export function deleteScene(id: string): Promise<void> {
  return tx('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

export function newId(): string {
  return `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
