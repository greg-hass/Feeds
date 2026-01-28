import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useColors } from '@/theme';

// Discovery has been merged into Manage page
export default function DiscoveryRedirect() {
    const router = useRouter();
    const colors = useColors();

    useEffect(() => {
        // Redirect to manage page
        router.replace('/manage');
    }, [router]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        </View>
    );
}
