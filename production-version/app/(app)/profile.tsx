import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Text } from '../../components/ui/text';
import { useColor } from '../../hooks/useColor';
import { useSession } from '../../providers/auth-context';
import { useRouter } from 'expo-router';
import { LogOut, User, Settings, Shield, HelpCircle, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Profile() {
    const { user, signOut } = useSession();
    const router = useRouter();
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const background = useColor('background');
    const text = useColor('text');
    const cardColor = useColor('card');
    const muted = useColor('textMuted');
    const semanticInfo = useColor('semanticInfo' as any);
    const semanticWarning = useColor('semanticWarning' as any);
    const semanticSuccess = useColor('semanticSuccess' as any);
    const semanticError = useColor('semanticError' as any);

    const handleLogout = () => {
        setShowLogoutModal(false);
        signOut();
    };

    const menuItems = [
        {
            icon: Settings,
            label: 'Settings',
            sub: 'App preferences & notifications',
            path: '/(app)/settings' as const,
            color: semanticInfo,
            enabled: true,
        },
        {
            icon: Shield,
            label: 'Security',
            sub: 'Password & privacy — coming soon',
            path: null,
            color: semanticWarning,
            enabled: false,
        },
        {
            icon: HelpCircle,
            label: 'Help & Support',
            sub: 'FAQs & contact HR',
            path: '/(app)/help' as const,
            color: semanticSuccess,
            enabled: true,
        },
    ];

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 180 }}
        >
            {/* ── Avatar / Identity Card ──────────────────────────────────────── */}
            <View style={{ alignItems: 'center', marginBottom: 36, marginTop: 20 }}>
                <View style={{
                    width: 120, height: 120, borderRadius: 60,
                    overflow: 'hidden', marginBottom: 20,
                    shadowColor: semanticInfo,
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
                    borderWidth: 4, borderColor: cardColor,
                }}>
                    <LinearGradient
                        colors={['#E9E4F5', '#CBF0F9']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <User size={56} color="#1a1a1a" strokeWidth={2} />
                    </LinearGradient>
                </View>

                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 32, color: text, marginBottom: 4 }}>
                    {user?.name || 'User'}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 16, color: muted }}>
                        {user?.job_title || 'Employee'}
                    </Text>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: muted, opacity: 0.5 }} />
                    <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted }}>
                        ID #{user?.id || '—'}
                    </Text>
                </View>

                <View style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: semanticInfo + '18', borderRadius: 99 }}>
                    <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: semanticInfo }}>
                        {user?.work_email || 'email@example.com'}
                    </Text>
                </View>
            </View>

            {/* ── Menu Items ────────────────────────────────────────────────────── */}
            <View style={{ gap: 14, marginBottom: 28 }}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        onPress={() => item.enabled && item.path ? router.push(item.path) : undefined}
                        activeOpacity={item.enabled ? 0.8 : 1}
                        style={{
                            backgroundColor: item.color + '18',
                            padding: 20,
                            borderRadius: 24,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 16,
                            opacity: item.enabled ? 1 : 0.55,
                        }}
                    >
                        <View style={{
                            width: 52, height: 52, borderRadius: 18,
                            backgroundColor: item.color + '28',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <item.icon size={24} color={item.color} strokeWidth={2} />
                        </View>

                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 17, color: text }}>
                                {item.label}
                            </Text>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: muted, marginTop: 2 }}>
                                {item.sub}
                            </Text>
                        </View>

                        {item.enabled && (
                            <View style={{
                                width: 36, height: 36, borderRadius: 18,
                                backgroundColor: item.color + '28',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <ChevronRight size={18} color={item.color} />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Sign Out ──────────────────────────────────────────────────────── */}
            <TouchableOpacity
                onPress={() => setShowLogoutModal(true)}
                activeOpacity={0.8}
                style={{
                    backgroundColor: semanticError + '18',
                    padding: 20,
                    borderRadius: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                }}
            >
                <LogOut size={20} color={semanticError} strokeWidth={2.5} />
                <Text style={{ fontFamily: 'Outfit_700Bold', color: semanticError, fontSize: 16 }}>
                    Sign Out
                </Text>
            </TouchableOpacity>

            {/* ── Logout Confirmation Modal ──────────────────────────────────────── */}
            <Modal
                visible={showLogoutModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLogoutModal(false)}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                    onPress={() => setShowLogoutModal(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: cardColor,
                            borderRadius: 32,
                            padding: 32,
                            width: '100%',
                            maxWidth: 340,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 20 },
                            shadowOpacity: 0.2,
                            shadowRadius: 32,
                            elevation: 16,
                            alignItems: 'center',
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={{
                            width: 72, height: 72, borderRadius: 36,
                            backgroundColor: semanticError + '18',
                            alignItems: 'center', justifyContent: 'center',
                            marginBottom: 20,
                        }}>
                            <LogOut size={32} color={semanticError} strokeWidth={2} />
                        </View>

                        <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 24, color: text, marginBottom: 8, textAlign: 'center' }}>
                            Sign Out?
                        </Text>
                        <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 16, color: muted, marginBottom: 32, textAlign: 'center', lineHeight: 24 }}>
                            Are you sure you want to sign out of your account?
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
                            <TouchableOpacity
                                onPress={() => setShowLogoutModal(false)}
                                style={{
                                    flex: 1, paddingVertical: 16, borderRadius: 16,
                                    backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center',
                                }}
                            >
                                <Text style={{ fontFamily: 'DMSans_700Bold', color: text }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleLogout}
                                style={{
                                    flex: 1, paddingVertical: 16, borderRadius: 16,
                                    backgroundColor: semanticError, alignItems: 'center',
                                }}
                            >
                                <Text style={{ fontFamily: 'DMSans_700Bold', color: 'white' }}>Sign Out</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </ScrollView>
    );
}
