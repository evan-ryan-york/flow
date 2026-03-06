import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.perfecttask.app',
  appName: 'Flow',
  webDir: '../web/out', // Points to Next.js static export
  // server: {
  //   // For development, point to Next.js dev server
  //   url: 'http://localhost:3000',
  //   cleartext: true
  // },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '542151415865-7hdkbgmtq6ernhdlpscrm66dgpj1v74b.apps.googleusercontent.com',
      iosClientId: '542151415865-vi9594j0b1nf0slmbup5u75ka3id7m4k.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#3b82f6',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#3b82f6'
    }
  },
  ios: {
    scheme: 'App'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;