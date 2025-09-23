import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Slot } from 'expo-router';
import { useSession } from '@perfect-task-app/data/hooks/useAuth';
import { useCurrentProfile, useUpdateProfile } from '@perfect-task-app/data/hooks/useProfile';
import { supabase } from '@perfect-task-app/data/supabase';
import WelcomeModal from '../../components/WelcomeModal';

export default function AppLayout() {
  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: profile, isLoading: profileLoading } = useCurrentProfile();
  const updateProfileMutation = useUpdateProfile();

  // Show loading while we determine auth state
  if (sessionLoading || profileLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-lg text-gray-600">Loading...</Text>
      </View>
    );
  }

  // If no session, redirect to login (this should be handled by router guards)
  if (!session?.user) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-lg text-gray-600">Please sign in to continue</Text>
      </View>
    );
  }

  // Show error if profile couldn't be loaded
  if (!profile) {
    return (
      <View className="flex-1 bg-white justify-center items-center px-6">
        <Text className="text-lg text-red-600 text-center mb-6">
          Failed to load profile. You may have signed in before the database trigger was created.
        </Text>
        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
            // The session hook will handle the redirect to login
          }}
          className="bg-blue-600 px-6 py-3 rounded-lg"
        >
          <Text className="text-white font-medium">
            Sign Out & Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  const needsOnboarding = !profile.first_name;

  // Get display name from user metadata for pre-filling the modal
  const defaultName = session.user.user_metadata?.full_name ||
                     session.user.user_metadata?.name ||
                     session.user.email?.split('@')[0] ||
                     '';

  const handleWelcomeContinue = (firstName: string) => {
    updateProfileMutation.mutate({
      firstName: firstName,
    });
  };

  return (
    <View className="flex-1">
      {/* Logout Button - Fixed Position */}
      <View className="absolute top-12 right-4 z-50">
        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
          }}
          className="bg-red-500 px-3 py-2 rounded-lg shadow-lg"
        >
          <Text className="text-white font-medium text-sm">
            Logout
          </Text>
        </Pressable>
      </View>

      <Slot />

      {needsOnboarding && (
        <WelcomeModal
          isVisible={true}
          defaultName={defaultName}
          onContinue={handleWelcomeContinue}
        />
      )}
    </View>
  );
}