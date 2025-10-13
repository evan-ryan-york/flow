'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/providers';
import { ThreeColumnLayout } from '@/components/ThreeColumnLayout';
import type { User } from '@supabase/supabase-js';

export default function Dashboard() {
  const supabase = useSupabase();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      console.log('📱 Dashboard: User check result:', {
        hasUser: !!currentUser,
        userId: currentUser?.id,
        email: currentUser?.email
      });

      if (!currentUser) {
        console.log('🔴 No user found, redirecting to login');
        router.push('/login');
        return;
      }

      setUser(currentUser);
      setLoading(false);
    };

    checkUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <ThreeColumnLayout userId={user.id} />;
}
