// Capacitor-specific storage adapter for Supabase
import type { SupportedStorage } from '@supabase/supabase-js';

// Dynamically import Capacitor Preferences only when needed
async function getPreferences() {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  } catch (_error) {
    console.log('Capacitor Preferences not available, falling back to localStorage');
    return null;
  }
}

// Detect if we're running in Capacitor
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'capacitor:';
}

export const capacitorStorage: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    const operationId = `GET-${Date.now()}`;
    console.log(`[CapStorage] ➡️ GET key: ${key} [${operationId}]`, {
      timestamp: new Date().toISOString(),
      isCapacitor: isCapacitor(),
      stackTrace: new Error().stack?.split('\n').slice(2, 4).join('\n  '),
    });

    if (!isCapacitor()) {
      const value = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      console.log(`[CapStorage] ⬅️ GET key: ${key} [${operationId}] (localStorage fallback, result: ${value ? 'FOUND' : 'NULL'})`);
      return value;
    }

    console.log(`[CapStorage] 🔄 GET key: ${key} [${operationId}] - Importing Preferences...`);
    const Preferences = await getPreferences();
    console.log(`[CapStorage] 🔄 GET key: ${key} [${operationId}] - Preferences imported:`, !!Preferences);

    if (!Preferences) {
      const value = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      console.log(`[CapStorage] ⬅️ GET key: ${key} [${operationId}] (localStorage fallback, result: ${value ? 'FOUND' : 'NULL'})`);
      return value;
    }

    try {
      console.log(`[CapStorage] 🔄 GET key: ${key} [${operationId}] - Calling Preferences.get()...`);
      const result = await Preferences.get({ key });
      console.log(`[CapStorage] 🔄 GET key: ${key} [${operationId}] - Preferences.get() returned`);
      const { value } = result;
      console.log(`[CapStorage] ⬅️ GET key: ${key} [${operationId}] (result: ${value ? 'FOUND' : 'NULL'})`);
      return value;
    } catch (e) {
      console.error(`[CapStorage] ❌ GET key: ${key} [${operationId}] FAILED`, e);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const operationId = `SET-${Date.now()}`;
    const valuePreview = value.substring(0, 50) + (value.length > 50 ? '...' : '');
    console.log(`[CapStorage] ➡️ SET key: ${key} [${operationId}]`, {
      timestamp: new Date().toISOString(),
      isCapacitor: isCapacitor(),
      valueLength: value.length,
      valuePreview,
      stackTrace: new Error().stack?.split('\n').slice(2, 4).join('\n  '),
    });

    if (!isCapacitor()) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      console.log(`[CapStorage] ⬅️ SET key: ${key} [${operationId}] SUCCESS (localStorage fallback)`);
      return;
    }

    console.log(`[CapStorage] 🔄 SET key: ${key} [${operationId}] - Importing Preferences...`);
    const Preferences = await getPreferences();
    console.log(`[CapStorage] 🔄 SET key: ${key} [${operationId}] - Preferences imported:`, !!Preferences);

    if (!Preferences) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      console.log(`[CapStorage] ⬅️ SET key: ${key} [${operationId}] SUCCESS (localStorage fallback)`);
      return;
    }

    try {
      console.log(`[CapStorage] 🔄 SET key: ${key} [${operationId}] - Calling Preferences.set()...`);
      await Preferences.set({ key, value });
      console.log(`[CapStorage] 🔄 SET key: ${key} [${operationId}] - Preferences.set() returned`);
      console.log(`[CapStorage] ⬅️ SET key: ${key} [${operationId}] SUCCESS`);
    } catch (e) {
      console.error(`[CapStorage] ❌ SET key: ${key} [${operationId}] FAILED`, e);
    }
  },

  async removeItem(key: string): Promise<void> {
    const operationId = `REMOVE-${Date.now()}`;
    console.log(`[CapStorage] ➡️ REMOVE key: ${key} [${operationId}]`, {
      timestamp: new Date().toISOString(),
      isCapacitor: isCapacitor(),
      stackTrace: new Error().stack?.split('\n').slice(2, 4).join('\n  '),
    });

    if (!isCapacitor()) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      console.log(`[CapStorage] ⬅️ REMOVE key: ${key} [${operationId}] SUCCESS (localStorage fallback)`);
      return;
    }

    console.log(`[CapStorage] 🔄 REMOVE key: ${key} [${operationId}] - Importing Preferences...`);
    const Preferences = await getPreferences();
    console.log(`[CapStorage] 🔄 REMOVE key: ${key} [${operationId}] - Preferences imported:`, !!Preferences);

    if (!Preferences) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      console.log(`[CapStorage] ⬅️ REMOVE key: ${key} [${operationId}] SUCCESS (localStorage fallback)`);
      return;
    }

    try {
      console.log(`[CapStorage] 🔄 REMOVE key: ${key} [${operationId}] - Calling Preferences.remove()...`);
      await Preferences.remove({ key });
      console.log(`[CapStorage] 🔄 REMOVE key: ${key} [${operationId}] - Preferences.remove() returned`);
      console.log(`[CapStorage] ⬅️ REMOVE key: ${key} [${operationId}] SUCCESS`);
    } catch (e) {
      console.error(`[CapStorage] ❌ REMOVE key: ${key} [${operationId}] FAILED`, e);
    }
  },
};
