import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, LayoutAnimation, Platform, useWindowDimensions } from 'react-native';
import { useSettingsStore } from '@/stores';
import { useColors, borderRadius, spacing } from '@/theme';
import { Check, Type } from 'lucide-react-native';

type ReaderTheme = 'default' | 'sepia' | 'paper' | 'dark';
type ReaderWidth = 'narrow' | 'comfortable' | 'wide';
type FontSize = 'small' | 'medium' | 'large';
type FontFamily = 'sans' | 'serif';

export const ReaderControls = () => {
    const { settings, updateSettings } = useSettingsStore();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const [isExpanded, setIsExpanded] = useState(false);

    if (!settings) return null;

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded((prev) => !prev);
    };

    const currentFontSize = settings.font_size || 'medium';
    const currentReaderTheme = settings.reader_theme || 'default';
    const currentLineHeight = settings.reader_line_height || 1.6;
    const currentFontFamily = settings.font_family || 'sans';
    const currentWidth = settings.reader_width || 'comfortable';

    const setFontSize = (size: FontSize) => {
        updateSettings({ font_size: size });
    };

    const setTheme = (theme: ReaderTheme) => {
        updateSettings({ reader_theme: theme });
    };

    const setLineHeight = (lineHeight: number) => {
        updateSettings({ reader_line_height: lineHeight });
    };

    const setFontFamily = (family: FontFamily) => {
        updateSettings({ font_family: family });
    };

    const setReaderWidth = (readerWidth: ReaderWidth) => {
        updateSettings({ reader_width: readerWidth });
    };

    const s = styles(colors);
    const isMobileWeb = Platform.OS === 'web' && width < 768;

    return (
        <View style={[s.container, isMobileWeb && { bottom: 85 }]}>
            <View style={[s.pill, isExpanded && s.pillExpanded]}>
                {isExpanded ? (
                    <View style={s.expandedContent}>
                        <View style={s.rowHeader}>
                            <Text style={s.sectionLabel}>Reader</Text>
                            <TouchableOpacity onPress={toggleExpanded} style={s.closeButton} accessibilityLabel="Close reader controls">
                                <Text style={s.closeText}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.section}>
                            <Text style={s.groupLabel}>Text Size</Text>
                            <View style={s.row}>
                                <TouchableOpacity onPress={() => setFontSize('small')} style={[s.iconButton, currentFontSize === 'small' && s.iconButtonActive]} accessibilityLabel="Set text size to small">
                                    <Text style={s.sizeTextSmall}>A</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFontSize('medium')} style={[s.iconButton, currentFontSize === 'medium' && s.iconButtonActive]} accessibilityLabel="Set text size to medium">
                                    <Text style={s.sizeTextMedium}>A</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setFontSize('large')} style={[s.iconButton, currentFontSize === 'large' && s.iconButtonActive]} accessibilityLabel="Set text size to large">
                                    <Text style={s.sizeTextLarge}>A</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={s.section}>
                            <Text style={s.groupLabel}>Font</Text>
                            <View style={s.row}>
                                <TouchableOpacity
                                    onPress={() => setFontFamily('sans')}
                                    style={[s.pillButton, currentFontFamily === 'sans' && s.pillButtonActive]}
                                    accessibilityLabel="Set font family to sans"
                                >
                                    <Text style={[s.pillButtonText, currentFontFamily === 'sans' && s.pillButtonTextActive]}>Sans</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setFontFamily('serif')}
                                    style={[s.pillButton, currentFontFamily === 'serif' && s.pillButtonActive]}
                                    accessibilityLabel="Set font family to serif"
                                >
                                    <Text style={[s.pillButtonText, currentFontFamily === 'serif' && s.pillButtonTextActive]}>Serif</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={s.section}>
                            <Text style={s.groupLabel}>Line Height</Text>
                            <View style={s.row}>
                                <TouchableOpacity
                                    onPress={() => setLineHeight(1.45)}
                                    style={[s.pillButton, currentLineHeight === 1.45 && s.pillButtonActive]}
                                    accessibilityLabel="Set line height to compact"
                                >
                                    <Text style={[s.pillButtonText, currentLineHeight === 1.45 && s.pillButtonTextActive]}>Compact</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setLineHeight(1.6)}
                                    style={[s.pillButton, currentLineHeight === 1.6 && s.pillButtonActive]}
                                    accessibilityLabel="Set line height to comfortable"
                                >
                                    <Text style={[s.pillButtonText, currentLineHeight === 1.6 && s.pillButtonTextActive]}>Comfort</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setLineHeight(1.8)}
                                    style={[s.pillButton, currentLineHeight === 1.8 && s.pillButtonActive]}
                                    accessibilityLabel="Set line height to spacious"
                                >
                                    <Text style={[s.pillButtonText, currentLineHeight === 1.8 && s.pillButtonTextActive]}>Spacious</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={s.section}>
                            <Text style={s.groupLabel}>Width</Text>
                            <View style={s.row}>
                                <TouchableOpacity
                                    onPress={() => setReaderWidth('narrow')}
                                    style={[s.pillButton, currentWidth === 'narrow' && s.pillButtonActive]}
                                    accessibilityLabel="Set reading width to narrow"
                                >
                                    <Text style={[s.pillButtonText, currentWidth === 'narrow' && s.pillButtonTextActive]}>Narrow</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setReaderWidth('comfortable')}
                                    style={[s.pillButton, currentWidth === 'comfortable' && s.pillButtonActive]}
                                    accessibilityLabel="Set reading width to comfortable"
                                >
                                    <Text style={[s.pillButtonText, currentWidth === 'comfortable' && s.pillButtonTextActive]}>Comfort</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setReaderWidth('wide')}
                                    style={[s.pillButton, currentWidth === 'wide' && s.pillButtonActive]}
                                    accessibilityLabel="Set reading width to wide"
                                >
                                    <Text style={[s.pillButtonText, currentWidth === 'wide' && s.pillButtonTextActive]}>Wide</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={s.section}>
                            <Text style={s.groupLabel}>Theme</Text>
                            <View style={s.themeRow}>
                                <TouchableOpacity
                                    onPress={() => setTheme('default')}
                                    style={[
                                        s.themeCircle,
                                        { backgroundColor: colors.background.primary },
                                        currentReaderTheme === 'default' && s.themeCircleActive
                                    ]}
                                    accessibilityLabel="Set reader theme to default"
                                >
                                    {currentReaderTheme === 'default' && <Check size={12} color={colors.primary.DEFAULT} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTheme('sepia')}
                                    style={[
                                        s.themeCircle,
                                        { backgroundColor: '#f4ecd8' },
                                        currentReaderTheme === 'sepia' && s.themeCircleActive
                                    ]}
                                    accessibilityLabel="Set reader theme to sepia"
                                >
                                    {currentReaderTheme === 'sepia' && <Check size={12} color="#5b4636" />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTheme('paper')}
                                    style={[
                                        s.themeCircle,
                                        { backgroundColor: '#fdfcf8' },
                                        currentReaderTheme === 'paper' && s.themeCircleActive
                                    ]}
                                    accessibilityLabel="Set reader theme to paper"
                                >
                                    {currentReaderTheme === 'paper' && <Check size={12} color="#2c3e50" />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTheme('dark')}
                                    style={[
                                        s.themeCircle,
                                        { backgroundColor: '#111827' },
                                        currentReaderTheme === 'dark' && s.themeCircleActive
                                    ]}
                                    accessibilityLabel="Set reader theme to dark"
                                >
                                    {currentReaderTheme === 'dark' && <Check size={12} color="#fff" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity style={s.collapsedTrigger} onPress={toggleExpanded}>
                        <Type size={20} color={colors.text.primary} />
                        <Text style={s.triggerText}>Reader</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: Platform.OS === 'web' ? 40 : 100,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
    },
    pill: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 5,
        elevation: 2,
        minWidth: 180,
    },
    pillExpanded: {
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        minWidth: 330,
        maxWidth: 420,
    },
    collapsedTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    triggerText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text.primary,
        letterSpacing: -0.2,
    },
    expandedContent: {
        gap: spacing.md,
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        color: colors.text.tertiary,
    },
    groupLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    section: {
        gap: spacing.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flexWrap: 'wrap',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.DEFAULT,
        opacity: 0.5,
    },
    iconButton: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    iconButtonActive: {
        backgroundColor: colors.primary.soft ?? `${colors.primary.DEFAULT}18`,
        borderColor: colors.primary.DEFAULT,
    },
    sizeTextSmall: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    sizeTextMedium: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    sizeTextLarge: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
    pillButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    pillButtonActive: {
        backgroundColor: colors.primary.dark,
        borderColor: colors.primary.dark,
    },
    pillButtonText: {
        fontSize: 12,
        color: colors.text.secondary,
        fontWeight: '600',
    },
    pillButtonTextActive: {
        color: colors.text.inverse,
    },
    themeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    themeCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: colors.border.DEFAULT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    themeCircleActive: {
        borderColor: colors.primary.DEFAULT,
    },
    closeButton: {
        alignItems: 'center',
    },
    closeText: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
    }
});
