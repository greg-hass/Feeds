import { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Slot } from 'expo-router';
import { useFeedStore, useAuthStore } from '@/stores';
import Sidebar from '@/components/Sidebar';

export default function AppLayout() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const { fetchFeeds, fetchFolders } = useFeedStore();

    useEffect(() => {
        fetchFeeds();
        fetchFolders();
    }, []);

    return (
        <View style={styles.container}>
            {isDesktop && <Sidebar />}
            <View style={styles.content}>
                <Slot />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#18181b',
    },
    content: {
        flex: 1,
    },
});
