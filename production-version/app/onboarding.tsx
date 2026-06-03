import React, { useState, useRef } from 'react';
import {
    View,
    Dimensions,
    TouchableOpacity,
    FlatList,
    Animated,
    StyleSheet,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '../components/ui/text';
import { useSession } from '../providers/auth-context';
import { i18n, t } from '../lib/i18n';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
    Calendar,
    DollarSign,
    Bell,
    Zap,
    Clock,
    CheckCircle,
    ChevronRight,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
    key: string;
    accent: string;
    accentLight: string;
    icon: React.FC<{ size: number; color: string; strokeWidth: number }>;
    iconBg: string;
}

// Visual config only — all copy lives in the i18n catalog under `onboarding.<key>`.
const SLIDES: Slide[] = [
    { key: 'welcome', accent: '#6366F1', accentLight: '#EEF2FF', icon: Zap, iconBg: '#6366F118' },
    { key: 'requests', accent: '#0EA5E9', accentLight: '#F0F9FF', icon: Calendar, iconBg: '#0EA5E918' },
    { key: 'expenses', accent: '#10B981', accentLight: '#ECFDF5', icon: DollarSign, iconBg: '#10B98118' },
    { key: 'timesheets', accent: '#F59E0B', accentLight: '#FFFBEB', icon: Clock, iconBg: '#F59E0B18' },
    { key: 'notifications', accent: '#8B5CF6', accentLight: '#F5F3FF', icon: Bell, iconBg: '#8B5CF618' },
];

function SlideCard({ slide, isDark }: { slide: Slide; isDark: boolean }) {
    const IconComponent = slide.icon;
    const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
    const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
    const textSecondary = isDark ? '#94A3B8' : '#64748B';
    const bulletBg = isDark ? slide.accent + '22' : slide.accentLight;
    const badge = t(`onboarding.${slide.key}.badge`);
    const title = t(`onboarding.${slide.key}.title`);
    const subtitle = t(`onboarding.${slide.key}.subtitle`);
    const bullets = (i18n.t(`onboarding.${slide.key}.bullets`) as unknown as string[]) ?? [];

    return (
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Illustration Card */}
            <View style={[styles.illustrationCard, { backgroundColor: cardBg, shadowColor: isDark ? '#000' : '#94A3B8' }]}>
                {/* Background accent circle */}
                <View style={[styles.accentCircleLarge, { backgroundColor: slide.accent + '12' }]} />
                <View style={[styles.accentCircleSmall, { backgroundColor: slide.accent + '08' }]} />

                {/* Icon */}
                <View style={[styles.iconRing, { borderColor: slide.accent + '30' }]}>
                    <View style={[styles.iconContainer, { backgroundColor: slide.iconBg }]}>
                        <IconComponent size={40} color={slide.accent} strokeWidth={1.75} />
                    </View>
                </View>

                {/* Feature pills */}
                <View style={styles.pillRow}>
                    {bullets.map((bullet, i) => (
                        <View key={i} style={[styles.pill, { backgroundColor: bulletBg }]}>
                            <CheckCircle size={12} color={slide.accent} strokeWidth={2.5} />
                            <Text style={[styles.pillText, { color: slide.accent, fontFamily: 'DMSans_500Medium' }]}>
                                {bullet}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Text content */}
            <View style={styles.textContent}>
                {/* Badge */}
                <View style={[styles.badge, { backgroundColor: slide.accent + '18' }]}>
                    <Text style={[styles.badgeText, { color: slide.accent, fontFamily: 'DMSans_700Bold' }]}>
                        {badge}
                    </Text>
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: textPrimary, fontFamily: 'Outfit_700Bold' }]}>
                    {title}
                </Text>

                {/* Subtitle */}
                <Text style={[styles.subtitle, { color: textSecondary, fontFamily: 'DMSans_400Regular' }]}>
                    {subtitle}
                </Text>
            </View>
        </View>
    );
}

export default function Onboarding() {
    const { completeOnboarding } = useSession();
    const theme = useColorScheme() ?? 'light';
    const isDark = theme === 'dark';

    const backgroundColor = useColor('background');
    const textMuted = useColor('textMuted');
    const borderColor = useColor('border');

    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const currentSlide = SLIDES[currentIndex];
    const isLast = currentIndex === SLIDES.length - 1;

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (index !== currentIndex) setCurrentIndex(index);
    };

    const goNext = async () => {
        if (!isLast) {
            const next = currentIndex + 1;
            flatListRef.current?.scrollToIndex({ index: next, animated: true });
            setCurrentIndex(next);
        } else {
            await completeOnboarding();
            router.replace('/(app)/dashboard');
        }
    };

    const handleSkip = async () => {
        await completeOnboarding();
        router.replace('/(app)/dashboard');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor }]}>
            {/* Top bar */}
            <View style={styles.topBar}>
                {/* Dot indicators */}
                <View style={styles.dotsRow}>
                    {SLIDES.map((slide, i) => {
                        const isActive = i === currentIndex;
                        return (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    {
                                        width: isActive ? 20 : 6,
                                        backgroundColor: isActive ? currentSlide.accent : (isDark ? '#3F3F46' : '#D4D4D8'),
                                    },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Skip */}
                {!isLast && (
                    <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={[styles.skipText, { color: textMuted, fontFamily: 'DMSans_500Medium' }]}>
                            {t('onboarding.skip')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={(item) => item.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleScroll}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                renderItem={({ item }) => <SlideCard slide={item} isDark={isDark} />}
                style={{ flex: 1 }}
            />

            {/* Bottom CTA */}
            <View style={[styles.bottomBar, { borderTopColor: isDark ? '#27272A' : 'transparent' }]}>
                <TouchableOpacity
                    onPress={goNext}
                    activeOpacity={0.85}
                    style={[styles.ctaButton, { backgroundColor: currentSlide.accent }]}
                >
                    <Text style={[styles.ctaText, { fontFamily: 'Outfit_700Bold' }]}>
                        {isLast ? t('onboarding.getStarted') : t('onboarding.continue')}
                    </Text>
                    <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>

                {/* Page counter */}
                <Text style={[styles.pageCounter, { color: textMuted, fontFamily: 'DMSans_400Regular' }]}>
                    {t('onboarding.pageCounter', { current: currentIndex + 1, total: SLIDES.length })}
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 4,
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    skipText: {
        fontSize: 15,
    },
    slide: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
    },
    illustrationCard: {
        borderRadius: 32,
        height: 320,
        marginBottom: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 4,
        overflow: 'hidden',
        gap: 24,
    },
    accentCircleLarge: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        top: -60,
        right: -60,
    },
    accentCircleSmall: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        bottom: -40,
        left: -30,
    },
    iconRing: {
        width: 112,
        height: 112,
        borderRadius: 56,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillRow: {
        gap: 8,
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        width: '100%',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    pillText: {
        fontSize: 12,
    },
    textContent: {
        gap: 10,
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 12,
        letterSpacing: 0.3,
    },
    title: {
        fontSize: 34,
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 24,
    },
    bottomBar: {
        paddingHorizontal: 24,
        paddingBottom: 12,
        paddingTop: 16,
        gap: 12,
        alignItems: 'center',
    },
    ctaButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: 17,
    },
    pageCounter: {
        fontSize: 13,
    },
});
