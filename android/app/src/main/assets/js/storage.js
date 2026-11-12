/**
 * Quranic Vocabulary App - Persistent Offline IndexedDB Storage
 * Stores 2,000 vocabulary words and user learning records permanently.
 * Bypasses mobile browser localStorage eviction and offline network drops.
 */

const DB_NAME = 'QuranVocabOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';

class OfflineStorage {
  constructor() {
    this.memoryFallback = new Map();
    this.dbPromise = null;
  }

  getDB() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          return reject(new Error('IndexedDB not available'));
        }
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
        } catch (err) {
          reject(err);
        }
      });
    }
    return this.dbPromise;
  }

  async get(key) {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => resolve(this.memoryFallback.get(key) || null);
      });
    } catch (e) {
      return this.memoryFallback.get(key) || null;
    }
  }

  async set(key, val) {
    this.memoryFallback.set(key, val);
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(val, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  async keys() {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys ? store.getAllKeys() : null;
        if (req) {
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve(Array.from(this.memoryFallback.keys()));
        } else {
          resolve(Array.from(this.memoryFallback.keys()));
        }
      });
    } catch (e) {
      return Array.from(this.memoryFallback.keys());
    }
  }

  async has(key) {
    const val = await this.get(key);
    return val !== null && val !== undefined;
  }

  async delete(key) {
    this.memoryFallback.delete(key);
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }
}

export const offlineStorage = new OfflineStorage();
