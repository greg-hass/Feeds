import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Bookmark, Rss, Settings } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

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
                            strokeWidth={active ? 2.5 : 1.5}
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
    // Detect if running as PWA (standalone mode) - only in browser
    const isStandalone = Platform.OS === 'web' && typeof window !== 'undefined' && 
        (window.matchMedia?.('(display-mode: standalone)').matches || 
         (window.navigator as any).standalone === true);
    
    // In Safari browser (not PWA), add extra padding to clear Safari's toolbar
    const bottomPadding = Platform.OS === 'web' 
        ? (isStandalone 
            ? 'env(safe-area-inset-bottom)' 
            : 'calc(env(safe-area-inset-bottom) + 60px)') as any
        : 20;
    
    return StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.background.primary,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
        paddingBottom: bottomPadding,
        paddingTop: 6,
        position: 'relative',
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 3,
        minHeight: 52,
        marginHorizontal: 4,
        borderRadius: borderRadius.lg,
    },
    navItemActive: {
    },
    label: {
        fontSize: 9,
        color: colors.text.tertiary,
        fontWeight: '500',
    },
    labelActive: {
        color: colors.text.primary,
        fontWeight: '600',
    },
});
};
