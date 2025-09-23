import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignInWithGoogleIdToken } from '@perfect-task-app/data/hooks/useAuth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { supabase } from '@perfect-task-app/data/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const signInMutation = useSignInWithGoogleIdToken();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId || 'placeholder-client-id',
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId || 'placeholder-ios-client-id',
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId || 'placeholder-android-client-id',
    webClientId: Constants.expoConfig?.extra?.googleWebClientId || 'placeholder-web-client-id',
  });

  // Debug: Log the actual client IDs being used (only once when request is ready)
  useEffect(() => {
    if (request) {
      console.log('Google OAuth Config:', {
        clientId: Constants.expoConfig?.extra?.googleClientId,
        webClientId: Constants.expoConfig?.extra?.googleWebClientId,
        platform: Platform.OS,
        requestReady: !!request
      });
    }
  }, [request]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;

      if (id_token) {
        setIsLoading(true);
        signInMutation.mutate(id_token, {
          onSuccess: () => {
            console.log('Google sign-in successful');
            setIsLoading(false);
          },
          onError: (error) => {
            console.error('Google sign-in error:', error);
            Alert.alert('Sign In Error', 'Failed to sign in with Google. Please try again.');
            setIsLoading(false);
          },
        });
      }
    } else if (response?.type === 'error') {
      console.error('Google auth error:', response.error);
      Alert.alert('Authentication Error', 'Google authentication failed. Please try again.');
    }
  }, [response, signInMutation]);

  // Listen for auth state changes (for OAuth success)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Login screen auth state change:', { event, hasSession: !!session });

      if (event === 'SIGNED_IN' && session) {
        console.log('OAuth sign-in successful, invalidating queries...');
        // Invalidate all auth-related queries to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['auth'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setIsLoading(false);
        // The router should automatically redirect to (app) layout
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const handleGoogleSignIn = async () => {
    console.log('handleGoogleSignIn clicked');

    if (!request) {
      console.log('Request not ready');
      Alert.alert('Error', 'Google authentication is not ready. Please try again.');
      return;
    }

    console.log('Starting Google auth prompt...');
    setIsLoading(true);
    try {
      const result = await promptAsync();
      console.log('Google auth result:', result);
    } catch (error) {
      console.error('Google auth prompt error:', error);
      Alert.alert('Error', 'Failed to start Google authentication.');
      setIsLoading(false);
    }
  };

  const handleSupabaseGoogleSignIn = async () => {
    console.log('handleSupabaseGoogleSignIn clicked');
    console.log('Constants.linkingUri:', Constants.linkingUri);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
      });

      console.log('Supabase Google auth result:', { data, error });

      if (error) {
        console.error('Supabase Google auth error:', error);
        Alert.alert('Sign In Error', error.message);
        setIsLoading(false);
        return;
      }

      // For mobile, manually open the OAuth URL
      if (data?.url && Platform.OS !== 'web') {
        console.log('Opening OAuth URL:', data.url);
        const result = await WebBrowser.openBrowserAsync(data.url);
        console.log('WebBrowser result:', result);

        if (result.type === 'success') {
          // The auth state change listener will handle the session
          console.log('OAuth completed successfully');
        } else {
          console.log('OAuth cancelled or failed:', result);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Supabase Google auth error:', error);
      Alert.alert('Sign In Error', 'Failed to sign in with Google.');
      setIsLoading(false);
    }
  };

  return (
    <View
      className="flex-1 bg-white justify-center items-center px-6"
      style={{ paddingTop: insets.top + 20 }}
    >
      <View className="w-full max-w-sm">
        <Text className="text-3xl font-bold text-center mb-2 text-gray-900">
          Welcome to Perfect Task
        </Text>
        <Text className="text-base text-center mb-8 text-gray-600">
          Sign in to get started with your task management
        </Text>

        <Pressable
          onPress={handleGoogleSignIn}
          disabled={isLoading || !request}
          className={`w-full py-6 px-6 rounded-lg border-2 border-gray-300 flex-row items-center justify-center ${
            isLoading || !request ? 'opacity-50' : 'active:bg-gray-50'
          }`}
          style={{ marginBottom: 40 }}
        >
          <Text className={`text-lg font-semibold ${
            isLoading || !request ? 'text-gray-400' : 'text-gray-900'
          }`}>
            {isLoading ? 'Signing in...' : 'Sign in with Google (Expo)'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSupabaseGoogleSignIn}
          disabled={isLoading}
          className={`w-full py-6 px-6 rounded-lg bg-blue-600 flex-row items-center justify-center ${
            isLoading ? 'opacity-50' : 'active:bg-blue-700'
          }`}
        >
          <Text className={`text-lg font-semibold ${
            isLoading ? 'text-blue-200' : 'text-white'
          }`}>
            {isLoading ? 'Signing in...' : 'Sign in with Google (Supabase)'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}