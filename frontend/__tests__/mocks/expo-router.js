import { vi } from 'vitest';
import React from 'react';

export const useRouter = vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
}));

export const usePathname = vi.fn(() => '/');

export const useLocalSearchParams = vi.fn(() => ({}));
export const useFocusEffect = (effect) => {
    React.useEffect(() => effect(), [effect]);
};

export const Slot = ({ children }) => children;

export const Stack = ({ children }) => children;

export const Link = ({ children }) => children;
