import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useColors, spacing, typography } from '@/theme';
import Timeline from '@/components/Timeline';
import { FileText } from 'lucide-react-native';

export default function ArticleListScreen() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;

    const s = styles(colors, isMobile);

    if (!mounted) return null;

    return (
        <View style={s.container}>
            {/* Desktop: Column 3 Content (Empty state - no article selected) */}
            {/* Mobile: Full Screen Timeline (which includes Header) */}

            <View style={s.mainLayout}>
                {isMobile ? (
                    <View style={s.fullPane}>
                        <Timeline />
                    </View>
                ) : (
                    <View style={s.readerPane}>
                        <View style={s.emptyState}>
                            <FileText size={48} color={colors.text.tertiary} strokeWidth={1.5} />
                            <Text style={s.emptyTitle}>No article selected</Text>
                            <Text style={s.emptyText}>Select an article from the list to read</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    mainLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    fullPane: {
        flex: 1,
        width: '100%',
    },
    readerPane: {
        flex: 1,
        height: '100%',
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
