import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, ReactNode } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';

export interface EqualWidthPillItem {
    id: string;
    label: string;
    active: boolean;
    onPress: () => void;
    accessibilityLabel?: string;
    leading?: ReactNode;
}

interface EqualWidthPillsProps {
    items: EqualWidthPillItem[];
    containerStyle?: ViewStyle;
    rowStyle?: ViewStyle;
    pillStyle?: ViewStyle;
    activePillStyle?: ViewStyle;
    textStyle?: TextStyle;
    activeTextStyle?: TextStyle;
    inactiveBackgroundColor?: string;
    activeBackgroundColor?: string;
    inactiveBorderColor?: string;
    activeBorderColor?: string;
    inactiveTextColor?: string;
    activeTextColor?: string;
    textSize?: number;
}

export const EqualWidthPills = React.memo(({
    items,
    containerStyle,
    rowStyle,
    pillStyle,
    activePillStyle,
    textStyle,
    activeTextStyle,
    inactiveBackgroundColor,
    activeBackgroundColor,
    inactiveBorderColor,
    activeBorderColor,
    inactiveTextColor,
    activeTextColor,
    textSize = 11,
}: EqualWidthPillsProps) => {
    const colors = useColors();
    const s = styles(colors);

    const pillInactiveBg = inactiveBackgroundColor ?? colors.background.secondary;
    const pillActiveBg = activeBackgroundColor ?? colors.primary.DEFAULT;
    const pillInactiveBorder = inactiveBorderColor ?? colors.border.DEFAULT;
    const pillActiveBorder = activeBorderColor ?? pillActiveBg;
    const pillInactiveText = inactiveTextColor ?? colors.text.secondary;
    const pillActiveText = activeTextColor ?? colors.text.inverse;

    return (
        <View style={[s.container, containerStyle]}>
            <View style={[s.row, rowStyle]}>
                {items.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[
                            s.pill,
                            { backgroundColor: item.active ? pillActiveBg : pillInactiveBg },
                            { borderColor: item.active ? pillActiveBorder : pillInactiveBorder },
                            pillStyle,
                            item.active && activePillStyle,
                        ]}
                        onPress={item.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={item.accessibilityLabel ?? item.label}
                        accessibilityState={{ selected: item.active }}
                    >
                        {item.leading}
                        <Text
                            style={[
                                s.text,
                                { fontSize: textSize, color: item.active ? pillActiveText : pillInactiveText },
                                textStyle,
                                item.active && activeTextStyle,
                            ]}
                            numberOfLines={1}
                        >
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.items.length === nextProps.items.length &&
        prevProps.items.every((item, index) =>
            item.id === nextProps.items[index]?.id &&
            item.active === nextProps.items[index]?.active &&
            item.label === nextProps.items[index]?.label
        )
    );
});

EqualWidthPills.displayName = 'EqualWidthPills';

const styles = (colors: any) => StyleSheet.create({
    container: {
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        width: '100%',
    },
    pill: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 5,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    text: {
        fontWeight: '700',
        textAlign: 'center',
        minWidth: 0,
        flexShrink: 1,
    },
});

