import React, { useState } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from './text';
import { useColor } from '@/hooks/useColor';
import { Calendar } from 'lucide-react-native';

interface DatePickerProps {
    value: Date | null;
    onChange: (date: Date | null) => void;
    placeholder?: string;
    containerStyle?: any;
}

export function DatePicker({ value, onChange, placeholder = 'Select date', containerStyle }: DatePickerProps) {
    const [show, setShow] = useState(false);
    const text = useColor('text');
    const muted = useColor('textMuted');
    const background = useColor('background');
    const cardColor = useColor('card');

    const handleChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShow(false);
        }
        if (event.type === 'set' && selectedDate) {
            onChange(selectedDate);
        } else if (event.type === 'dismissed') {
            setShow(false);
        }
    };

    const formatDate = (date: Date | null) => {
        if (!date) return placeholder;
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    return (
        <View style={containerStyle}>
            <TouchableOpacity
                onPress={() => setShow(true)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: value ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                    backgroundColor: background,
                    height: 56,
                }}
            >
                <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: value ? text : muted
                }}>
                    {formatDate(value)}
                </Text>
                <Calendar size={20} color={muted} />
            </TouchableOpacity>

            {show && (
                <DateTimePicker
                    value={value || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleChange}
                    textColor={text}
                />
            )}
        </View>
    );
}
