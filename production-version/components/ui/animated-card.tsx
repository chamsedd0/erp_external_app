import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useColor } from '@/hooks/useColor';

interface AnimatedCardProps {
    children: React.ReactNode;
    delay?: number;
    style?: ViewStyle;
}

export function AnimatedCard({ children, delay = 0, style }: AnimatedCardProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;
    const cardColor = useColor('card');

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, [delay]);

    return (
        <Animated.View
            style={[
                {
                    backgroundColor: cardColor,
                    borderRadius: 24,
                    padding: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 12,
                    elevation: 4,
                    opacity: fadeAnim,
                    transform: [{ translateY }],
                },
                style,
            ]}
        >
            {children}
        </Animated.View>
    );
}
