import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    activateKeepAwakeAsyncMock: vi.fn(),
    deactivateKeepAwakeMock: vi.fn(),
}));

vi.mock('expo-keep-awake', () => ({
    activateKeepAwakeAsync: mocks.activateKeepAwakeAsyncMock,
    deactivateKeepAwake: mocks.deactivateKeepAwakeMock,
}));

import { useWakeLock } from '@/hooks/useWakeLock';

describe('useWakeLock', () => {
    beforeEach(() => {
        mocks.activateKeepAwakeAsyncMock.mockReset();
        mocks.deactivateKeepAwakeMock.mockReset();
    });

    it('activates keep awake while enabled in the web test environment', async () => {
        const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        const { unmount } = renderHook(() => useWakeLock(true));

        await act(async () => {
            await Promise.resolve();
        });

        expect(mocks.activateKeepAwakeAsyncMock).toHaveBeenCalledWith('FeedsAppWakeLock');
        expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

        unmount();

        expect(mocks.deactivateKeepAwakeMock).toHaveBeenCalledWith('FeedsAppWakeLock');
        expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });

    it('does not activate when disabled', async () => {
        const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

        renderHook(() => useWakeLock(false));

        await act(async () => {
            await Promise.resolve();
        });

        expect(mocks.activateKeepAwakeAsyncMock).not.toHaveBeenCalled();
        expect(mocks.deactivateKeepAwakeMock).not.toHaveBeenCalled();
        expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

        addEventListenerSpy.mockRestore();
    });
});
