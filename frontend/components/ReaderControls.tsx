import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, LayoutAnimation, Platform, useWindowDimensions } from 'react-native';
import { useSettingsStore } from '@/stores';
import { useColors, borderRadius, spacing } from '@/theme';
import { Type, Minus, Plus, Palette, AlignLeft, Check } from 'lucide-react-native';

export const ReaderControls = () => {
    const { settings, updateSettings } = useSettingsStore();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const [isExpanded, setIsExpanded] = useState(false);

    if (!settings) return null;

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    const setFontSize = (size: 'small' | 'medium' | 'large') => {
        updateSettings({ font_size: size });
    };

    const setFontFamily = (family: 'sans' | 'serif') => {
        updateSettings({ font_family: family });
    };

    const setTheme = (theme: 'default' | 'sepia' | 'paper' | 'dark') => {
        updateSettings({ reader_theme: theme });
    };

    const s = styles(colors);
    const isMobileWeb = Platform.OS === 'web' && width < 768;

    return (
        <View style={[s.container, isMobileWeb && { bottom: 85 }]}>
            <View style={[s.pill, isExpanded && s.pillExpanded]}>
                {isExpanded ? (
                    <View style={s.expandedContent}>
                        {/* Font Family */}
                        <View style={s.section}>
                            <TouchableOpacity
                                style={[s.option, settings.font_family === 'sans' && s.optionActive]}
                                onPress={() => setFontFamily('sans')}
                            >
                                <Text style={[s.optionText, { fontFamily: 'sans-serif' }]}>Sans</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.option, settings.font_family === 'serif' && s.optionActive]}
                                onPress={() => setFontFamily('serif')}
                            >
                                <Text style={[s.optionText, { fontFamily: 'serif' }]}>Serif</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.divider} />

                        {/* Font Size */}
                        <View style={s.section}>
                            <TouchableOpacity onPress={() => setFontSize('small')} style={[s.iconButton, settings.font_size === 'small' && s.iconButtonActive]}>
                                <Text style={s.sizeTextSmall}>A</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setFontSize('medium')} style={[s.iconButton, settings.font_size === 'medium' && s.iconButtonActive]}>
                                <Text style={s.sizeTextMedium}>A</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setFontSize('large')} style={[s.iconButton, settings.font_size === 'large' && s.iconButtonActive]}>
                                <Text style={s.sizeTextLarge}>A</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.divider} />

                        {/* Themes */}
                        <View style={s.section}>
                            <TouchableOpacity onPress={() => setTheme('default')} style={[s.themeCircle, { backgroundColor: colors.background.primary }, settings.reader_theme === 'default' && s.themeCircleActive]}>
                                {settings.reader_theme === 'default' && <Check size={12} color={colors.primary.DEFAULT} />}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTheme('sepia')} style={[s.themeCircle, { backgroundColor: '#f4ecd8' }, settings.reader_theme === 'sepia' && s.themeCircleActive]}>
                                {settings.reader_theme === 'sepia' && <Check size={12} color="#5b4636" />}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTheme('paper')} style={[s.themeCircle, { backgroundColor: '#fdfcf8' }, settings.reader_theme === 'paper' && s.themeCircleActive]}>
                                {settings.reader_theme === 'paper' && <Check size={12} color="#2c3e50" />}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={toggleExpanded} style={s.closeButton}>
                            <Text style={s.closeText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={s.collapsedTrigger} onPress={toggleExpanded}>
                        <Type size={20} color={colors.text.primary} />
                        <Text style={s.triggerText}>Appearance</Text>
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
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        minWidth: 160,
    },
    pillExpanded: {
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        minWidth: 320,
    },
    collapsedTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    triggerText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text.primary,
        letterSpacing: -0.2,
    },
    expandedContent: {
        gap: spacing.xl,
    },
    section: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.lg,
    },
    option: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    optionActive: {
        borderColor: colors.primary.DEFAULT,
        backgroundColor: colors.primary.DEFAULT + '11',
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border.DEFAULT,
        opacity: 0.5,
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.md,
    },
    iconButtonActive: {
        backgroundColor: colors.primary.DEFAULT + '11',
    },
    sizeTextSmall: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    sizeTextMedium: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    sizeTextLarge: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
    themeCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
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
        paddingTop: spacing.sm,
    },
    closeText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
    }
});
