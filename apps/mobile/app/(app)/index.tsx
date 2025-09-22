import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useCurrentProfile } from '@perfect-task-app/data/hooks/useProfile';
import { useSignOut } from '@perfect-task-app/data/hooks/useAuth';

export default function HomeScreen() {
  const { data: profile } = useCurrentProfile();
  const signOutMutation = useSignOut();

  const handleSignOut = () => {
    signOutMutation.mutate();
  };

  return (
    <View className="flex-1 bg-white p-6">
      <View className="flex-row justify-between items-center mb-8">
        <View>
          <Text className="text-2xl font-bold text-gray-900">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}!
          </Text>
          <Text className="text-base text-gray-600 mt-1">
            Ready to get things done?
          </Text>
        </View>

        <Pressable
          onPress={handleSignOut}
          className="px-4 py-2 bg-red-600 rounded-lg active:bg-red-700"
        >
          <Text className="text-white font-medium">
            Sign Out
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 justify-center items-center">
        <Text className="text-lg text-gray-600 text-center">
          Your task management interface will go here.
        </Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          This is where the main app functionality will be implemented.
        </Text>
      </View>
    </View>
  );
}