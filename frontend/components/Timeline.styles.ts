import { StyleSheet, Platform } from 'react-native';
import { borderRadius, spacing } from '@/theme';

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
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    filterWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light ?? colors.border.DEFAULT,
        paddingVertical: spacing.xs,
    },
    filterScroll: {
        paddingHorizontal: spacing.lg,
        gap: 4,
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
    timerText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
        lineHeight: 12,
        includeFontPadding: false,
        alignSelf: 'center',
    },
    refreshPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.background.secondary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    refreshText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.text.secondary,
    },

    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconButton: {
        padding: spacing.sm,
    },
    list: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
    },
    loader: {
        marginVertical: spacing.xl,
    },
    swipeableContainer: {
        marginBottom: spacing.xs,
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: 'transparent',
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
        width: 76,
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
        right: spacing.md,
        width: 4,
        height: '100%',
        backgroundColor: colors.primary.DEFAULT,
    },
    sidebarBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 900,
    },
    sidebarContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: colors.background.elevated,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
});
