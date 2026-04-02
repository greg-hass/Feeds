import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Bookmark, Rss, Settings } from 'lucide-react-native';
import { useColors, borderRadius } from '@/theme';

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
    const colors = useColors();
    const s = styles(colors);

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
                const IconComponent = item.icon;

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

const styles = (colors: any) => {
    return StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.background.primary,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
        // Bound web safe-area inset so iOS PWA has clearance without oversized dead space.
        paddingBottom: Platform.OS === 'web' ? ('clamp(8px, env(safe-area-inset-bottom), 20px)' as any) : 0,
        paddingTop: 8,
        position: 'relative',
        ...Platform.select({
            web: {
                boxShadow: '0 -2px 10px rgba(0,0,0,0.04)',
            },
        }),
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        gap: 3,
        minHeight: 50,
        marginHorizontal: 4,
        borderRadius: borderRadius.xl,
    },
    navItemActive: {
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    label: {
        fontSize: 10,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
    labelActive: {
        color: colors.text.primary,
        fontWeight: '600',
    },
});
};
