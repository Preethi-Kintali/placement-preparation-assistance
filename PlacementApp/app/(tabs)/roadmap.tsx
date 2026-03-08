import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

type DayData = { day: number; topic: string; status?: string; resources?: any[] };
type WeekData = {
    week: number; title: string; status: string;
    days: DayData[]; testAvailable: boolean;
    test?: { requiredDays?: number; completedDays?: number } | null;
};

export default function RoadmapScreen() {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [roadmap, setRoadmap] = useState<WeekData[]>([]);
    const [examStatus, setExamStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
    const [certificate, setCertificate] = useState<any>(null);

    // Weekly test modal state
    const [testModal, setTestModal] = useState(false);
    const [testWeek, setTestWeek] = useState<number>(0);
    const [testQuestions, setTestQuestions] = useState<any[]>([]);
    const [testSessionId, setTestSessionId] = useState('');
    const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [testStartedAt, setTestStartedAt] = useState(0);

    // Grand test modal state
    const [grandModal, setGrandModal] = useState(false);
    const [grandQuestions, setGrandQuestions] = useState<any[]>([]);
    const [grandSessionId, setGrandSessionId] = useState('');
    const [grandAnswers, setGrandAnswers] = useState<Record<string, string>>({});
    const [grandLoading, setGrandLoading] = useState(false);
    const [grandResult, setGrandResult] = useState<any>(null);

    const allExamsDone = !!examStatus?.aptitude?.latest && !!examStatus?.dsa?.latest &&
        !!examStatus?.soft_skills?.latest && !!examStatus?.career?.latest;

    const load = async () => {
        try {
            const es = await api.examStatus().catch(() => null);
            setExamStatus(es);
            const done = !!es?.aptitude?.latest && !!es?.dsa?.latest && !!es?.soft_skills?.latest && !!es?.career?.latest;
            if (done) {
                const res = await api.roadmap();
                const weeks = (res.weeks || []).map((w: any) => ({
                    week: w.week, title: w.title, status: w.status,
                    testAvailable: Boolean(w.test?.unlocked), test: w.test ?? null,
                    days: (w.days || []).map((d: any) => ({
                        day: d.day, topic: d.topic, status: d.status ?? 'pending', resources: d.resources ?? [],
                    })),
                }));
                setRoadmap(weeks);
                // Check certificate
                if (weeks.some((w: any) => Number(w.week) === 12 && w.status === 'completed')) {
                    try { const cert = await api.roadmapCertificate(); setCertificate(cert); } catch { }
                }
            }
        } catch { } finally { setLoading(false); setRefreshing(false); }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const completeDay = async (week: number, day: number) => {
        try {
            const res = await api.roadmapCompleteDay(week, day);
            await refreshUser();
            if (res?.checkIn?.awarded) Alert.alert('Daily Check-in', '+1 Health Point 🎉');
            if (res?.checkIn?.streakMilestone) Alert.alert('Streak Milestone!', `${res.checkIn.streakMilestone}-day streak 🔥`);
            if (res?.checkIn?.unlockedBadges?.length) Alert.alert('Badge Unlocked', res.checkIn.unlockedBadges.join(', '));
            load();
        } catch (e: any) { Alert.alert('Error', e?.error || 'Failed'); }
    };

    const openWeeklyTest = async (week: number) => {
        setTestModal(true); setTestWeek(week); setTestLoading(true);
        setTestResult(null); setTestQuestions([]); setTestAnswers({});
        try {
            const res = await api.roadmapWeeklyTestQuestions(week);
            setTestSessionId(res.sessionId ?? '');
            setTestQuestions(res.questions ?? []);
            setTestStartedAt(Date.now());
        } catch (e: any) { Alert.alert('Error', e?.error || 'Failed to load test'); setTestModal(false); }
        finally { setTestLoading(false); }
    };

    const submitWeeklyTest = async () => {
        const unanswered = testQuestions.filter(q => !testAnswers[q.id]);
        if (unanswered.length) { Alert.alert('Incomplete', 'Answer all questions first.'); return; }
        setTestLoading(true);
        try {
            const dur = Math.max(1, Math.floor((Date.now() - testStartedAt) / 1000));
            const res = await api.roadmapWeeklyTestSubmit(testWeek, {
                sessionId: testSessionId, durationSeconds: dur,
                answers: testQuestions.map(q => ({ questionId: q.id, selectedOption: testAnswers[q.id] ?? '' })),
            });
            setTestResult(res); load();
        } catch (e: any) { Alert.alert('Error', e?.error || 'Submit failed'); }
        finally { setTestLoading(false); }
    };

    const openGrandTest = async () => {
        setGrandModal(true); setGrandLoading(true);
        setGrandResult(null); setGrandQuestions([]); setGrandAnswers({});
        try {
            const res = await api.roadmapGrandTest();
            if (res?.alreadyCertified) { setCertificate(res.certificate); setGrandResult({ alreadyCertified: true, certificate: res.certificate }); return; }
            setGrandSessionId(res.sessionId ?? '');
            setGrandQuestions(res.questions ?? []);
        } catch (e: any) { Alert.alert('Error', e?.error || 'Grand test locked'); setGrandModal(false); }
        finally { setGrandLoading(false); }
    };

    const submitGrandTest = async () => {
        const unanswered = grandQuestions.filter(q => !grandAnswers[q.id]);
        if (unanswered.length) { Alert.alert('Incomplete', 'Answer all questions.'); return; }
        setGrandLoading(true);
        try {
            const res = await api.roadmapGrandTestSubmit({
                sessionId: grandSessionId,
                answers: grandQuestions.map(q => ({ questionId: q.id, selectedOption: grandAnswers[q.id] ?? '' })),
            });
            setGrandResult(res);
            if (res?.certificate) setCertificate(res.certificate);
            load();
        } catch (e: any) { Alert.alert('Error', e?.error || 'Submit failed'); }
        finally { setGrandLoading(false); }
    };

    if (loading) return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="light" /><ActivityIndicator color={COLORS.primary} size="large" />
        </View>
    );

    // Gate — assessments not complete
    if (!allExamsDone) {
        const doneCount = [examStatus?.aptitude?.latest, examStatus?.dsa?.latest, examStatus?.soft_skills?.latest, examStatus?.career?.latest].filter(Boolean).length;
        const nextExam = !examStatus?.aptitude?.latest ? 'aptitude' : !examStatus?.dsa?.latest ? 'dsa' : !examStatus?.soft_skills?.latest ? 'soft_skills' : 'career';
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
                <StatusBar style="light" />
                <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={s.header}><Text style={s.title}>Learning Roadmap</Text></LinearGradient>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                    <Icon name="lock-closed" size={48} color={COLORS.textDim} />
                    <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>Complete All Assessments</Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>{doneCount}/4 done. Your 12-week plan unlocks after all tests.</Text>
                    <View style={{ backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 14, marginTop: 20, gap: 10, width: '100%' }}>
                        {(['aptitude', 'dsa', 'soft_skills', 'career'] as const).map(k => (
                            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Icon name={examStatus?.[k]?.latest ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={examStatus?.[k]?.latest ? COLORS.success : COLORS.textDim} />
                                <Text style={{ color: examStatus?.[k]?.latest ? COLORS.text : COLORS.textMuted, flex: 1, fontSize: 14 }}>{k === 'soft_skills' ? 'Soft Skills' : k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                                {examStatus?.[k]?.latest && <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: 13 }}>{Math.round(examStatus[k].latest.percentage)}%</Text>}
                            </View>
                        ))}
                    </View>
                    <TouchableOpacity style={{ marginTop: 24, borderRadius: 14, overflow: 'hidden', width: '100%' }}
                        onPress={() => router.push({ pathname: '/exam', params: { type: nextExam } })}>
                        <LinearGradient colors={COLORS.gradPrimary} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Continue Assessments →</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Roadmap loaded
    const completedWeeks = roadmap.filter(w => w.status === 'completed').length;
    const totalDays = roadmap.reduce((a, w) => a + (w.days?.length ?? 0), 0);
    const completedDays = roadmap.reduce((a, w) => a + (w.days?.filter(d => d.status === 'completed')?.length ?? 0), 0);
    const progress = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;
    const week12Done = roadmap.some(w => Number(w.week) === 12 && w.status === 'completed');

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />} showsVerticalScrollIndicator={false}>
                <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={s.header}>
                    <Text style={s.title}>12-Week Learning Roadmap</Text>
                    <View style={s.progressBar}><View style={[s.progressFill, { width: `${progress}%` }]} /></View>
                    <Text style={s.progressText}>{completedDays}/{totalDays} days · {completedWeeks}/{roadmap.length} weeks · {progress}%</Text>
                </LinearGradient>

                <View style={{ padding: 16 }}>
                    {/* Timeline */}
                    <View style={{ borderLeftWidth: 2, borderLeftColor: COLORS.bgBorder, marginLeft: 18 }}>
                        {roadmap.map((week) => {
                            const isExpanded = expandedWeek === week.week;
                            const wDays = week.days ?? [];
                            const wCompleted = wDays.filter(d => d.status === 'completed').length;
                            const isLocked = week.status === 'locked';
                            const isDone = week.status === 'completed';
                            return (
                                <View key={week.week} style={{ marginBottom: 4, paddingLeft: 20, position: 'relative' }}>
                                    {/* Node dot */}
                                    <View style={[s.nodeDot, isDone && s.nodeDone, isLocked && s.nodeLocked, !isDone && !isLocked && s.nodeActive]} />

                                    <TouchableOpacity onPress={() => !isLocked && setExpandedWeek(isExpanded ? null : week.week)} disabled={isLocked}
                                        style={[s.weekCard, isLocked && { opacity: 0.5 }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Icon name={isDone ? 'checkmark-circle' : isLocked ? 'lock-closed' : 'rocket'} size={20}
                                                color={isDone ? COLORS.success : isLocked ? COLORS.textDim : COLORS.primary} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.weekTitle}>{week.title || `Week ${week.week}`}</Text>
                                                <Text style={s.weekSub}>{wCompleted}/{wDays.length} days{isDone ? ' · Completed ✓' : ''}</Text>
                                            </View>
                                            {!isLocked && <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textMuted} />}
                                        </View>
                                        {!isDone && !isLocked && (
                                            <View style={s.weekProgress}><View style={[s.weekProgressFill, { width: `${wDays.length ? (wCompleted / wDays.length) * 100 : 0}%` }]} /></View>
                                        )}
                                    </TouchableOpacity>

                                    {/* Expanded days */}
                                    {isExpanded && !isLocked && (
                                        <View style={{ gap: 6, marginTop: 6, marginLeft: 8 }}>
                                            {wDays.map(day => (
                                                <View key={day.day} style={s.dayCard}>
                                                    <TouchableOpacity onPress={() => { if (day.status !== 'completed') completeDay(week.week, day.day); }} disabled={day.status === 'completed'}>
                                                        <Icon name={day.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'} size={22}
                                                            color={day.status === 'completed' ? COLORS.success : COLORS.textDim} />
                                                    </TouchableOpacity>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[s.dayTitle, day.status === 'completed' && { color: COLORS.textMuted }]}>Day {day.day}: {day.topic}</Text>
                                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                                                            <TouchableOpacity onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/search/${encodeURIComponent(day.topic)}`)}>
                                                                <Text style={s.linkBtn}>GFG</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(day.topic + ' tutorial')}`)}>
                                                                <Text style={s.linkBtn}>YouTube</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                    {day.status !== 'completed' && (
                                                        <TouchableOpacity onPress={() => completeDay(week.week, day.day)} style={s.markDoneBtn}>
                                                            <Text style={s.markDoneText}>Done</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            ))}

                                            {/* Weekly Test */}
                                            {week.week <= 12 && (
                                                <TouchableOpacity style={[s.testCard, !week.testAvailable && { opacity: 0.5 }]}
                                                    onPress={() => week.testAvailable && !isDone && openWeeklyTest(week.week)} disabled={!week.testAvailable || isDone}>
                                                    <LinearGradient colors={week.testAvailable ? COLORS.gradPrimary : [COLORS.bgCard, COLORS.bgCard] as [string, string]} style={s.testGrad}>
                                                        <Icon name="document-text" size={18} color={week.testAvailable ? '#fff' : COLORS.textDim} />
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ color: week.testAvailable ? '#fff' : COLORS.textDim, fontWeight: '700', fontSize: 14 }}>Week {week.week} Test</Text>
                                                            <Text style={{ color: week.testAvailable ? 'rgba(255,255,255,0.7)' : COLORS.textDim, fontSize: 11 }}>
                                                                {(() => {
                                                                    const req = Number(week.test?.requiredDays ?? 7);
                                                                    const done2 = Number(week.test?.completedDays ?? wCompleted);
                                                                    return week.testAvailable ? `${done2}/${req} ✓ — Ready!` : `${done2}/${req} — Complete all days`;
                                                                })()}
                                                            </Text>
                                                        </View>
                                                        <Text style={{ color: week.testAvailable ? '#fff' : COLORS.textDim, fontWeight: '700', fontSize: 13 }}>
                                                            {isDone ? 'Passed ✓' : week.testAvailable ? 'Take Test' : 'Locked'}
                                                        </Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>

                    {/* Grand Final Test */}
                    <TouchableOpacity style={[s.grandCard, !week12Done && { opacity: 0.5 }]} onPress={() => week12Done && openGrandTest()} disabled={!week12Done}>
                        <LinearGradient colors={week12Done ? COLORS.gradSecondary : [COLORS.bgCard, COLORS.bgCard] as [string, string]} style={s.grandGrad}>
                            <Icon name="trophy" size={28} color={week12Done ? '#fff' : COLORS.textDim} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: week12Done ? '#fff' : COLORS.textDim, fontWeight: '800', fontSize: 16 }}>Grand Final Test</Text>
                                <Text style={{ color: week12Done ? 'rgba(255,255,255,0.7)' : COLORS.textDim, fontSize: 12 }}>
                                    {certificate ? `Certificate: ${certificate.certificateId} · ${Math.round(certificate.percentage ?? 0)}%` :
                                        week12Done ? 'Pass with 50% to earn your certificate' : 'Complete all 12 weeks first'}
                                </Text>
                            </View>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>{certificate ? 'View' : week12Done ? 'Start →' : '🔒'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={{ height: 30 }} />
                </View>
            </ScrollView>

            {/* Weekly Test Modal */}
            <Modal visible={testModal} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Week {testWeek} Test</Text>
                        <TouchableOpacity onPress={() => setTestModal(false)}><Icon name="close" size={24} color={COLORS.textMuted} /></TouchableOpacity>
                    </View>
                    {testLoading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
                    {testResult ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            <Icon name={testResult.passed ? 'checkmark-circle' : 'close-circle'} size={48} color={testResult.passed ? COLORS.success : COLORS.error} />
                            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{testResult.passed ? 'Passed! ✓' : 'Not Passed'}</Text>
                            <Text style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 8 }}>Score: {testResult.score}/{testResult.totalQuestions} ({Math.round(testResult.percentage)}%)</Text>
                            <TouchableOpacity onPress={() => setTestModal(false)} style={{ marginTop: 24, backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView style={{ flex: 1, padding: 16 }}>
                            {testQuestions.map((q, idx) => (
                                <View key={q.id} style={s.testQ}>
                                    <Text style={s.testQText}>Q{idx + 1}. {q.question}</Text>
                                    {q.options?.map((opt: string, oi: number) => (
                                        <TouchableOpacity key={oi} style={[s.testOpt, testAnswers[q.id] === opt && s.testOptSel]}
                                            onPress={() => setTestAnswers(p => ({ ...p, [q.id]: opt }))}>
                                            <View style={[s.testRadio, testAnswers[q.id] === opt && s.testRadioSel]} />
                                            <Text style={[s.testOptText, testAnswers[q.id] === opt && { color: COLORS.text }]}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                            {testQuestions.length > 0 && (
                                <TouchableOpacity onPress={submitWeeklyTest} style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
                                    <LinearGradient colors={COLORS.gradPrimary} style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{testLoading ? 'Submitting…' : 'Submit Test'}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </Modal>

            {/* Grand Test Modal */}
            <Modal visible={grandModal} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
                    <View style={s.modalHeader}>
                        <Text style={s.modalTitle}>Grand Final Test</Text>
                        <TouchableOpacity onPress={() => setGrandModal(false)}><Icon name="close" size={24} color={COLORS.textMuted} /></TouchableOpacity>
                    </View>
                    {grandLoading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />}
                    {grandResult ? (
                        <View style={{ padding: 24, alignItems: 'center' }}>
                            {grandResult.alreadyCertified ? (
                                <>
                                    <Icon name="ribbon" size={48} color={COLORS.warning} />
                                    <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 12 }}>Certificate Issued</Text>
                                    <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>ID: {certificate?.certificateId}</Text>
                                    <Text style={{ color: COLORS.textMuted }}>Score: {Math.round(certificate?.percentage ?? 0)}%</Text>
                                </>
                            ) : (
                                <>
                                    <Icon name={grandResult.passed ? 'trophy' : 'close-circle'} size={48} color={grandResult.passed ? COLORS.success : COLORS.error} />
                                    <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 12 }}>{grandResult.passed ? 'Passed! 🎉' : 'Not Passed'}</Text>
                                    <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>Score: {grandResult.score}/{grandResult.totalQuestions} ({Math.round(grandResult.percentage)}%)</Text>
                                    {grandResult.certificate && <Text style={{ color: COLORS.warning, marginTop: 8, fontWeight: '700' }}>Certificate: {grandResult.certificate.certificateId}</Text>}
                                </>
                            )}
                            <TouchableOpacity onPress={() => setGrandModal(false)} style={{ marginTop: 24, backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
                                <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView style={{ flex: 1, padding: 16 }}>
                            <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 16 }}>Pass with 50% to earn your certificate.</Text>
                            {grandQuestions.map((q, idx) => (
                                <View key={q.id} style={s.testQ}>
                                    <Text style={s.testQText}>Q{idx + 1}. {q.question}</Text>
                                    {q.options?.map((opt: string, oi: number) => (
                                        <TouchableOpacity key={oi} style={[s.testOpt, grandAnswers[q.id] === opt && s.testOptSel]}
                                            onPress={() => setGrandAnswers(p => ({ ...p, [q.id]: opt }))}>
                                            <View style={[s.testRadio, grandAnswers[q.id] === opt && s.testRadioSel]} />
                                            <Text style={[s.testOptText, grandAnswers[q.id] === opt && { color: COLORS.text }]}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ))}
                            {grandQuestions.length > 0 && (
                                <TouchableOpacity onPress={submitGrandTest} style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
                                    <LinearGradient colors={COLORS.gradSecondary} style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{grandLoading ? 'Submitting…' : 'Submit Grand Test'}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    header: { padding: 20, paddingTop: 56, paddingBottom: 20 },
    title: { color: COLORS.text, fontSize: 20, fontWeight: '800', marginBottom: 12 },
    progressBar: { height: 8, backgroundColor: COLORS.bgBorder, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
    progressFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 4 },
    progressText: { color: COLORS.textMuted, fontSize: 12 },
    nodeDot: { position: 'absolute', left: -27, top: 16, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
    nodeDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
    nodeActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    nodeLocked: { backgroundColor: COLORS.bgCard, borderColor: COLORS.bgBorder },
    weekCard: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 4 },
    weekTitle: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
    weekSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
    weekProgress: { height: 4, backgroundColor: COLORS.bgBorder, borderRadius: 2, overflow: 'hidden', marginTop: 10 },
    weekProgressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
    dayCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.bgBorder },
    dayTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
    linkBtn: { color: COLORS.primary, fontSize: 12, fontWeight: '700', backgroundColor: COLORS.primary + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    markDoneBtn: { backgroundColor: COLORS.bgInput, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    markDoneText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
    testCard: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
    testGrad: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12 },
    grandCard: { borderRadius: 16, overflow: 'hidden', marginTop: 20 },
    grandGrad: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderRadius: 16 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: COLORS.bgBorder },
    modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    testQ: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.bgBorder },
    testQText: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 12 },
    testOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
    testOptSel: { backgroundColor: COLORS.primary + '12', borderRadius: 8, paddingHorizontal: 8 },
    testOptText: { color: COLORS.textMuted, fontSize: 14, flex: 1 },
    testRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.bgBorder },
    testRadioSel: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
});
