import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimelineScroll, __timelineScrollTestUtils } from '@/hooks/useTimelineScroll';

const prefetchArticle = vi.fn();

describe('useTimelineScroll', () => {
    const articles = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
    ];

    beforeEach(() => {
        prefetchArticle.mockReset();
        __timelineScrollTestUtils.clearSnapshots();
    });

    it('keys scroll snapshots by timeline filter', () => {
        expect(__timelineScrollTestUtils.getScrollKey({})).toBe('timeline:all');
        expect(__timelineScrollTestUtils.getScrollKey({ unread_only: true })).toBe('timeline:unread');
        expect(
            __timelineScrollTestUtils.getScrollKey({
                unread_only: true,
                type: 'reddit',
                feed_id: 12,
                folder_id: 4,
            })
        ).toBe('timeline:unread:type:reddit:feed:12:folder:4');
    });

    it('restores using the saved anchor snapshot after remount', async () => {
        const flatListMock = {
            scrollToIndex: vi.fn(),
            scrollToOffset: vi.fn(),
        };

        __timelineScrollTestUtils.setSnapshot('timeline:unread', {
            absoluteOffset: 540,
            anchorArticleId: 3,
            restoreArticleId: null,
        });

        const secondMount = renderHook(({ items }) =>
            useTimelineScroll(items, { unread_only: true }),
        {
            initialProps: { items: articles },
        });

        act(() => {
            secondMount.result.current.attachFlatListRef(flatListMock as any);
        });

        secondMount.rerender({ items: [...articles] });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 220));
        });

        expect(flatListMock.scrollToOffset).toHaveBeenCalledWith({
            offset: 540,
            animated: false,
        });
        expect(flatListMock.scrollToIndex).not.toHaveBeenCalled();
    });

    it('keeps the same anchor article visible when new items are prepended', async () => {
        const flatListMock = {
            scrollToIndex: vi.fn(),
            scrollToOffset: vi.fn(),
        };

        __timelineScrollTestUtils.setSnapshot('timeline:unread', {
            absoluteOffset: 420,
            anchorArticleId: 3,
            restoreArticleId: null,
        });

        const { result, rerender } = renderHook(({ items }) =>
            useTimelineScroll(items, { unread_only: true }),
        {
            initialProps: { items: articles },
        });

        act(() => {
            result.current.attachFlatListRef(flatListMock as any);
        });

        rerender({ items: [...articles] });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 220));
        });

        flatListMock.scrollToIndex.mockClear();
        flatListMock.scrollToOffset.mockClear();

        act(() => {
            result.current.prepareForNewArticles(2);
        });

        rerender({ items: [{ id: 10 }, { id: 11 }, ...articles] });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 180));
        });

        expect(flatListMock.scrollToIndex).toHaveBeenCalledWith({
            index: 4,
            animated: false,
            viewPosition: 0,
        });
        expect(flatListMock.scrollToOffset).not.toHaveBeenCalled();
    });

    it('restores to the opened article when a restore target exists', async () => {
        const flatListMock = {
            scrollToIndex: vi.fn(),
            scrollToOffset: vi.fn(),
        };

        __timelineScrollTestUtils.setSnapshot('timeline:unread', {
            absoluteOffset: 540,
            anchorArticleId: 2,
            restoreArticleId: 3,
        });

        const mount = renderHook(({ items }) =>
            useTimelineScroll(items, { unread_only: true }),
        {
            initialProps: { items: articles },
        });

        act(() => {
            mount.result.current.attachFlatListRef(flatListMock as any);
        });

        mount.rerender({ items: [...articles] });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(flatListMock.scrollToIndex).toHaveBeenCalledWith({
            index: 2,
            animated: false,
            viewPosition: 0,
        });
        expect(flatListMock.scrollToOffset).not.toHaveBeenCalled();

        act(() => {
            mount.result.current.onViewableItemsChanged({
                viewableItems: [
                    {
                        isViewable: true,
                        index: 2,
                        item: { id: 3 },
                    },
                ],
            });
        });

        expect(__timelineScrollTestUtils.getSnapshot('timeline:unread').restoreArticleId).toBeNull();
    });
});
