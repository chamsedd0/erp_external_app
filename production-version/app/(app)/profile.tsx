import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, Pressable, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/text';
import { Button } from '../../components/ui/button';
import { useColor } from '../../hooks/useColor';
import { useSession } from '../../providers/auth-context';
import { useRouter } from 'expo-router';
import { LogOut, User, Settings, Shield, HelpCircle, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Profile() {
    const { user, signOut } = useSession();
    const router = useRouter();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const background = useColor('background');
    const text = useColor('text');
    const cardColor = useColor('card');
    const muted = useColor('textMuted');
    const pastelPurple = useColor('pastelPurple' as any);
    const pastelBlue = useColor('pastelBlue' as any);

    const handleLogout = () => {
        setShowLogoutModal(false);
        signOut();
    };

    const onRefresh = () => {
        setRefreshing(true);
        // Simulate refresh
        setTimeout(() => setRefreshing(false), 1000);
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: background }}
            contentContainerStyle={{ padding: 24, paddingBottom: 180 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header / Avatar */}
            <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 20 }}>
                <View style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    overflow: 'hidden',
                    marginBottom: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    elevation: 8,
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
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: text, marginBottom: 8 }}>{user?.name || 'User'}</Text>
                <Text style={{ fontSize: 17, color: muted, marginBottom: 4 }}>{user?.job_title || 'Employee'}</Text>
                <Text style={{ fontSize: 15, color: muted }}>{user?.work_email || 'email@example.com'}</Text>
            </View>

            {/* Menu Items */}
            <View style={{ gap: 12, marginBottom: 32 }}>
                <TouchableOpacity onPress={() => router.push('/(app)/settings')} style={{
                    backgroundColor: cardColor,
                    padding: 20,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                }}>
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: pastelPurple,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Settings size={22} color="#1a1a1a" strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 16, color: text }}>Settings</Text>
                        <Text style={{ fontSize: 14, color: muted, marginTop: 2 }}>App preferences</Text>
                    </View>
                    <ChevronRight size={20} color={muted} />
                </TouchableOpacity>

                <TouchableOpacity style={{
                    backgroundColor: cardColor,
                    padding: 20,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                }}>
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: pastelBlue,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Shield size={22} color="#1a1a1a" strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 16, color: text }}>Security</Text>
                        <Text style={{ fontSize: 14, color: muted, marginTop: 2 }}>Password & privacy</Text>
                    </View>
                    <ChevronRight size={20} color={muted} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(app)/help')} style={{
                    backgroundColor: cardColor,
                    padding: 20,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                }}>
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#D3F3DA',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <HelpCircle size={22} color="#1a1a1a" strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 16, color: text }}>Help & Support</Text>
                        <Text style={{ fontSize: 14, color: muted, marginTop: 2 }}>Get assistance</Text>
                    </View>
                    <ChevronRight size={20} color={muted} />
                </TouchableOpacity>
            </View>

            {/* Logout */}
            <Button variant="destructive" onPress={() => setShowLogoutModal(true)} style={{ borderRadius: 20 }} size="lg">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <LogOut size={18} color="white" />
                    <Text style={{ fontWeight: 'bold', color: 'white', fontSize: 16 }}>Sign Out</Text>
                </View>
            </Button>

            {/* Logout Confirmation Modal */}
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
                            borderRadius: 24,
                            padding: 24,
                            width: '100%',
                            maxWidth: 400,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: 0.3,
                            shadowRadius: 20,
                            elevation: 10,
                        }}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={{ fontSize: 22, fontWeight: 'bold', color: text, marginBottom: 12 }}>
                            Sign Out
                        </Text>
                        <Text style={{ fontSize: 16, color: muted, marginBottom: 24 }}>
                            Are you sure you want to sign out?
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Button
                                variant="outline"
                                onPress={() => setShowLogoutModal(false)}
                                style={{ flex: 1, borderRadius: 16 }}
                            >
                                <Text style={{ fontWeight: '600' }}>Cancel</Text>
                            </Button>
                            <Button
                                variant="destructive"
                                onPress={handleLogout}
                                style={{ flex: 1, borderRadius: 16 }}
                            >
                                <Text style={{ fontWeight: '600', color: 'white' }}>Sign Out</Text>
                            </Button>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </ScrollView>
    );
}
