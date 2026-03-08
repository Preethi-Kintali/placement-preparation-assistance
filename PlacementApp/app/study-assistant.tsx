import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { COLORS } from '../constants/colors';
import { StatusBar } from 'expo-status-bar';

interface Message { role: 'user' | 'assistant'; content: string; }

export default function StudyAssistantScreen() {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hi! 👋 I'm your AI Study Assistant. Ask me anything about your placement prep — coding concepts, interview tips, algorithms, or any topic you're studying!" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const listRef = useRef<FlatList>(null);

    useEffect(() => {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages]);

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;
        const newMsg: Message = { role: 'user', content: text };
        const history = [...messages, newMsg];
        setMessages(history);
        setInput('');
        setLoading(true);
        try {
            const res = await api.studyChat({ provider: 'groq', message: text, history: messages });
            setMessages([...history, { role: 'assistant', content: res.reply ?? res.message ?? 'Sorry, I could not get a response.' }]);
        } catch {
            setMessages([...history, { role: 'assistant', content: 'Sorry, there was an error. Please make sure the backend server is running.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
            <StatusBar style="light" />
            {/* Header */}
            <LinearGradient colors={['#1a1a2e', COLORS.bg]} style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Icon name="arrow-back" size={22} color={COLORS.text} />
                </TouchableOpacity>
                <View style={s.headerCenter}>
                    <LinearGradient colors={COLORS.gradSecondary} style={s.aiDot} />
                    <Text style={s.title}>Study Assistant</Text>
                </View>
                <View style={{ width: 40 }} />
            </LinearGradient>

            {/* Messages */}
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
                renderItem={({ item }) => (
                    <View style={[s.bubble, item.role === 'user' ? s.bubbleUser : s.bubbleAI]}>
                        {item.role === 'assistant' && (
                            <LinearGradient colors={COLORS.gradSecondary} style={s.aiBubbleIcon}>
                                <Icon name="sparkles" size={12} color="#fff" />
                            </LinearGradient>
                        )}
                        <View style={[s.bubbleInner, item.role === 'user' ? s.bubbleInnerUser : s.bubbleInnerAI]}>
                            <Text style={[s.bubbleText, item.role === 'user' && s.bubbleTextUser]}>{item.content}</Text>
                        </View>
                    </View>
                )}
                ListFooterComponent={loading ? (
                    <View style={s.thinkingRow}>
                        <LinearGradient colors={COLORS.gradSecondary} style={s.aiBubbleIcon}>
                            <Icon name="sparkles" size={12} color="#fff" />
                        </LinearGradient>
                        <View style={s.thinkingBubble}>
                            <ActivityIndicator color={COLORS.primary} size="small" />
                            <Text style={s.thinkingText}>Thinking…</Text>
                        </View>
                    </View>
                ) : null}
            />

            {/* Input */}
            <View style={s.inputBar}>
                <TextInput
                    style={s.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask anything..."
                    placeholderTextColor={COLORS.textDim}
                    multiline
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={send}
                />
                <TouchableOpacity onPress={send} disabled={loading || !input.trim()} style={s.sendBtn}>
                    <LinearGradient
                        colors={input.trim() ? COLORS.gradPrimary : [COLORS.bgCard, COLORS.bgCard]}
                        style={s.sendBtnGrad}
                    >
                        <Icon name="send" size={18} color={input.trim() ? '#fff' : COLORS.textDim} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    aiDot: { width: 10, height: 10, borderRadius: 5 },
    title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
    bubbleUser: { flexDirection: 'row-reverse' },
    bubbleAI: {},
    aiBubbleIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-end' },
    bubbleInner: { maxWidth: '80%', borderRadius: 16, padding: 14 },
    bubbleInnerUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    bubbleInnerAI: { backgroundColor: COLORS.bgCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.bgBorder },
    bubbleText: { color: COLORS.text, fontSize: 14, lineHeight: 22 },
    bubbleTextUser: { color: '#fff' },
    thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.bgBorder },
    thinkingText: { color: COLORS.textMuted, fontSize: 13 },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: 28, backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.bgBorder },
    input: { flex: 1, backgroundColor: COLORS.bgInput, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: COLORS.text, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: COLORS.bgBorder },
    sendBtn: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden' },
    sendBtnGrad: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
