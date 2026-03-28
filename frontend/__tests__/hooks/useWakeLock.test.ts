import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from '@/hooks/useWakeLock';

const mocks = vi.hoisted(() => ({
    activateKeepAwakeAsyncMock: vi.fn(),
    deactivateKeepAwakeMock: vi.fn(),
    appStateAddEventListenerMock: vi.fn(),
}));

describe('useWakeLock', () => {
    beforeEach(() => {
        mocks.activateKeepAwakeAsyncMock.mockReset();
        mocks.deactivateKeepAwakeMock.mockReset();
        mocks.appStateAddEventListenerMock.mockReset();
    });

    it('activates keep awake while enabled on native platforms', async () => {
        let appStateHandler: ((state: string) => void) | null = null;
        const removeMock = vi.fn();

        mocks.appStateAddEventListenerMock.mockImplementation((_event, handler) => {
            appStateHandler = handler;
            return { remove: removeMock };
        });

        const { unmount } = renderHook(() => useWakeLock(true));

        await act(async () => {
            await Promise.resolve();
        });

        expect(mocks.activateKeepAwakeAsyncMock).toHaveBeenCalledWith('FeedsAppWakeLock');

        await act(async () => {
            appStateHandler?.('background');
            await Promise.resolve();
        });

        expect(mocks.deactivateKeepAwakeMock).toHaveBeenCalledWith('FeedsAppWakeLock');

        unmount();

        expect(removeMock).toHaveBeenCalled();
    });

    it('does not activate when disabled', async () => {
        mocks.appStateAddEventListenerMock.mockReturnValue({ remove: vi.fn() });

        renderHook(() => useWakeLock(false));

        await act(async () => {
            await Promise.resolve();
        });

        expect(mocks.activateKeepAwakeAsyncMock).not.toHaveBeenCalled();
        expect(mocks.deactivateKeepAwakeMock).not.toHaveBeenCalled();
    });
});
