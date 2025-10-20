'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if this is an OAuth callback (has 'code' parameter)
    const code = searchParams.get('code');

    if (code) {
      // This is an OAuth callback - redirect to auth/callback page
      console.log('🔄 OAuth callback detected at root, redirecting to /auth/callback');
      const fullUrl = window.location.href.replace(window.location.origin, '');
      router.push(`/auth/callback${fullUrl.includes('?') ? fullUrl.substring(fullUrl.indexOf('?')) : ''}`);
    } else {
      // Normal visit - redirect to login
      router.push('/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}