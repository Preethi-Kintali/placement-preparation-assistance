import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

type AnswerRecord = {
    topic: string; question: string; answer: string;
    score: number; feedback: string; quickTip: string;
};

type InterviewSession = {
    id: string; topics: string[]; overallScore: number;
    communicationScore: number; dsaScore: number; technicalScore: number;
    completedAt: string; answers: AnswerRecord[];
};

type Phase = 'home' | 'loading' | 'interview' | 'scoring' | 'done';

export default function InterviewScreen() {
    const { refreshUser } = useAuth();
    const [phase, setPhase] = useState<Phase>('home');
    const [context, setContext] = useState<any>(null);
    const [questions, setQuestions] = useState<Array<{ topic: string; question: string }>>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [answers, setAnswers] = useState<AnswerRecord[]>([]);
    const [history, setHistory] = useState<InterviewSession[]>([]);
    const [scoring, setScoring] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    const loadHistory = async () => {
        try {
            const res = await api.interviewSessions();
            setHistory(Array.isArray(res?.sessions) ? res.sessions : []);
        } catch { }
    };

    useFocusEffect(useCallback(() => { loadHistory(); }, []));

    const startInterview = async () => {
        setPhase('loading');
        try {
            const [ctx, qs] = await Promise.all([api.interviewContext(), api.interviewQuestions()]);
            setContext(ctx);
            const q = qs?.questions ?? [];
            if (!q.length) { Alert.alert('Error', 'No questions generated.'); setPhase('home'); return; }
            setQuestions(q);
            setAnswers([]);
            setCurrentQ(0);
            setUserAnswer('');
            setPhase('interview');
        } catch (e: any) {
            Alert.alert('Error', e?.error || 'Failed to start interview');
            setPhase('home');
        }
    };

    const submitAnswer = async () => {
        if (!userAnswer.trim()) { Alert.alert('Empty', 'Please type your answer.'); return; }
        setScoring(true);
        const q = questions[currentQ];
        try {
            const res = await api.interviewScore({ topic: q.topic, question: q.question, answer: userAnswer.trim() });
            const record: AnswerRecord = {
                topic: q.topic, question: q.question, answer: userAnswer.trim(),
                score: res?.score ?? 0, feedback: res?.feedback ?? '', quickTip: res?.quickTip ?? '',
            };
            const allAnswers = [...answers, record];
            setAnswers(allAnswers);

            if (currentQ < questions.length - 1) {
                setCurrentQ(currentQ + 1);
                setUserAnswer('');
                setScoring(false);
            } else {
                // Save session
                await saveSession(allAnswers);
                setPhase('done');
            }
        } catch (e: any) {
            Alert.alert('Scoring Error', e?.error || 'Failed to score');
        } finally {
            setScoring(false);
        }
    };

    const saveSession = async (allAnswers: AnswerRecord[]) => {
        try {
            const overall = allAnswers.reduce((s, a) => s + a.score, 0) / allAnswers.length;
            // For sub-scores, use overall if individual scores not available
            await api.interviewSaveSession({
                currentWeek: context?.currentWeek ?? 1,
                topics: [...new Set(allAnswers.map(a => a.topic))],
                overallScore: Number(overall.toFixed(2)),
                communicationScore: Number(overall.toFixed(2)),
                dsaScore: Number(overall.toFixed(2)),
                technicalScore: Number(overall.toFixed(2)),
                answers: allAnswers,
            });
            await refreshUser();
            loadHistory();
        } catch { }
    };

    const overallScore = answers.length ? (answers.reduce((s, a) => s + a.score, 0) / answers.length).toFixed(1) : '0';

    // Home screen
    if (phase === 'home') {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
                <StatusBar style="light" />
                <ScrollView showsVerticalScrollIndicator={false}>
                    <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={{ padding: 20, paddingTop: 56, paddingBottom: 24 }}>
                        <Text style={st.title}>AI Mock Interview</Text>
                        <Text style={st.subtitle}>Practice with AI-scored questions based on your roadmap topics</Text>

                        <TouchableOpacity onPress={startInterview} style={{ borderRadius: 14, overflow: 'hidden', marginTop: 16 }}>
                            <LinearGradient colors={COLORS.gradPrimary} style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                <Icon name="mic" size={22} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Start New Interview</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>

                    <View style={{ padding: 16 }}>
                        <Text style={st.secTitle}>How It Works</Text>
                        <View style={st.card}>
                            {([
                                { icon: 'bulb', text: 'AI generates questions from your roadmap topics' },
                                { icon: 'chatbubble-ellipses', text: 'Type your answer for each question' },
                                { icon: 'analytics', text: 'AI scores: overall, communication, DSA, technical' },
                                { icon: 'save', text: 'Session saved to your profile & gamification' },
                            ] as const).map((step, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                                        <Icon name={step.icon} size={16} color={COLORS.primary} />
                                    </View>
                                    <Text style={{ color: COLORS.textMuted, fontSize: 13, flex: 1 }}>{step.text}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Past Sessions */}
                        {history.length > 0 && (
                            <>
                                <Text style={st.secTitle}>Past Sessions</Text>
                                {history.slice(0, 5).map((session, i) => (
                                    <View key={i} style={st.sessionCard}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 14 }}>Session {history.length - i}</Text>
                                            <Text style={{ color: COLORS.textDim, fontSize: 11 }}>{new Date(session.completedAt).toLocaleDateString()}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                            <View style={st.scorePill}><Text style={st.scorePillText}>Overall: {session.overallScore}/10</Text></View>
                                            <View style={st.scorePill}><Text style={st.scorePillText}>Comm: {session.communicationScore}/10</Text></View>
                                            <View style={st.scorePill}><Text style={st.scorePillText}>DSA: {session.dsaScore}/10</Text></View>
                                        </View>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                            {session.topics?.map((t, j) => (
                                                <Text key={j} style={{ color: COLORS.primary, fontSize: 11, backgroundColor: COLORS.primary + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{t}</Text>
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </>
                        )}
                        <View style={{ height: 30 }} />
                    </View>
                </ScrollView>
            </View>
        );
    }

    // Loading
    if (phase === 'loading') return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="light" /><ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ color: COLORS.textMuted, marginTop: 16 }}>Generating interview questions…</Text>
        </View>
    );

    // Done — results
    if (phase === 'done') {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
                <StatusBar style="light" />
                <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
                    <LinearGradient colors={COLORS.gradSecondary} style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginTop: 32 }}>
                        <Icon name="trophy" size={32} color="#fff" />
                    </LinearGradient>
                    <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 16 }}>Interview Complete!</Text>
                    <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>Overall Score: {overallScore}/10</Text>

                    {answers.map((a, i) => (
                        <View key={i} style={[st.card, { width: '100%', marginTop: 12 }]}>
                            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>{a.topic}</Text>
                            <Text style={{ color: COLORS.text, fontSize: 14, fontWeight: '600', marginTop: 4 }}>{a.question}</Text>
                            <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 6 }}>Your answer: {a.answer}</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                <View style={[st.scorePill, { backgroundColor: a.score >= 7 ? COLORS.success + '22' : a.score >= 4 ? COLORS.warning + '22' : COLORS.error + '22' }]}>
                                    <Text style={[st.scorePillText, { color: a.score >= 7 ? COLORS.success : a.score >= 4 ? COLORS.warning : COLORS.error }]}>{a.score}/10</Text>
                                </View>
                            </View>
                            {a.feedback ? <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 6 }}>💡 {a.feedback}</Text> : null}
                            {a.quickTip ? <Text style={{ color: COLORS.primary, fontSize: 12, marginTop: 4 }}>Tip: {a.quickTip}</Text> : null}
                        </View>
                    ))}

                    <TouchableOpacity onPress={() => setPhase('home')} style={{ marginTop: 24, borderRadius: 14, overflow: 'hidden', width: '100%' }}>
                        <LinearGradient colors={COLORS.gradPrimary} style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Back to Interview Home</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <View style={{ height: 30 }} />
                </ScrollView>
            </View>
        );
    }

    // Active interview
    const q = questions[currentQ];
    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <StatusBar style="light" />
            <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={{ padding: 16, paddingTop: 56 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 16 }}>Question {currentQ + 1}/{questions.length}</Text>
                    <TouchableOpacity onPress={() => {
                        Alert.alert('Quit', 'End interview?', [
                            { text: 'Cancel' },
                            { text: 'End', style: 'destructive', onPress: async () => { if (answers.length) { await saveSession(answers); } setPhase('home'); } },
                        ]);
                    }}>
                        <Icon name="close" size={22} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>
                <View style={{ height: 6, backgroundColor: COLORS.bgBorder, borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${((currentQ + 1) / questions.length) * 100}%`, backgroundColor: COLORS.primary, borderRadius: 3 }} />
                </View>
            </LinearGradient>

            <ScrollView ref={scrollRef} style={{ flex: 1, padding: 16 }}>
                <View style={{ backgroundColor: COLORS.primary + '15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 10 }}>
                    <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '700' }}>{q?.topic}</Text>
                </View>
                <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '600', lineHeight: 26 }}>{q?.question}</Text>

                {/* Show last answer feedback */}
                {answers.length > 0 && answers.length === currentQ && (
                    <View style={{ backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: COLORS.bgBorder }}>
                        <Text style={{ color: COLORS.success, fontSize: 13, fontWeight: '700' }}>Previous: {answers[answers.length - 1].score}/10</Text>
                        {answers[answers.length - 1].quickTip ? <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>💡 {answers[answers.length - 1].quickTip}</Text> : null}
                    </View>
                )}

                <TextInput
                    style={st.answerInput}
                    value={userAnswer}
                    onChangeText={setUserAnswer}
                    placeholder="Type your answer here..."
                    placeholderTextColor={COLORS.textDim}
                    multiline
                    textAlignVertical="top"
                    editable={!scoring}
                />

                <TouchableOpacity onPress={submitAnswer} disabled={scoring || !userAnswer.trim()} style={{ borderRadius: 14, overflow: 'hidden', marginTop: 16, marginBottom: 32 }}>
                    <LinearGradient colors={userAnswer.trim() ? COLORS.gradSecondary : [COLORS.bgCard, COLORS.bgCard] as [string, string]}
                        style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {scoring ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={18} color={userAnswer.trim() ? '#fff' : COLORS.textDim} />}
                        <Text style={{ color: userAnswer.trim() ? '#fff' : COLORS.textDim, fontWeight: '700', fontSize: 15 }}>
                            {scoring ? 'Scoring…' : currentQ < questions.length - 1 ? 'Submit & Next' : 'Submit & Finish'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const st = StyleSheet.create({
    title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
    subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 4, lineHeight: 22 },
    secTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 8 },
    card: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 12 },
    sessionCard: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 10 },
    scorePill: { backgroundColor: COLORS.primary + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    scorePillText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
    answerInput: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 16, color: COLORS.text, fontSize: 15, lineHeight: 22, minHeight: 120, borderWidth: 1, borderColor: COLORS.bgBorder, marginTop: 16 },
});
