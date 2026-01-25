import { DiscoveryPage } from '@/components/DiscoveryPage';
import { Stack } from 'expo-router';

export default function DiscoveryScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Discover' }} />
            <DiscoveryPage />
        </>
    );
}
