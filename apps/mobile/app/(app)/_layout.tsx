import React from 'react';
import { View, Text } from 'react-native';
import { Slot } from 'expo-router';
import { useSession } from '@perfect-task-app/data/hooks/useAuth';
import { useCurrentProfile, useUpdateProfile } from '@perfect-task-app/data/hooks/useProfile';
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
        <Text className="text-lg text-red-600 text-center">
          Failed to load profile. Please try restarting the app.
        </Text>
      </View>
    );
  }

  const needsOnboarding = !profile.full_name;

  // Get display name from user metadata for pre-filling the modal
  const defaultName = session.user.user_metadata?.full_name ||
                     session.user.user_metadata?.name ||
                     session.user.email?.split('@')[0] ||
                     '';

  const handleWelcomeContinue = (fullName: string) => {
    updateProfileMutation.mutate({
      fullName: fullName,
    });
  };

  return (
    <>
      <Slot />

      {needsOnboarding && (
        <WelcomeModal
          isVisible={true}
          defaultName={defaultName}
          onContinue={handleWelcomeContinue}
        />
      )}
    </>
  );
}