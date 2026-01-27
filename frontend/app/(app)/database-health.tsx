import { DatabaseHealthPanel } from '@/components/DatabaseHealthPanel';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useColors } from '@/theme';
import { View } from 'react-native';

export default function DatabaseHealthScreen() {
    const colors = useColors();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
            <ScreenHeader title="Database Health" />
            <DatabaseHealthPanel />
        </View>
    );
}
