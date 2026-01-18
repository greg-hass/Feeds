import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, Search, Bookmark, Rss, Settings } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

interface NavItem {
    icon: typeof Home;
    label: string;
    path: string;
}

const navItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/(app)' },
    { icon: Search, label: 'Search', path: '/(app)/search' },
    { icon: Bookmark, label: 'Saved', path: '/(app)/bookmarks' },
    { icon: Rss, label: 'Feeds', path: '/(app)/subscriptions' },
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
                    >
                        <IconComponent
                            size={22}
                            color={active ? colors.primary.DEFAULT : colors.text.tertiary}
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
        paddingBottom: 20, // Safe area for notch devices
        paddingTop: spacing.sm,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        gap: 2,
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
