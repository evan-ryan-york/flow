const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file in the root directory
const result = dotenv.config({ path: path.join(__dirname, '../../.env') });

if (result.error) {
  console.error('Failed to load .env file:', result.error);
} else {
  console.log('Successfully loaded .env file');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'loaded' : 'missing');
  console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'loaded' : 'missing');
}

export default {
  expo: {
    name: "mobile",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    scheme: "perfect-task-app",
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID || 'temporary-web-client-id',
    }
  }
};