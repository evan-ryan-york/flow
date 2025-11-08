import type { Metadata, Viewport } from 'next';
import { Providers } from '../lib/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Current',
  description: 'Ultimate task and project management with calendar integration',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // Extends to full screen, respecting safe areas
  interactiveWidget: 'overlays-content', // Keyboard overlays content instead of pushing it up
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Manually inject Tauri initialization for static exports */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Only run in Tauri environment
                if (typeof window === 'undefined') return;

                const isTauri = window.location.protocol === 'tauri:' ||
                               '__TAURI_METADATA__' in window ||
                               '__TAURI_IPC__' in window;

                if (!isTauri) return;

                console.log('🔧 Tauri environment detected, initializing __TAURI_INTERNALS__...');

                // Create the object structure the OAuth plugin expects
                window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};

                // The plugin needs the invoke function to be available
                // Tauri v1 exposes this globally
                if (window.__TAURI__ && window.__TAURI__.tauri && window.__TAURI__.tauri.invoke) {
                  window.__TAURI_INTERNALS__.invoke = window.__TAURI__.tauri.invoke;
                  console.log('✅ __TAURI_INTERNALS__.invoke initialized from __TAURI__');
                }
              })();
            `
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}