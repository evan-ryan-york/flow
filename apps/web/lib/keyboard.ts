// Keyboard configuration for Capacitor mobile apps
import { Keyboard, KeyboardStyle } from '@capacitor/keyboard';

export async function initializeKeyboard() {
  // Check if we're in a Capacitor environment
  if (typeof window === 'undefined') return;

  const isCapacitor =
    window.location.protocol === 'capacitor:' ||
    '__CAPACITOR__' in window;

  if (!isCapacitor) return;

  try {
    // Configure keyboard to overlay content instead of resizing
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
    await Keyboard.setScroll({ isDisabled: true });
    await Keyboard.setStyle({ style: KeyboardStyle.Dark });

    console.log('✅ Keyboard configured for overlay mode');
  } catch (error) {
    console.error('❌ Error configuring keyboard:', error);
  }
}
