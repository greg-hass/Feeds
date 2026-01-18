import { DigestView } from '@/components/DigestView';
import { Stack } from 'expo-router';

export default function DigestScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Daily Digest' }} />
            <DigestView />
        </>
    );
}
