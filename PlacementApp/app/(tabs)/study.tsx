import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export default function StudyScreen() {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState<'groq' | 'gemini'>('groq');
    const [context, setContext] = useState<any>(null);
    const [showContext, setShowContext] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useFocusEffect(useCallback(() => {
        api.studyContext().then(setContext).catch(() => { });
    }, []));

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;
        setInput('');
        const userMsg: ChatMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        setTimeout(() => scrollRef.current?.scrollToEnd(), 100);

        try {
            const history = messages.slice(-10);
            const res = await api.studyChat({ provider, message: text, history });
            const reply = res?.answer ?? res?.reply ?? res?.message ?? 'No response.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e?.error || 'Failed'}` }]);
        } finally {
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd(), 100);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
            <StatusBar style="light" />
            {/* Header */}
            <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={s.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={s.title}>Study Assistant</Text>
                        <Text style={s.subtitle}>Personalized AI study helper</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setShowContext(!showContext)} style={s.btnSmall}>
                            <Icon name="information-circle" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setProvider(p => p === 'groq' ? 'gemini' : 'groq')} style={s.btnSmall}>
                            <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700' }}>{provider.toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Context Preview */}
                {showContext && context && (
                    <View style={s.contextBox}>
                        <Text style={s.contextTitle}>Context Used:</Text>
                        {context?.profile?.fullName && <Text style={s.contextItem}>👤 {context.profile.fullName}</Text>}
                        {context?.examScores && <Text style={s.contextItem}>📊 Exam scores loaded</Text>}
                        {context?.roadmapProgress && <Text style={s.contextItem}>📅 Roadmap progress loaded</Text>}
                        {context?.interviewPerformance && <Text style={s.contextItem}>🎤 Interview data loaded</Text>}
                        {context?.requirements && <Text style={s.contextItem}>📋 Requirements loaded</Text>}
                    </View>
                )}
            </LinearGradient>

            {/* Messages */}
            <ScrollView ref={scrollRef} style={{ flex: 1, padding: 16 }} onContentSizeChange={() => scrollRef.current?.scrollToEnd()} keyboardShouldPersistTaps="handled">
                {messages.length === 0 && (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <Icon name="chatbubbles" size={40} color={COLORS.textDim} />
                        <Text style={{ color: COLORS.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
                            Ask me anything about your studies!{'\n'}I know your exam scores, roadmap, and career goals.
                        </Text>
                        <View style={{ gap: 8, marginTop: 20, width: '100%' }}>
                            {['What should I study this week?', 'Explain binary search with examples', 'Help me prepare for interviews', 'Give me a study plan for DSA'].map(q => (
                                <TouchableOpacity key={q} onPress={() => { setInput(q); }} style={s.suggestion}>
                                    <Icon name="flash" size={14} color={COLORS.primary} />
                                    <Text style={s.suggestionText}>{q}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {messages.map((msg, i) => (
                    <View key={i} style={[s.msgBubble, msg.role === 'user' ? s.userMsg : s.aiMsg]}>
                        <Text style={[s.msgText, msg.role === 'user' && { color: '#fff' }]}>{msg.content}</Text>
                    </View>
                ))}

                {loading && (
                    <View style={[s.msgBubble, s.aiMsg]}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={s.msgText}> Thinking…</Text>
                    </View>
                )}
                <View style={{ height: 16 }} />
            </ScrollView>

            {/* Input */}
            <View style={s.inputRow}>
                <TextInput
                    style={s.textInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask a study question…"
                    placeholderTextColor={COLORS.textDim}
                    multiline
                    maxLength={2000}
                    editable={!loading}
                    onSubmitEditing={send}
                />
                <TouchableOpacity onPress={send} disabled={loading || !input.trim()}>
                    <LinearGradient colors={input.trim() ? COLORS.gradPrimary as [string, string] : [COLORS.bgCard, COLORS.bgCard] as [string, string]}
                        style={s.sendBtn}>
                        <Icon name="send" size={18} color={input.trim() ? '#fff' : COLORS.textDim} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    header: { padding: 16, paddingTop: 56 },
    title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    subtitle: { color: COLORS.textMuted, fontSize: 12 },
    btnSmall: { backgroundColor: COLORS.bgCard, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.bgBorder },
    contextBox: { backgroundColor: COLORS.bgCard, borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: COLORS.bgBorder },
    contextTitle: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    contextItem: { color: COLORS.textMuted, fontSize: 12, marginBottom: 2 },
    suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bgCard, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bgBorder },
    suggestionText: { color: COLORS.textMuted, fontSize: 13 },
    msgBubble: { maxWidth: '85%', borderRadius: 16, padding: 12, marginBottom: 10 },
    userMsg: { alignSelf: 'flex-end', backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    aiMsg: { alignSelf: 'flex-start', backgroundColor: COLORS.bgCard, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.bgBorder, flexDirection: 'row', flexWrap: 'wrap' },
    msgText: { color: COLORS.textMuted, fontSize: 14, lineHeight: 22 },
    inputRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 14, borderTopWidth: 1, borderTopColor: COLORS.bgBorder, backgroundColor: COLORS.bgCard, alignItems: 'flex-end' },
    textInput: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text, fontSize: 14, minHeight: 44, maxHeight: 100, borderWidth: 1, borderColor: COLORS.bgBorder },
    sendBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
