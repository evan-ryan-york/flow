/** @type {import('next').NextConfig} */

// Debug: Log environment variables during build
console.log('🔍 Next.js Config - Environment Variables Check (Fresh Build):');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
console.log('All NEXT_PUBLIC_ vars:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')));
console.log('Build timestamp:', new Date().toISOString());
console.log('Vercel deployment test - trigger fresh build');

const nextConfig = {
  experimental: {
    // Enable for server components where needed
  },
  transpilePackages: [
    '@perfect-task-app/data',
    '@perfect-task-app/models',
    '@perfect-task-app/ui'
  ],
  // Enable static export for Capacitor if needed
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,
  trailingSlash: process.env.NEXT_OUTPUT === 'export' ? true : false,
  images: {
    unoptimized: process.env.NEXT_OUTPUT === 'export' ? true : false,
  },
};

module.exports = nextConfig;