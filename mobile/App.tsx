/// <reference types="nativewind/types" />
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, TouchableOpacity } from 'react-native';
import { useStore } from './src/store/useStore';
import { apiClient } from './src/api/client'; // Import API client
import { API_URL } from './src/config';

export default function App() {
  const { count, increment, reset } = useStore();
  const [serverMessage, setServerMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setServerMessage('');
    try {
      // Assuming GET /products is a safe read-only endpoint to test, or we can just try /
      // Let's try to fetch products as a real test
      const data = await apiClient.get('/products');
      setServerMessage(`✅ Success! Connected to ${API_URL}\nFound ${data.products ? data.products.length : 0} products.`);
    } catch (error: any) {
      setServerMessage(`❌ Error connecting to ${API_URL}\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-gray-100">
      <Text className="text-2xl font-bold text-gray-800 mb-4">
        Expo + TypeScript + NativeWind
      </Text>

      <View className="bg-white p-6 rounded-lg shadow-md w-4/5 items-center mb-6">
        <Text className="text-xl mb-4 text-gray-700">Zustand Count: {count}</Text>

        <TouchableOpacity
          className="bg-blue-500 py-3 px-6 rounded-full mb-2 w-full items-center"
          onPress={increment}
        >
          <Text className="text-white font-semibold">Increment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-red-500 py-3 px-6 rounded-full w-full items-center"
          onPress={reset}
        >
          <Text className="text-white font-semibold">Reset</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-white p-6 rounded-lg shadow-md w-4/5 items-center">
        <Text className="text-lg font-bold mb-2">Backend Connection</Text>
        <Text className="text-xs text-gray-500 mb-4">{API_URL}</Text>

        <TouchableOpacity
          className={`py-3 px-6 rounded-full w-full items-center ${loading ? 'bg-gray-400' : 'bg-green-600'}`}
          onPress={testConnection}
          disabled={loading}
        >
          <Text className="text-white font-semibold">{loading ? 'Connecting...' : 'Test Connection'}</Text>
        </TouchableOpacity>

        {serverMessage ? (
          <Text className="mt-4 text-center text-gray-700">{serverMessage}</Text>
        ) : null}
      </View>

      <StatusBar style="auto" />
    </View>
  );
}
