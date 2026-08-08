import { MAX_RECOVERY_SNAPSHOTS, pruneRecoverySnapshots } from './domain.js?v=6.44.1';

const DATABASE_NAME = 'lionsPortalRecovery';
const STORE_NAME = 'snapshots';
const DATABASE_VERSION = 1;
const FALLBACK_KEY = 'lionsCandidoMota.recovery.snapshots.v1';

function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createLocalStorageAdapter(storage, maximum) {
  const readAll = () => {
    try {
      const parsed = JSON.parse(storage?.getItem(FALLBACK_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const writeAll = snapshots => {
    storage.setItem(FALLBACK_KEY, JSON.stringify(pruneRecoverySnapshots(snapshots, maximum)));
  };

  return {
    mode: 'localstorage',
    async list() { return pruneRecoverySnapshots(readAll(), maximum).map(cloneValue); },
    async get(id) { return cloneValue(readAll().find(item => item.id === id) || null); },
    async put(snapshot) {
      const snapshots = readAll().filter(item => item.id !== snapshot.id);
      snapshots.push(cloneValue(snapshot));
      writeAll(snapshots);
      return cloneValue(snapshot);
    },
    async remove(id) { writeAll(readAll().filter(item => item.id !== id)); },
    async clear() { storage.removeItem(FALLBACK_KEY); }
  };
}

function openDatabase(indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento de recuperação.'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionRequest(database, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try {
      result = action(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onerror = () => reject(transaction.error || result?.error || new Error('Falha no armazenamento de recuperação.'));
    transaction.onabort = () => reject(transaction.error || new Error('Operação de recuperação cancelada.'));
  });
}

function createIndexedDbAdapter(database, maximum) {
  const list = async () => {
    const snapshots = await transactionRequest(database, 'readonly', store => store.getAll());
    return pruneRecoverySnapshots(snapshots || [], maximum);
  };
  return {
    mode: 'indexeddb',
    list,
    async get(id) {
      const snapshot = await transactionRequest(database, 'readonly', store => store.get(id));
      return snapshot ? cloneValue(snapshot) : null;
    },
    async put(snapshot) {
      await transactionRequest(database, 'readwrite', store => store.put(cloneValue(snapshot)));
      const snapshots = await list();
      const keep = new Set(snapshots.map(item => item.id));
      const all = await transactionRequest(database, 'readonly', store => store.getAll());
      const obsolete = (all || []).filter(item => !keep.has(item.id));
      if (obsolete.length) {
        await transactionRequest(database, 'readwrite', store => {
          obsolete.forEach(item => store.delete(item.id));
        });
      }
      return cloneValue(snapshot);
    },
    async remove(id) { await transactionRequest(database, 'readwrite', store => store.delete(id)); },
    async clear() { await transactionRequest(database, 'readwrite', store => store.clear()); }
  };
}

export async function createRecoverySnapshotStore({
  indexedDB = globalThis.indexedDB,
  fallbackStorage = globalThis.localStorage,
  maximum = MAX_RECOVERY_SNAPSHOTS
} = {}) {
  if (indexedDB?.open) {
    try {
      const database = await openDatabase(indexedDB);
      return createIndexedDbAdapter(database, maximum);
    } catch (error) {
      console.warn('IndexedDB indisponível; usando armazenamento local reduzido.', error);
    }
  }
  if (!fallbackStorage?.getItem || !fallbackStorage?.setItem) {
    throw new TypeError('Nenhum armazenamento de recuperação está disponível.');
  }
  return createLocalStorageAdapter(fallbackStorage, Math.min(maximum, 4));
}

export function createMemoryRecoveryStore(initial = [], maximum = MAX_RECOVERY_SNAPSHOTS) {
  let snapshots = pruneRecoverySnapshots(initial, maximum).map(cloneValue);
  return {
    mode: 'memory',
    async list() { return snapshots.map(cloneValue); },
    async get(id) { return cloneValue(snapshots.find(item => item.id === id) || null); },
    async put(snapshot) {
      snapshots = pruneRecoverySnapshots([
        cloneValue(snapshot),
        ...snapshots.filter(item => item.id !== snapshot.id)
      ], maximum);
      return cloneValue(snapshot);
    },
    async remove(id) { snapshots = snapshots.filter(item => item.id !== id); },
    async clear() { snapshots = []; }
  };
}
