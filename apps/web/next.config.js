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
  // Enable static export for Capacitor if needed
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,
  trailingSlash: process.env.NEXT_OUTPUT === 'export' ? true : false,
  images: {
    unoptimized: process.env.NEXT_OUTPUT === 'export' ? true : false,
  },
};

module.exports = nextConfig;