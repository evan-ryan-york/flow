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
    if (!isCapacitor()) {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }

    const Preferences = await getPreferences();
    if (!Preferences) {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }

    const { value } = await Preferences.get({ key });
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isCapacitor()) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    const Preferences = await getPreferences();
    if (!Preferences) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    await Preferences.set({ key, value });
  },

  async removeItem(key: string): Promise<void> {
    if (!isCapacitor()) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }

    const Preferences = await getPreferences();
    if (!Preferences) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }

    await Preferences.remove({ key });
  },
};
