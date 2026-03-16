import React, { useState } from 'react';
import { View, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from './ui/text';
import { useColor } from '../hooks/useColor';
import { Paperclip, X } from 'lucide-react-native';
import type { Attachment } from '../api/client';

interface Props {
    attachments: Attachment[];
    onChange: (attachments: Attachment[]) => void;
    maxFiles?: number;
    label?: string;
}

export function AttachmentPicker({ attachments, onChange, maxFiles = 3, label = 'Attachments' }: Props) {
    const [loading, setLoading] = useState(false);

    const muted = useColor('textMuted');
    const cardColor = useColor('card');

    const pickImage = async (useCamera: boolean) => {
        setLoading(true);
        try {
            let result: ImagePicker.ImagePickerResult;

            if (useCamera) {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Camera access is needed to take photos.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: true,
                });
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Photo library access is needed.');
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                    base64: true,
                });
            }

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const newAttachment: Attachment = {
                    name: asset.fileName || `photo_${Date.now()}.jpg`,
                    data: asset.base64 || '',
                    mimetype: asset.mimeType || 'image/jpeg',
                };
                onChange([...attachments, newAttachment]);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const showPicker = () => {
        Alert.alert(
            'Add Attachment',
            'Choose a source',
            [
                { text: 'Take Photo', onPress: () => pickImage(true) },
                { text: 'Choose from Library', onPress: () => pickImage(false) },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const removeAttachment = (index: number) => {
        onChange(attachments.filter((_, i) => i !== index));
    };

    const canAddMore = attachments.length < maxFiles;

    return (
        <View style={{ gap: 14 }}>
            <Text style={{
                fontFamily: 'DMSans_500Medium', fontSize: 14, color: muted,
                textTransform: 'uppercase', letterSpacing: 1,
            }}>
                {label}{' '}
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: muted, textTransform: 'none', letterSpacing: 0 }}>
                    ({attachments.length}/{maxFiles})
                </Text>
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {/* Thumbnails of picked images */}
                {attachments.map((att, index) => (
                    <View
                        key={index}
                        style={{
                            width: 88, height: 88, borderRadius: 18,
                            overflow: 'hidden', backgroundColor: cardColor,
                        }}
                    >
                        <Image
                            source={{ uri: `data:${att.mimetype};base64,${att.data}` }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                        {/* Filename label */}
                        <View style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 5, paddingVertical: 3,
                        }}>
                            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 9, color: '#fff' }} numberOfLines={1}>
                                {att.name}
                            </Text>
                        </View>
                        {/* Remove button */}
                        <TouchableOpacity
                            onPress={() => removeAttachment(index)}
                            style={{
                                position: 'absolute', top: 5, right: 5,
                                width: 22, height: 22, borderRadius: 11,
                                backgroundColor: 'rgba(0,0,0,0.65)',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <X size={12} color="#fff" strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>
                ))}

                {/* Add-more slot */}
                {canAddMore && (
                    <TouchableOpacity
                        onPress={showPicker}
                        disabled={loading}
                        activeOpacity={0.7}
                        style={{
                            width: 88, height: 88, borderRadius: 18,
                            backgroundColor: cardColor,
                            borderWidth: 1.5, borderStyle: 'dashed',
                            borderColor: muted + '55',
                            alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color={muted} />
                        ) : (
                            <>
                                <Paperclip size={20} color={muted} />
                                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: muted }}>Add</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
