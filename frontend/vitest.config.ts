import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
        setupFiles: ['./__tests__/setup.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
            // React Native / Expo module aliases
            'react-native': 'react-native-web',
            'react-native/Libraries/Animated/NativeAnimatedHelper': path.resolve(__dirname, '__tests__/mocks/empty.js'),
            '@react-native-async-storage/async-storage': path.resolve(__dirname, '__tests__/mocks/async-storage.js'),
            'expo-av': path.resolve(__dirname, '__tests__/mocks/expo-av.js'),
            'expo-constants': path.resolve(__dirname, '__tests__/mocks/expo-constants.js'),
            'expo-keep-awake': path.resolve(__dirname, '__tests__/mocks/expo-keep-awake.js'),
            'expo-router': path.resolve(__dirname, '__tests__/mocks/expo-router.js'),
        },
    },
});
