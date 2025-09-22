import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useSegments, useRouter } from 'expo-router';
import { useSession } from '@perfect-task-app/data/hooks/useAuth';
import '../global.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function RootNavigator() {
  const { data: session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return; // Still loading session

    const inAuthGroup = segments[0] === '(auth)';

    if (session?.user && inAuthGroup) {
      // Redirect away from auth screens if logged in
      router.replace('/(app)');
    } else if (!session?.user && !inAuthGroup) {
      // Redirect to auth screens if not logged in
      router.replace('/(auth)/login');
    }
  }, [session, segments, router, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}