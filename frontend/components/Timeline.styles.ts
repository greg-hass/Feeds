import { StyleSheet, Platform } from 'react-native';
import { borderRadius, spacing, shadows } from '@/theme';

export const timelineStyles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: 0,
    },
    filterWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        marginTop: -spacing.sm,
        paddingBottom: spacing.md,
    },
    filterScroll: {
        paddingHorizontal: spacing.lg,
        gap: 8,
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginLeft: isMobile ? 40 : 0, // Add space for menu hamburger
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    timerPill: {
        backgroundColor: colors.background.secondary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    timerText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    refreshPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.background.secondary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    refreshText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.text.secondary,
    },
    refreshBarContainer: {
        height: 3,
        backgroundColor: colors.background.secondary,
    },
    refreshBar: {
        height: '100%',
        backgroundColor: colors.primary.DEFAULT,
        borderTopRightRadius: borderRadius.sm,
        borderBottomRightRadius: borderRadius.sm,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    iconButton: {
        padding: spacing.sm,
    },
    list: {
        padding: spacing.lg,
    },
    loader: {
        marginVertical: spacing.xl,
    },
    swipeableContainer: {
        marginBottom: spacing.md,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: colors.background.secondary,
    },
    swipeActionRight: {
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center',
        alignItems: 'flex-end',
        flex: 1,
        borderRadius: borderRadius.xl,
    },
    swipeActionLeft: {
        backgroundColor: '#F59E0B', // Amber 500
        justifyContent: 'center',
        alignItems: 'flex-start',
        flex: 1,
        borderRadius: borderRadius.xl,
    },
    swipeActionButton: {
        width: 80,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    swipeActionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    unreadIndicator: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 4,
        height: '100%',
        backgroundColor: colors.primary.DEFAULT,
    },
});
