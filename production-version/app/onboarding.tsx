import React, { useState } from 'react';
import { View, Dimensions, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '../components/ui/text';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { useSession } from '../providers/auth-context';
import { useColor } from '@/hooks/useColor';
import Carousel from 'react-native-reanimated-carousel';

// Note: Ensure react-native-reanimated-carousel is installed if BNA uses it, 
// or use the BNA UI Carousel component if it wraps it. 
// For now, I'll assume standard BNA UI structure or basic Carousel logic if BNA's is complex to guess without docs.
// Wait, BNA UI usually uses `reanimated-carousel`.
// Let's implement a simple view paging manually if Carousel is tricky, 
// but user said "carousel" so I will try to use a simple View pager logic for reliability 
// or check if 'components/ui/carousel' exists.

export default function Onboarding() {
    const { completeOnboarding } = useSession();
    const width = Dimensions.get('window').width;
    const [currentIndex, setCurrentIndex] = useState(0);

    // Pastel colors
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);
    const pastelPink = useColor('pastelPink' as any);
    const pastelGreen = useColor('pastelGreen' as any);
    const cardColor = useColor('card');

    const slides = [
        {
            title: "Welcome to Your ERP",
            description: "Manage your requests, view your dashboard, and stay updated with company news.",
            color: pastelPurple
        },
        {
            title: "Quick Requests",
            description: "Submit time off, expenses, and other requests in seconds directly from the app.",
            color: pastelBlue
        },
        {
            title: "Real-time Notifications",
            description: "Get notified instantly when your requests are approved or require attention.",
            color: pastelPink
        },
        {
            title: "Let's Get Started",
            description: "Fill out a sample request to learn the ropes, or jump straight in.",
            isLast: true,
            color: pastelGreen
        }
    ];

    const handleNext = async () => {
        if (currentIndex < slides.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            await completeOnboarding();
            router.replace('/(app)/dashboard');
        }
    };

    const handleSkip = async () => {
        await completeOnboarding();
        router.replace('/(app)/dashboard');
    };

    const backgroundColor = useColor('background');
    const textColor = useColor('text');

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
            {/* Story Progress Bars */}
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 16, marginBottom: 32 }}>
                {slides.map((slide, index) => (
                    <View key={index} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: currentIndex >= index ? slide.color : 'rgba(0,0,0,0.05)' }} />
                ))}
            </View>

            {/* Content */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
                <View style={{ width: '100%', height: 380, borderRadius: 40, marginBottom: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: slides[currentIndex].color }}>
                    {/* Placeholder for Illustration */}
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 32 }}>✨</Text>
                    </View>
                </View>

                <Text style={{ fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, color: textColor, letterSpacing: -1 }}>
                    {slides[currentIndex].title}
                </Text>
                <Text style={{ color: textColor, opacity: 0.6, textAlign: 'center', fontSize: 18, marginBottom: 40, lineHeight: 28, paddingHorizontal: 16 }}>
                    {slides[currentIndex].description}
                </Text>

                <View style={{ width: '100%', gap: 16 }}>
                    <Button
                        size="lg"
                        onPress={handleNext}
                        style={{ height: 56, borderRadius: 28 }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '600' }}>{slides[currentIndex].isLast ? "Get Started" : "Next"}</Text>
                    </Button>
                    {!slides[currentIndex].isLast && (
                        <Button variant="ghost" onPress={handleSkip}>
                            <Text style={{ color: textColor, opacity: 0.5 }}>Skip</Text>
                        </Button>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}
