// Cross-platform native bridge for Capacitor and Tauri
interface NativeCapabilities {
  share: (data: { text: string; title?: string; url?: string }) => Promise<void>;
  isNative: () => boolean;
  platform: () => 'web' | 'ios' | 'android' | 'desktop';
  haptics: (type: 'light' | 'medium' | 'heavy') => Promise<void>;
  openFile: () => Promise<string | null>;
  notifications: {
    requestPermission: () => Promise<boolean>;
    show: (title: string, body: string) => Promise<void>;
  };
}

export const Native: NativeCapabilities = {
  isNative: () => {
    if (typeof window === 'undefined') return false;

    // Check for Capacitor (mobile)
    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) return true;

    // Check for Tauri (desktop)
    const tauri = (window as any).__TAURI__;
    if (tauri) return true;

    return false;
  },

  platform: () => {
    if (typeof window === 'undefined') return 'web';

    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      return capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    }

    const tauri = (window as any).__TAURI__;
    if (tauri) return 'desktop';

    return 'web';
  },

  share: async (data) => {
    if (typeof window === 'undefined') {
      throw new Error('Share not available on server side');
    }

    // Try Capacitor first (mobile)
    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share(data);
        return;
      } catch (error) {
        console.warn('Capacitor share failed:', error);
      }
    }

    // Try Tauri (desktop)
    const tauri = (window as any).__TAURI__;
    if (tauri) {
      try {
        // Tauri doesn't have built-in share, but we could implement custom logic
        // For now, copy to clipboard
        await navigator.clipboard.writeText(data.text);
        return;
      } catch (error) {
        console.warn('Tauri share failed:', error);
      }
    }

    // Fallback to Web Share API
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if ((error as any).name !== 'AbortError') {
          console.warn('Web share failed:', error);
        }
      }
    }

    // Final fallback - copy to clipboard
    try {
      await navigator.clipboard.writeText(data.text);
      // Could show a toast notification here
    } catch (error) {
      console.error('All share methods failed:', error);
      throw new Error('Share functionality not available');
    }
  },

  haptics: async (type) => {
    if (typeof window === 'undefined') return;

    // Try Capacitor haptics
    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        const impactMap = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy,
        };
        await Haptics.impact({ style: impactMap[type] });
        return;
      } catch (error) {
        console.warn('Capacitor haptics failed:', error);
      }
    }

    // Web vibration fallback
    if ('vibrate' in navigator) {
      const vibrationMap = {
        light: 10,
        medium: 20,
        heavy: 40,
      };
      navigator.vibrate(vibrationMap[type]);
    }
  },

  openFile: async () => {
    if (typeof window === 'undefined') return null;

    // Try Capacitor file picker
    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        // This would require additional setup and permissions
        // For now, return null
        return null;
      } catch (error) {
        console.warn('Capacitor file picker failed:', error);
      }
    }

    // Try Tauri file picker
    const tauri = (window as any).__TAURI__;
    if (tauri) {
      try {
        const { open } = await import('@tauri-apps/api/dialog');
        const result = await open({
          multiple: false,
          filters: [
            {
              name: 'Text',
              extensions: ['txt', 'md', 'json'],
            },
          ],
        });
        return Array.isArray(result) ? result[0] : result;
      } catch (error) {
        console.warn('Tauri file picker failed:', error);
      }
    }

    // Web file picker fallback
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md,.json';

      return new Promise<string | null>((resolve) => {
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          } else {
            resolve(null);
          }
        };
        input.oncancel = () => resolve(null);
        input.click();
      });
    } catch (error) {
      console.error('File picker failed:', error);
      return null;
    }
  },

  notifications: {
    requestPermission: async () => {
      if (typeof window === 'undefined') return false;

      // Try Capacitor push notifications
      const capacitor = (window as any).Capacitor;
      if (capacitor?.isNativePlatform?.()) {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const result = await PushNotifications.requestPermissions();
          return result.receive === 'granted';
        } catch (error) {
          console.warn('Capacitor notifications failed:', error);
        }
      }

      // Try Tauri notifications
      const tauri = (window as any).__TAURI__;
      if (tauri) {
        try {
          const { isPermissionGranted, requestPermission } = await import('@tauri-apps/api/notification');
          let permission = await isPermissionGranted();
          if (!permission) {
            permission = await requestPermission() === 'granted';
          }
          return permission;
        } catch (error) {
          console.warn('Tauri notifications failed:', error);
        }
      }

      // Web notifications fallback
      if ('Notification' in window) {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }

      return false;
    },

    show: async (title, body) => {
      if (typeof window === 'undefined') return;

      // Try Capacitor local notifications
      const capacitor = (window as any).Capacitor;
      if (capacitor?.isNativePlatform?.()) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          await LocalNotifications.schedule({
            notifications: [
              {
                title,
                body,
                id: Date.now(),
                schedule: { at: new Date(Date.now() + 1000) },
              },
            ],
          });
          return;
        } catch (error) {
          console.warn('Capacitor local notifications failed:', error);
        }
      }

      // Try Tauri notifications
      const tauri = (window as any).__TAURI__;
      if (tauri) {
        try {
          const { sendNotification } = await import('@tauri-apps/api/notification');
          await sendNotification({ title, body });
          return;
        } catch (error) {
          console.warn('Tauri notifications failed:', error);
        }
      }

      // Web notifications fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    },
  },
};

export default Native;