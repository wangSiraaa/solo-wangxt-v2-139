/**
 * IndexedDB 本地场景存储（无后端）。
 * 数据库 tilt-shift-lab / 对象仓库 scenes（自增 id）。
 */
import type { LensParams } from './optics';

export interface SavedScene {
  id?: number;
  name: string;
  createdAt: number;
  params: LensParams;
}

const DB_NAME = 'tilt-shift-lab';
const STORE = 'scenes';
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function saveScene(scene: SavedScene): Promise<number> {
  return tx('readwrite', (s) => s.add(scene) as IDBRequest<number>);
}

export async function listScenes(): Promise<SavedScene[]> {
  const all = await tx('readonly', (s) => s.getAll() as IDBRequest<SavedScene[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteScene(id: number): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}
