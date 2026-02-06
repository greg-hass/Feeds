import { vi } from 'vitest';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}));

// Mock expo modules
vi.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: {
                apiUrl: 'http://localhost:3001/api/v1',
            },
        },
    },
}));

// Mock expo-secure-store
vi.mock('expo-secure-store', () => ({
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
}));
