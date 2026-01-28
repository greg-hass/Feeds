import { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useColors } from '@/theme';
import Timeline from '@/components/Timeline';
import { DigestView } from '@/components/DigestView';

export default function ArticleListScreen() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;

    const s = styles(colors, isMobile);

    if (!mounted) return null;

    return (
        <View style={s.container}>
            {/* Desktop: Column 3 Content (Placeholder/Digest) */}
            {/* Mobile: Full Screen Timeline (which includes Header) */}

            <View style={s.mainLayout}>
                {isMobile ? (
                    <View style={s.fullPane}>
                        <Timeline />
                    </View>
                ) : (
                    <View style={s.readerPane}>
                        <DigestView />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    mainLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    fullPane: {
        flex: 1,
        width: '100%',
    },
    readerPane: {
        flex: 1,
        height: '100%',
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
