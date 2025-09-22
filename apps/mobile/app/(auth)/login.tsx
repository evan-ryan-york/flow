import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useSignInWithGoogleIdToken } from '@perfect-task-app/data/hooks/useAuth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const signInMutation = useSignInWithGoogleIdToken();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

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

  const handleGoogleSignIn = async () => {
    if (!request) {
      Alert.alert('Error', 'Google authentication is not ready. Please try again.');
      return;
    }

    setIsLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error('Google auth prompt error:', error);
      Alert.alert('Error', 'Failed to start Google authentication.');
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white justify-center items-center px-6">
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
          className={`w-full py-4 px-6 rounded-lg border border-gray-300 flex-row items-center justify-center ${
            isLoading || !request ? 'opacity-50' : 'active:bg-gray-50'
          }`}
        >
          {!isLoading ? (
            <>
              <Text className="text-lg font-medium text-gray-900 ml-3">
                Sign in with Google
              </Text>
            </>
          ) : (
            <Text className="text-lg font-medium text-gray-600">
              Signing in...
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}