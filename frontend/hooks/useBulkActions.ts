import { useState } from 'react';
import { Alert } from 'react-native';
import { api, Feed } from '@/services/api';
import { useFeedStore } from '@/stores/feedStore';
import { useArticleStore } from '@/stores/articleStore';
import { useToastStore } from '@/stores/toastStore';

interface UseBulkActionsProps {
    onRefresh: () => void;
}

export function useBulkActions({ onRefresh }: UseBulkActionsProps) {
    const feedStore = useFeedStore();
    const { show } = useToastStore();
    const [selectedFeedIds, setSelectedFeedIds] = useState<Set<number>>(new Set());

    const toggleSelectFeed = (id: number) => {
        const next = new Set(selectedFeedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedFeedIds(next);
    };

    const handleSelectAll = (visibleCount: number, visibleFeeds: Feed[]) => {
        if (selectedFeedIds.size === visibleCount) {
            setSelectedFeedIds(new Set());
        } else {
            setSelectedFeedIds(new Set(visibleFeeds.map(f => f.id)));
        }
    };

    const handleBulkDelete = () => {
        if (selectedFeedIds.size === 0) return;

        Alert.alert(
            'Bulk Delete',
            `Delete ${selectedFeedIds.size} selected feeds?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.bulkFeedAction('delete', Array.from(selectedFeedIds));
                            onRefresh();
                            setSelectedFeedIds(new Set());
                            show(`Deleted ${selectedFeedIds.size} feeds`, 'success');
                        } catch (err) {
                            show('Bulk delete failed', 'error');
                        }
                    }
                }
            ]
        );
    };

    const handleBulkMove = (onOpenModal: () => void) => {
        if (selectedFeedIds.size === 0) return;
        onOpenModal();
    };

    const confirmBulkMove = async (folderId: number | null) => {
        if (selectedFeedIds.size === 0) return;

        try {
            await api.bulkFeedAction('move', Array.from(selectedFeedIds), folderId);
            onRefresh();
            setSelectedFeedIds(new Set());
            show('Feeds moved', 'success');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to move feeds';
            show(errorMsg, 'error');
        }
    };

    return {
        selectedFeedIds,
        toggleSelectFeed,
        handleSelectAll,
        handleBulkDelete,
        handleBulkMove,
        confirmBulkMove,
        setSelectedFeedIds,
    };
}
