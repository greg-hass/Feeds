import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Bookmark, Rss, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, borderRadius, spacing } from '@/theme';
import { UI } from '@/config/constants';

interface NavItem {
    icon: typeof Home;
    label: string;
    path: string;
}

const navItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/(app)' },
    { icon: Rss, label: 'Feeds', path: '/(app)/manage' },
    { icon: Bookmark, label: 'Saved', path: '/(app)/bookmarks' },
    { icon: Settings, label: 'Settings', path: '/(app)/settings' },
];

export default function MobileNav() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const colors = useColors();
    const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
    const s = styles(colors, bottomInset);

    const isActive = (path: string) => {
        // Normalize the path by removing the (app) group prefix
        const normalizedPath = path.replace('/(app)', '');
        const normalizedPathname = pathname.replace('/(app)', '');
        
        if (path === '/(app)') {
            // Home is active for root, /(app), and article pages
            return normalizedPathname === '/' || 
                   normalizedPathname === '' || 
                   normalizedPathname.startsWith('/article');
        }
        
        // For other paths, check if pathname starts with the normalized path
        return normalizedPathname.startsWith(normalizedPath);
    };

    return (
        <View style={s.container}>
            {navItems.map((item) => {
                const active = isActive(item.path);
                const IconComponent = item.icon as any;

                return (
                    <TouchableOpacity
                        key={item.path}
                        style={[s.navItem, active && s.navItemActive]}
                        onPress={() => router.push(item.path as any)}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                        accessibilityState={{ selected: active }}
                        activeOpacity={0.7}
                    >
                        <IconComponent
                            size={22}
                            color={active ? colors.primary.DEFAULT : colors.text.tertiary}
                            strokeWidth={active ? 2.4 : 1.6}
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

const styles = (colors: any, bottomInset: number) => {
    return StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.background.elevated,
        borderTopWidth: 1,
        borderTopColor: colors.border.light ?? colors.border.DEFAULT,
        paddingTop: 4,
        paddingBottom: Math.max(bottomInset, 4),
        paddingHorizontal: spacing.xs,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        ...Platform.select({
            web: {
                position: 'fixed' as any,
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' as any,
                boxShadow: '0 -4px 16px rgba(0,0,0,0.18)',
            },
        }),
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        gap: 2,
        minHeight: UI.MOBILE_NAV_HEIGHT - 12,
        marginHorizontal: 1,
        borderRadius: borderRadius.full,
    },
    navItemActive: {
        backgroundColor: colors.background.tertiary,
    },
    label: {
        fontSize: 9,
        color: colors.text.tertiary,
        fontWeight: '600',
        letterSpacing: 0.1,
    },
    labelActive: {
        color: colors.text.primary,
        fontWeight: '700',
    },
});
};
