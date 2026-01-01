import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, Platform } from 'react-native';

// Use localhost for iOS simulator, 10.0.2.2 for Android Emulator, or your machine IP for physical device
const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/auth/login' : 'http://localhost:3000/auth/login';

export default function App() {
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const handleLogin = async () => {
    if (!employeeId || !pin) {
      Alert.alert('Error', 'Please enter both ID and PIN');
      return;
    }

    setLoading(true);
    try {
      console.log(`Attempting login to ${API_URL}`);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeId,
          pin: pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      console.log('Login successful', data);
      setUser(data.user);
    } catch (error) {
      console.error(error);
      Alert.alert('Login Failed', error.message || 'Connection error. Check backend URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setEmployeeId('');
    setPin('');
  };

  if (user) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.innerContainer}>
          <Text style={styles.title}>Welcome, {user.name}!</Text>
          {user.job_title ? <Text style={styles.subtitle}>{user.job_title}</Text> : null}
          {user.department ? <Text style={styles.category}>{user.department}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.successText}>Integration Bridge Active ✅</Text>
            <Text style={styles.infoText}>User ID: {user.id}</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </SafeAreaView>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.innerContainer}>
        <Text style={styles.header}>Shadow Portal</Text>
        <Text style={styles.subHeader}>Employee Login</Text>

        <TextInput
          style={styles.input}
          placeholder="Employee ID (e.g. EMP001)"
          value={employeeId}
          onChangeText={setEmployeeId}
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
        <TextInput
          style={styles.input}
          placeholder="PIN (x_app_password)"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="numeric"
          placeholderTextColor="#999"
        />

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  innerContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 18,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 48,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Welcome Screen
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  category: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  successText: {
    fontSize: 18,
    color: '#34C759',
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#666',
  }
});
