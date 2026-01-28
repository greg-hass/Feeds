import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useColors, spacing } from '@/theme';
import { FileText } from 'lucide-react-native';
import BookmarksList from '@/components/BookmarksList';

export default function BookmarksScreen() {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;

    const s = styles(colors);

    if (isMobile) {
        // Mobile: Full screen bookmarks list (handled by its own component)
        return <BookmarksList isMobile={true} />;
    }

    // Desktop: This renders in the reader pane (right column)
    // The BookmarksList is shown in the middle pane via _layout.tsx
    return (
        <View style={s.emptyContainer}>
            <View style={s.emptyState}>
                <FileText size={48} color={colors.text.tertiary} strokeWidth={1.5} />
                <Text style={s.emptyTitle}>No article selected</Text>
                <Text style={s.emptyText}>Select a bookmark to read</Text>
            </View>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    emptyContainer: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.secondary,
        marginTop: spacing.lg,
    },
    emptyText: {
        fontSize: 14,
        color: colors.text.tertiary,
        marginTop: spacing.sm,
    },
});
