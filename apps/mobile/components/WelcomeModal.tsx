import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal } from 'react-native';

interface WelcomeModalProps {
  isVisible: boolean;
  defaultName: string;
  onContinue: (name: string) => void;
}

export default function WelcomeModal({ isVisible, defaultName, onContinue }: WelcomeModalProps) {
  const [name, setName] = useState(defaultName);

  const handleContinue = () => {
    if (name.trim()) {
      onContinue(name.trim());
    }
  };

  const isDisabled = !name.trim();

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          zIndex: 1000,
        }}
      >
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text className="text-2xl font-bold text-center mb-2 text-gray-900">
            Welcome to Perfect Task!
          </Text>

          <Text className="text-base text-center mb-6 text-gray-600">
            Let's personalize your experience. Please confirm your name:
          </Text>

          <View className="mb-6">
            <Text className="text-sm font-medium mb-2 text-gray-700">
              Your Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white text-gray-900"
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <Pressable
            onPress={handleContinue}
            disabled={isDisabled}
            className={`w-full py-4 px-6 rounded-lg ${
              isDisabled
                ? 'bg-gray-200'
                : 'bg-blue-600 active:bg-blue-700'
            }`}
          >
            <Text className={`text-lg font-medium text-center ${
              isDisabled ? 'text-gray-400' : 'text-white'
            }`}>
              Continue
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}