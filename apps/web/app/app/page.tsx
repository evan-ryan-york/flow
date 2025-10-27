'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/lib/providers';
import { ThreeColumnLayout } from '@/components/ThreeColumnLayout';

// Tell Next.js this is a client-only page (no SSR/SSG)
export const dynamic = 'force-static';

export default function AppPage() {
  const supabase = useSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
      }
      setLoading(false);
    };

    getUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!userId) {
    return null; // Layout will handle redirect
  }

  return (
    <main className="h-screen overflow-hidden">
      <ThreeColumnLayout userId={userId} />
    </main>
  );
}
