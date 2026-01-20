import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useColors, spacing } from '@/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const Skeleton = ({ width = '100%', height = 16, borderRadius = 4, style }: SkeletonProps) => {
  const colors = useColors();
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.background.tertiary,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const TimelineSkeleton = () => {
  const colors = useColors();
  const s = styles(colors);

  return (
    <View style={s.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={s.card}>
          <View style={s.header}>
            <Skeleton width={80} height={20} borderRadius={4} />
          </View>
          <Skeleton width="90%" height={20} borderRadius={4} style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height={20} borderRadius={4} style={{ marginBottom: 12 }} />
          <View style={s.footer}>
            <Skeleton width={100} height={14} borderRadius={4} />
            <Skeleton width={20} height={20} borderRadius={10} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = (colors: any) => StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
