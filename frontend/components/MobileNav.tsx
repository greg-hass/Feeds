import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Search, Bookmark, Rss, Settings, Sparkles } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

interface NavItem {
    icon: typeof Home;
    label: string;
    path: string;
}

const navItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/(app)' },
    { icon: Sparkles, label: 'Discover', path: '/(app)/discovery' },
    { icon: Bookmark, label: 'Saved', path: '/(app)/bookmarks' },
    { icon: Rss, label: 'Manage', path: '/(app)/manage' },
    { icon: Settings, label: 'Settings', path: '/(app)/settings' },
];

export default function MobileNav() {
    const router = useRouter();
    const pathname = usePathname();
    const colors = useColors();

    const s = styles(colors);

    const isActive = (path: string) => {
        if (path === '/(app)') {
            return pathname === '/' || pathname === '/(app)' || pathname.startsWith('/(app)/article');
        }
        return pathname.startsWith(path);
    };

    return (
        <View style={s.container}>
            {navItems.map((item) => {
                const active = isActive(item.path);
                const IconComponent = item.icon;

                return (
                    <TouchableOpacity
                        key={item.path}
                        style={s.navItem}
                        onPress={() => router.push(item.path as any)}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        accessibilityState={{ selected: active }}
                    >
                        <IconComponent
                            size={22}
                            color={active ? colors.primary.DEFAULT : colors.text.tertiary}
                            fill={active ? colors.primary.DEFAULT : 'transparent'}
                        />
                        <Text style={[s.label, active && s.labelActive]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.background.secondary,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
        paddingBottom: Platform.OS === 'web' ? 'env(safe-area-inset-bottom)' as any : 20,
        paddingTop: spacing.sm,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
        gap: 2,
        minHeight: 56, // Ensure adequate touch target
    },
    label: {
        fontSize: 10,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
    labelActive: {
        color: colors.primary.DEFAULT,
        fontWeight: '600',
    },
});
