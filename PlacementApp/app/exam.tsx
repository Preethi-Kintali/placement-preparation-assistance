import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
    Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';
import { StatusBar } from 'expo-status-bar';

// Sequential exam order
const EXAM_ORDER = ['aptitude', 'dsa', 'soft_skills', 'career'];
const EXAM_LABELS: Record<string, string> = {
    aptitude: 'Aptitude Test',
    dsa: 'DSA Test',
    soft_skills: 'Soft Skills Test',
    career: 'Career Path Test',
};

type Phase = 'loading' | 'exam' | 'submitting' | 'results';

export default function ExamScreen() {
    const { type } = useLocalSearchParams<{ type: string }>();
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [phase, setPhase] = useState<Phase>('loading');
    const [questions, setQuestions] = useState<any[]>([]);
    const [sessionId, setSessionId] = useState('');
    const [selected, setSelected] = useState<Record<number, string>>({});
    const [current, setCurrent] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [autoCountdown, setAutoCountdown] = useState(5);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const scrollRef = useRef<ScrollView>(null);

    // Determine the next exam in the sequence
    const currentIdx = EXAM_ORDER.indexOf(type || '');
    const nextExam = currentIdx >= 0 && currentIdx < EXAM_ORDER.length - 1 ? EXAM_ORDER[currentIdx + 1] : null;
    const isLastExam = currentIdx === EXAM_ORDER.length - 1;

    useEffect(() => {
        load();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (autoRef.current) clearInterval(autoRef.current);
        };
    }, []);

    const load = async () => {
        try {
            let data;
            if (type === 'career') {
                data = await api.careerQuestions(15);
            } else {
                data = await api.examQuestions(type!, 15);
            }
            const qs = data?.questions ?? [];
            if (!qs.length) { Alert.alert('Error', 'No questions found.'); router.back(); return; }
            setQuestions(qs);
            setSessionId(data?.sessionId ?? '');
            const mins = type === 'dsa' || type === 'career' ? 20 : 15;
            setTimeLeft(mins * 60);
            setPhase('exam');
            setCurrent(0);
            setSelected({});
            timerRef.current = setInterval(() => {
                setTimeLeft(t => {
                    if (t <= 1) { clearInterval(timerRef.current!); return 0; }
                    return t - 1;
                });
            }, 1000);
        } catch (err: any) {
            Alert.alert('Error', err?.error || 'Failed to load questions');
            router.back();
        }
    };

    // Auto-submit on timer end
    useEffect(() => {
        if (timeLeft === 0 && phase === 'exam' && questions.length > 0) {
            doSubmit();
        }
    }, [timeLeft]);

    // Auto-redirect countdown after results show
    useEffect(() => {
        if (phase === 'results' && result) {
            setAutoCountdown(5);
            autoRef.current = setInterval(() => {
                setAutoCountdown(c => {
                    if (c <= 1) {
                        clearInterval(autoRef.current!);
                        // Auto navigate to next exam or dashboard
                        if (nextExam) {
                            router.replace({ pathname: '/exam', params: { type: nextExam } });
                        } else {
                            router.replace('/(tabs)/dashboard');
                        }
                        return 0;
                    }
                    return c - 1;
                });
            }, 1000);
        }
        return () => { if (autoRef.current) clearInterval(autoRef.current); };
    }, [phase, result]);

    const handleSubmit = () => {
        const answeredCount = Object.keys(selected).length;
        if (answeredCount < questions.length) {
            const firstUnanswered = questions.findIndex((_, i) => !selected[i]);
            if (firstUnanswered >= 0) {
                Alert.alert(
                    'Unanswered Questions',
                    `Question ${firstUnanswered + 1} is unanswered. Answer all questions or submit with blanks?`,
                    [
                        { text: 'Go to Question', onPress: () => { setCurrent(firstUnanswered); scrollRef.current?.scrollTo({ y: 0 }); } },
                        { text: 'Submit Anyway', style: 'destructive', onPress: () => doSubmit() },
                    ]
                );
                return;
            }
        }
        doSubmit();
    };

    const doSubmit = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('submitting');
        try {
            const answers = questions
                .map((q: any, i: number) => {
                    const sel = selected[i];
                    if (!sel) return null;
                    return { questionId: q.id || q._id || String(i), selectedOption: sel };
                })
                .filter(Boolean);

            if (answers.length === 0) {
                Alert.alert('Error', 'Please answer at least one question.');
                setPhase('exam');
                return;
            }

            const res = await api.submitExam({
                examType: type,
                sessionId: sessionId,
                answers,
            });
            setResult(res);
            setPhase('results');
            refreshUser();
        } catch (err: any) {
            const msg = typeof err?.error === 'string' ? err.error :
                typeof err?.error === 'object' ? JSON.stringify(err.error) :
                    'Failed to submit exam';
            Alert.alert('Submission Error', msg);
            setPhase('exam');
        }
    };

    const goToNextExam = () => {
        if (autoRef.current) clearInterval(autoRef.current);
        if (nextExam) {
            router.replace({ pathname: '/exam', params: { type: nextExam } });
        } else {
            router.replace('/(tabs)/dashboard');
        }
    };

    const formatTime = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    const gradeColor = (pct: number) => pct >= 70 ? COLORS.success : pct >= 40 ? COLORS.warning : COLORS.error;

    // Loading / Submitting
    if (phase === 'loading' || phase === 'submitting') return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="light" />
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={{ color: COLORS.textMuted, marginTop: 16 }}>
                {phase === 'submitting' ? 'Submitting & saving results…' : 'Loading questions…'}
            </Text>
        </View>
    );

    // Results screen with auto-redirect countdown
    if (phase === 'results' && result) {
        const pct = Math.round(result.percentage ?? 0);
        const col = gradeColor(pct);
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
                <StatusBar style="light" />
                <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
                    <LinearGradient colors={pct >= 70 ? ['#10b981', '#059669'] : ['#6366f1', '#8b5cf6']} style={rs.resultIcon}>
                        <Icon name={pct >= 70 ? 'trophy' : 'checkmark-done'} size={36} color="#fff" />
                    </LinearGradient>
                    <Text style={rs.resultTitle}>{EXAM_LABELS[type!] || 'Exam'} Complete!</Text>

                    {/* Score circle */}
                    <View style={[rs.scoreBigBox, { borderColor: col }]}>
                        <Text style={[rs.scoreBig, { color: col }]}>{pct}%</Text>
                        <Text style={rs.scoreGrade}>Grade: {result.grade ?? '—'}</Text>
                    </View>

                    {/* Stats */}
                    <View style={rs.statsRow}>
                        <View style={rs.statBox}>
                            <Icon name="checkmark-circle" size={20} color={COLORS.success} />
                            <Text style={rs.statNum}>{result.score ?? 0}</Text>
                            <Text style={rs.statLbl}>Correct</Text>
                        </View>
                        <View style={rs.statBox}>
                            <Icon name="close-circle" size={20} color={COLORS.error} />
                            <Text style={rs.statNum}>{(result.totalQuestions ?? questions.length) - (result.score ?? 0)}</Text>
                            <Text style={rs.statLbl}>Wrong</Text>
                        </View>
                        <View style={rs.statBox}>
                            <Icon name="list" size={20} color={COLORS.primary} />
                            <Text style={rs.statNum}>{result.totalQuestions ?? questions.length}</Text>
                            <Text style={rs.statLbl}>Total</Text>
                        </View>
                    </View>

                    {/* Badges */}
                    {result.unlockedBadges?.length > 0 && (
                        <View style={rs.badgeAlert}>
                            <Text style={rs.badgeAlertText}>🏆 Badge unlocked: {result.unlockedBadges.join(', ')}</Text>
                        </View>
                    )}

                    {/* Auto-redirect countdown */}
                    {nextExam && (
                        <View style={{ width: '100%', gap: 8 }}>
                            <TouchableOpacity style={rs.nextExamBtn} onPress={goToNextExam}>
                                <LinearGradient colors={['#10b981', '#059669']} style={rs.nextExamGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <Text style={rs.nextExamText}>Continue to {EXAM_LABELS[nextExam]}</Text>
                                    <Icon name="arrow-forward" size={18} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                            <Text style={rs.autoText}>
                                Auto-continuing in {autoCountdown}s...
                            </Text>
                        </View>
                    )}

                    {/* After last exam → dashboard */}
                    {isLastExam && (
                        <View style={{ width: '100%', gap: 12 }}>
                            <View style={rs.completionBanner}>
                                <Icon name="checkmark-done-circle" size={24} color={COLORS.success} />
                                <Text style={rs.completionText}>🎉 All assessments complete! Your Roadmap, Interview & Dashboard are now fully unlocked.</Text>
                            </View>
                            <TouchableOpacity style={rs.nextExamBtn} onPress={() => { if (autoRef.current) clearInterval(autoRef.current); router.replace('/(tabs)/dashboard'); }}>
                                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={rs.nextExamGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <Text style={rs.nextExamText}>View Dashboard & Prediction</Text>
                                    <Icon name="arrow-forward" size={18} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                            <Text style={rs.autoText}>
                                Going to dashboard in {autoCountdown}s...
                            </Text>
                        </View>
                    )}

                    <View style={{ height: 30 }} />
                </ScrollView>
            </View>
        );
    }

    // Exam questions screen
    const q = questions[current];

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            {/* Top bar */}
            <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={es.topBar}>
                <TouchableOpacity onPress={() => {
                    Alert.alert('Quit Exam', 'Your progress will be lost. Are you sure?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Quit', style: 'destructive', onPress: () => { if (timerRef.current) clearInterval(timerRef.current); router.back(); } },
                    ]);
                }}>
                    <Icon name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginHorizontal: 16 }}>
                    <Text style={es.examLabel} numberOfLines={1}>{EXAM_LABELS[type!] || 'Exam'} · {currentIdx + 1}/4</Text>
                    <View style={es.progressBar}>
                        <View style={[es.progressFill, { width: `${((current + 1) / questions.length) * 100}%` }]} />
                    </View>
                </View>
                <View style={[es.timerBox, timeLeft < 60 && { borderColor: COLORS.error }]}>
                    <Icon name="time" size={14} color={timeLeft < 60 ? COLORS.error : COLORS.textMuted} />
                    <Text style={[es.timerText, timeLeft < 60 && { color: COLORS.error }]}>{formatTime(timeLeft)}</Text>
                </View>
            </LinearGradient>

            {/* Question indicator dots */}
            <View style={es.dotRow}>
                {questions.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setCurrent(i)}>
                        <View style={[
                            es.dot,
                            i === current && es.dotActive,
                            selected[i] && es.dotAnswered,
                        ]} />
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView ref={scrollRef} style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
                <Text style={es.qNum}>Question {current + 1} of {questions.length}</Text>
                <Text style={es.qText}>{q?.question}</Text>

                <View style={{ gap: 12, marginTop: 20 }}>
                    {(q?.options || []).map((opt: string, oi: number) => {
                        const isSelected = selected[current] === opt;
                        return (
                            <TouchableOpacity
                                key={oi}
                                style={[es.optionBtn, isSelected && es.optionBtnSelected]}
                                onPress={() => setSelected(s => ({ ...s, [current]: opt }))}
                            >
                                <View style={[es.optionCircle, isSelected && es.optionCircleSelected]}>
                                    {isSelected && <Icon name="checkmark" size={12} color="#fff" />}
                                </View>
                                <Text style={[es.optionText, isSelected && es.optionTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom nav */}
            <View style={es.bottomNav}>
                <TouchableOpacity
                    style={[es.navBtn, es.navBtnSecondary, current === 0 && { opacity: 0.3 }]}
                    onPress={() => setCurrent(c => Math.max(0, c - 1))}
                    disabled={current === 0}
                >
                    <Icon name="arrow-back" size={18} color={COLORS.primary} />
                    <Text style={es.navSecText}>Prev</Text>
                </TouchableOpacity>

                {current < questions.length - 1 ? (
                    <TouchableOpacity style={[es.navBtn, es.navBtnPrimary]} onPress={() => setCurrent(c => c + 1)}>
                        <LinearGradient colors={['#6366f1', '#8b5cf6']} style={es.navBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={es.navPrimaryText}>Next</Text>
                            <Icon name="arrow-forward" size={18} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[es.navBtn, es.navBtnPrimary]} onPress={handleSubmit}>
                        <LinearGradient colors={['#10b981', '#059669']} style={es.navBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={es.navPrimaryText}>Submit Exam</Text>
                            <Icon name="checkmark" size={18} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const es = StyleSheet.create({
    topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
    examLabel: { color: COLORS.text, fontWeight: '700', fontSize: 14, marginBottom: 6 },
    progressBar: { height: 6, backgroundColor: COLORS.bgBorder, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
    timerBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.bgCard, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.bgBorder },
    timerText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
    dotRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.bgBorder },
    dotActive: { backgroundColor: COLORS.primary, width: 20 },
    dotAnswered: { backgroundColor: '#10b981' },
    qNum: { color: COLORS.textMuted, fontSize: 13, marginBottom: 12 },
    qText: { color: COLORS.text, fontSize: 17, lineHeight: 26, fontWeight: '600' },
    optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.bgBorder },
    optionBtnSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
    optionCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.bgBorder, alignItems: 'center', justifyContent: 'center' },
    optionCircleSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    optionText: { color: COLORS.textMuted, fontSize: 14, flex: 1 },
    optionTextSelected: { color: COLORS.text, fontWeight: '700' },
    bottomNav: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.bgBorder },
    navBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
    navBtnPrimary: {},
    navBtnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, height: 52 },
    navBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52 },
    navPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    navSecText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
});

const rs = StyleSheet.create({
    resultIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 16, marginTop: 40 },
    resultTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 20 },
    scoreBigBox: { width: 160, height: 160, borderRadius: 80, borderWidth: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, marginBottom: 24 },
    scoreBig: { fontSize: 40, fontWeight: '900' },
    scoreGrade: { color: COLORS.textMuted, fontSize: 14 },
    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
    statBox: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.bgBorder },
    statNum: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
    statLbl: { color: COLORS.textMuted, fontSize: 12 },
    badgeAlert: { backgroundColor: '#f59e0b22', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#f59e0b44', width: '100%' },
    badgeAlertText: { color: '#f59e0b', fontWeight: '700', textAlign: 'center' },
    nextExamBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
    nextExamGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56 },
    nextExamText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    autoText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 8 },
    completionBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#10b98122', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#10b98144' },
    completionText: { color: '#10b981', flex: 1, fontWeight: '600', fontSize: 14, lineHeight: 20 },
});
