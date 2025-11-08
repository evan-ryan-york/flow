'use client';

console.log('📦 Dashboard page MODULE loading - Step 1');

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

console.log('📦 Dashboard page MODULE loading - Step 2: React imports done');

console.log('📦 Dashboard page MODULE loading - Step 3: imports done');

import type { User } from '@supabase/supabase-js';
import { ThreeColumnLayout } from '@/components/ThreeColumnLayout';

console.log('📦 Dashboard page MODULE loaded');

export default function Dashboard() {
  console.log('🎯 Dashboard component rendering');

  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔍 Auth check useEffect running');
    let isMounted = true;
    let authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

    const checkUser = async () => {
      try {
        console.log('📡 Checking for user authentication...');

        // CAPACITOR WORKAROUND: Check for separately stored user data first
        // This bypasses Supabase's session loading which hangs in Capacitor
        if (typeof window !== 'undefined' && window.location.protocol === 'capacitor:') {
          console.log('🔍 Capacitor detected, checking for stored user data...');
          try {
            const { Preferences } = await import('@capacitor/preferences');
            const { value } = await Preferences.get({ key: 'perfect-task-user-data' });

            if (value) {
              console.log('✅ Found stored user data!');
              const userData = JSON.parse(value);

              // Create a minimal User object that matches Supabase's User type
              const user = {
                id: userData.id,
                aud: 'authenticated',
                role: 'authenticated',
                email: userData.email,
                email_confirmed_at: new Date().toISOString(),
                phone: '',
                confirmed_at: new Date().toISOString(),
                last_sign_in_at: new Date().toISOString(),
                app_metadata: {},
                user_metadata: userData.user_metadata || {},
                identities: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              console.log('✅ User authenticated from stored data:', user.email);
              if (isMounted) {
                setUser(user as User);
                setLoading(false);
              }
              return; // Skip Supabase session loading
            } else {
              console.log('❌ No stored user data found, redirecting to login');
              if (isMounted) router.push('/login');
              return;
            }
          } catch (err) {
            console.error('❌ Error loading stored user data:', err);
            // Fall through to Supabase session loading
          }
        }

        // NON-CAPACITOR: Use standard Supabase session loading
        console.log('📡 Setting up Supabase auth state listener...');

        const { getSupabaseClient } = await import('@perfect-task-app/data');
        console.log('✅ getSupabaseClient imported');

        const supabase = getSupabaseClient();
        console.log('✅ supabase client retrieved');

        // APPROACH: Use onAuthStateChange instead of getSession()
        // This waits for the auth client to finish loading the session from storage
        console.log('🔵 Setting up onAuthStateChange listener...');

        let timeoutId: NodeJS.Timeout | null = null;

        authSubscription = supabase.auth.onAuthStateChange((event, session) => {
          console.log('🔔 Auth state change event:', event, {
            hasSession: !!session,
            email: session?.user?.email,
          });

          // Clear timeout if we get a response
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (!isMounted) {
            console.log('⚠️  Component unmounted, ignoring auth state change');
            return;
          }

          // Handle different auth events
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session && session.user) {
              console.log('✅ User authenticated:', session.user.email);
              setUser(session.user);
              setLoading(false);
            } else {
              console.log('🔴 No session in event, redirecting to login');
              router.push('/login');
            }
          } else if (event === 'SIGNED_OUT') {
            console.log('🔴 User signed out, redirecting to login');
            router.push('/login');
          }
        });

        console.log('✅ Auth listener set up');

        // Set a timeout in case onAuthStateChange never fires
        timeoutId = setTimeout(() => {
          console.error('⏱️  Timeout waiting for auth state change, checking session manually...');

          // Fallback to getSession() after timeout
          supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
              console.error('🔴 Error getting session:', error);
              if (isMounted) router.push('/login');
              return;
            }

            if (session && session.user) {
              console.log('✅ User authenticated from fallback getSession:', session.user.email);
              if (isMounted) {
                setUser(session.user);
                setLoading(false);
              }
            } else {
              console.log('🔴 No session found in fallback, redirecting to login');
              if (isMounted) router.push('/login');
            }
          }).catch((err) => {
            console.error('💥 Error in fallback getSession:', err);
            if (isMounted) router.push('/login');
          });
        }, 5000);

      } catch (err) {
        console.error('💥 Error setting up auth check:', err);
        if (isMounted) router.push('/login');
      }
    };

    checkUser();

    return () => {
      console.log('🧹 Cleaning up auth check useEffect');
      isMounted = false;
      if (authSubscription) {
        console.log('🧹 Unsubscribing from auth state changes');
        authSubscription.data.subscription.unsubscribe();
      }
    };
  }, [router]);

  if (loading) {
    console.log('⏳ Rendering loading state');
    return (
      <div style={{
        padding: '40px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    console.log('❌ No user, returning null');
    return null;
  }

  console.log('✅ User authenticated:', user.email);
  console.log('🎨 Rendering ThreeColumnLayout');

  return <ThreeColumnLayout userId={user.id} />;
}
