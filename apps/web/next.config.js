/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable for server components where needed
  },
  transpilePackages: [
    '@perfect-task-app/data',
    '@perfect-task-app/models',
    '@perfect-task-app/ui'
  ],
  // Explicitly expose environment variables to the client
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Enable static export for Capacitor if needed
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,
  trailingSlash: process.env.NEXT_OUTPUT === 'export' ? true : false,
  images: {
    unoptimized: process.env.NEXT_OUTPUT === 'export' ? true : false,
  },
};

module.exports = nextConfig;