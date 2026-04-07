module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['<rootDir>/__tests__/setup.ts'],
    moduleNameMapper: {
        // Map native/expo modules to mocks so they don't break in Node.js
        '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
        '^expo-.*$': '<rootDir>/__mocks__/expo-module.js',
        '^@expo/.*$': '<rootDir>/__mocks__/expo-module.js',
        '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.js',
        '^react-native$': '<rootDir>/__mocks__/react-native.js',
        '^lucide-react-native$': '<rootDir>/__mocks__/expo-module.js',
        '^react-native-.*$': '<rootDir>/__mocks__/expo-module.js',
    },
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react' } }],
    },
    globals: {
        'ts-jest': {
            tsconfig: { jsx: 'react' },
        },
    },
};
