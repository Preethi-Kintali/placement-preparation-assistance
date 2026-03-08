import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

const EXAMS = [
    { title: 'Aptitude', key: 'aptitude', icon: 'bulb' as const, grad: ['#667eea', '#764ba2'] as [string, string] },
    { title: 'DSA', key: 'dsa', icon: 'code-slash' as const, grad: ['#f093fb', '#f5576c'] as [string, string] },
    { title: 'Soft Skills', key: 'soft_skills', icon: 'people' as const, grad: ['#4facfe', '#00f2fe'] as [string, string] },
    { title: 'Career Path', key: 'career', icon: 'briefcase' as const, grad: ['#43e97b', '#38f9d7'] as [string, string] },
];

export default function DashboardScreen() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const [status, setStatus] = useState<any>(null);
    const [prediction, setPrediction] = useState<any>(null);
    const [predLoading, setPredLoading] = useState(false);
    const [roadmapStats, setRoadmapStats] = useState<{ completedWeeks: number; totalWeeks: number } | null>(null);
    const [interviewAvg, setInterviewAvg] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'assessments' | 'prediction' | 'improve'>('assessments');
    const [detailOpen, setDetailOpen] = useState<string | null>(null);

    const load = async () => {
        try {
            const [es, sessions] = await Promise.all([
                api.examStatus().catch(() => null),
                api.interviewSessions().catch(() => null),
            ]);
            setStatus(es);
            // Interview average
            const ss = Array.isArray(sessions?.sessions) ? sessions.sessions : [];
            if (ss.length) {
                const avg = ss.reduce((s: number, a: any) => s + (Number(a?.overallScore) || 0), 0) / ss.length;
                setInterviewAvg(Number(avg.toFixed(2)));
            }
            // Roadmap stats
            const allDone = es?.aptitude?.latest && es?.dsa?.latest && es?.soft_skills?.latest && es?.career?.latest;
            if (allDone) {
                try {
                    const rm = await api.roadmap();
                    const weeks = Array.isArray(rm?.weeks) ? rm.weeks : [];
                    setRoadmapStats({ completedWeeks: weeks.filter((w: any) => w?.status === 'completed').length, totalWeeks: weeks.length });
                } catch { }
            }
            refreshUser();
        } catch { } finally { setLoading(false); setRefreshing(false); }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const loadPrediction = async () => {
        setPredLoading(true);
        try { setPrediction(await api.placementPrediction()); } catch { setPrediction(null); }
        finally { setPredLoading(false); }
    };

    // Computed values matching web app exactly
    const pct = (attempt: any) => typeof attempt?.percentage === 'number' ? Number(attempt.percentage) : null;
    const allExamsDone = Boolean(status?.aptitude?.latest && status?.dsa?.latest && status?.soft_skills?.latest && status?.career?.latest);
    const completedExams = EXAMS.map(e => ({ ...e, latest: status?.[e.key]?.latest ?? null, previous: status?.[e.key]?.previous ?? null, completed: Boolean(status?.[e.key]?.latest) })).filter(e => e.completed);
    const latestPcts = completedExams.map(e => ({ key: e.key, title: e.title, value: pct(e.latest) })).filter(x => x.value !== null) as { key: string; title: string; value: number }[];
    const avgLatest = latestPcts.length ? latestPcts.reduce((s, x) => s + x.value, 0) / latestPcts.length : 0;
    const strongest = latestPcts.slice().sort((a, b) => b.value - a.value)[0];
    const weakest = latestPcts.slice().sort((a, b) => a.value - b.value)[0];
    const roadmapPct = roadmapStats?.totalWeeks ? (roadmapStats.completedWeeks / roadmapStats.totalWeeks) * 100 : null;
    const interviewPct = interviewAvg != null ? interviewAvg * 10 : null;
    // Weighted readiness: 50% exams + 30% roadmap + 20% interview
    const readinessPct = (() => {
        const parts: { value: number; weight: number }[] = [];
        if (completedExams.length > 0) parts.push({ value: avgLatest, weight: 0.5 });
        if (typeof roadmapPct === 'number') parts.push({ value: roadmapPct, weight: 0.3 });
        if (typeof interviewPct === 'number') parts.push({ value: interviewPct, weight: 0.2 });
        if (!parts.length) return 0;
        const tw = parts.reduce((s, p) => s + p.weight, 0);
        return parts.reduce((s, p) => s + p.value * (p.weight / tw), 0);
    })();
    const readinessLevel = readinessPct >= 85 ? 'Excellent' : readinessPct >= 70 ? 'Good' : readinessPct >= 40 ? 'Fair' : 'Getting Started';
    const ranking = readinessPct >= 85 ? 'Top 10%' : readinessPct >= 70 ? 'Top 25%' : readinessPct >= 40 ? 'Top 50%' : 'Keep going';
    const nextExam = ['aptitude', 'dsa', 'soft_skills', 'career'].find(k => !status?.[k]?.latest && (status?.[k]?.unlocked ?? k === 'aptitude'));

    if (loading) return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="light" /><ActivityIndicator color={COLORS.primary} size="large" />
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />} showsVerticalScrollIndicator={false}>
                {/* Welcome */}
                <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={s.headerGrad}>
                    <View style={s.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.greeting}>Welcome back, {user?.profile?.fullName?.split(' ')[0] || 'Student'}! 👋</Text>
                            <Text style={s.career}>
                                🎯 Targeting {user?.profile?.career?.targetCompany || 'your dream company'} · {user?.profile?.career?.careerPath || 'Full Stack Developer'}
                            </Text>
                        </View>
                        {allExamsDone ? (
                            <TouchableOpacity onPress={() => router.push('/(tabs)/roadmap')}>
                                <LinearGradient colors={COLORS.gradPrimary} style={s.navBtn}><Text style={s.navBtnText}>Roadmap →</Text></LinearGradient>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </LinearGradient>

                <View style={{ padding: 16, marginTop: -12 }}>
                    {/* KPI Cards */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        {([
                            { label: 'Tests Taken', value: `${completedExams.length}`, icon: 'bar-chart' },
                            { label: 'Avg Score', value: `${Math.round(avgLatest)}%`, icon: 'analytics' },
                            { label: 'Strongest', value: strongest?.title ?? '—', icon: 'medal' },
                            { label: 'Weakest', value: weakest?.title ?? '—', icon: 'trending-down' },
                            { label: 'Readiness', value: readinessLevel, icon: 'sparkles' },
                        ] as const).map(kpi => (
                            <View key={kpi.label} style={s.kpiCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={s.kpiLabel}>{kpi.label}</Text>
                                    <Icon name={kpi.icon as any} size={14} color={COLORS.primary} />
                                </View>
                                <Text style={s.kpiValue}>{kpi.value}</Text>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Readiness Hub */}
                    <View style={s.readinessCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={[s.readCircle, { borderColor: readinessPct >= 70 ? COLORS.success : readinessPct >= 40 ? COLORS.warning : COLORS.error }]}>
                                <Text style={[s.readPct, { color: readinessPct >= 70 ? COLORS.success : readinessPct >= 40 ? COLORS.warning : COLORS.error }]}>{Math.round(readinessPct)}%</Text>
                                <Text style={s.readLabel}>Ready</Text>
                            </View>
                            <View style={{ flex: 1, gap: 4 }}>
                                <Text style={s.readTitle}>Overall Readiness</Text>
                                <Text style={s.readSub}>Based on test scores, roadmap, and interviews</Text>
                                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                    <View style={s.readBadge}><Text style={s.readBadgeText}>{ranking}</Text></View>
                                    <View style={s.readBadge}><Text style={s.readBadgeText}>{readinessLevel}</Text></View>
                                </View>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                            {([
                                { label: 'Assessments', value: `${completedExams.length}/4` },
                                { label: 'Avg Score', value: `${Math.round(avgLatest)}%` },
                                { label: 'Next Step', value: allExamsDone ? 'Roadmap' : 'Take tests' },
                            ] as const).map(st => (
                                <View key={st.label} style={s.readStat}>
                                    <Text style={s.readStatLabel}>{st.label}</Text>
                                    <Text style={s.readStatVal}>{st.value}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Tabs: Assessments / Prediction / Improve */}
                    <View style={s.tabRow}>
                        {(['assessments', 'prediction', 'improve'] as const).map(tab => (
                            <TouchableOpacity key={tab} style={[s.tabBtn, activeTab === tab && s.tabActive]}
                                onPress={() => { setActiveTab(tab); if ((tab === 'prediction' || tab === 'improve') && !prediction && !predLoading) loadPrediction(); }}>
                                <Icon name={tab === 'assessments' ? 'trophy' : tab === 'prediction' ? 'analytics' : 'sparkles'} size={14} color={activeTab === tab ? COLORS.primary : COLORS.textDim} />
                                <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab === 'assessments' ? 'Tests' : tab === 'prediction' ? 'Prediction' : 'Improve'}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Tab Content */}
                    {activeTab === 'assessments' && (
                        <View>
                            {/* Continue CTA */}
                            {nextExam && (
                                <TouchableOpacity onPress={() => router.push({ pathname: '/exam', params: { type: nextExam } })} style={{ marginBottom: 12 }}>
                                    <LinearGradient colors={COLORS.gradPrimary} style={s.ctaBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                        <Icon name="play-circle" size={20} color="#fff" />
                                        <Text style={s.ctaText}>Continue: {EXAMS.find(e => e.key === nextExam)?.title} Test</Text>
                                        <Icon name="arrow-forward" size={16} color="#fff" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}

                            {/* All done banner */}
                            {allExamsDone && (
                                <View style={s.doneBanner}>
                                    <Text style={{ color: COLORS.text, fontWeight: '700' }}>All assessments completed 🎉</Text>
                                    <TouchableOpacity onPress={() => {
                                        Alert.alert('Retake', 'Which test?', [
                                            ...EXAMS.map(e => ({ text: e.title, onPress: () => router.push({ pathname: '/exam', params: { type: e.key } }) })),
                                            { text: 'Cancel', style: 'cancel' as const },
                                        ]);
                                    }}>
                                        <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>Retake</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Exam cards */}
                            <View style={s.examGrid}>
                                {EXAMS.map(exam => {
                                    const score = pct(status?.[exam.key]?.latest);
                                    const locked = !(status?.[exam.key]?.unlocked ?? exam.key === 'aptitude');
                                    const grade = status?.[exam.key]?.latest?.grade;
                                    const prev = pct(status?.[exam.key]?.previous);
                                    const delta = score != null && prev != null ? score - prev : null;
                                    const isOpen = detailOpen === exam.key;

                                    return (
                                        <View key={exam.key} style={s.examCard}>
                                            <TouchableOpacity onPress={() => {
                                                if (locked) { Alert.alert('Locked', 'Complete previous tests first.'); return; }
                                                if (score != null) setDetailOpen(isOpen ? null : exam.key); else router.push({ pathname: '/exam', params: { type: exam.key } });
                                            }}>
                                                <LinearGradient colors={locked ? [COLORS.bgCard, COLORS.bgCard] as [string, string] : exam.grad} style={s.examGrad}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Icon name={exam.icon} size={20} color={locked ? COLORS.textDim : '#fff'} />
                                                        {locked && <Icon name="lock-closed" size={14} color={COLORS.textDim} />}
                                                        {score != null && <Text style={s.examScore}>{Math.round(score)}%</Text>}
                                                    </View>
                                                    <Text style={[s.examTitle, locked && { color: COLORS.textDim }]}>{exam.title}</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={[s.examStatus, locked && { color: COLORS.textDim }]}>
                                                            {locked ? 'Locked' : score != null ? `Grade: ${grade ?? '—'}` : 'Start →'}
                                                        </Text>
                                                        {delta != null && <Text style={{ color: delta >= 0 ? '#4ade80' : '#f87171', fontSize: 11 }}>{delta >= 0 ? '+' : ''}{Math.round(delta)}%</Text>}
                                                    </View>
                                                </LinearGradient>
                                            </TouchableOpacity>

                                            {/* Details expand */}
                                            {isOpen && score != null && (
                                                <View style={s.detailBox}>
                                                    <View style={s.detailRow}><Text style={s.detailLabel}>Score</Text><Text style={s.detailVal}>{status[exam.key].latest.score}/{status[exam.key].latest.totalQuestions}</Text></View>
                                                    <View style={s.detailRow}><Text style={s.detailLabel}>Grade</Text><Text style={s.detailVal}>{grade ?? '—'}</Text></View>
                                                    <View style={s.detailRow}><Text style={s.detailLabel}>Percentage</Text><Text style={s.detailVal}>{Math.round(score)}%</Text></View>
                                                    {status[exam.key].latest?.createdAt && <Text style={{ color: COLORS.textDim, fontSize: 11, marginTop: 6 }}>Taken: {new Date(status[exam.key].latest.createdAt).toLocaleDateString()}</Text>}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {activeTab === 'prediction' && (
                        <View style={s.tabContent}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <View><Text style={s.tabCardTitle}>Placement Chance</Text><Text style={s.tabCardSub}>Based on profile + latest scores</Text></View>
                                <TouchableOpacity onPress={loadPrediction} style={s.refreshBtn}><Text style={s.refreshText}>{predLoading ? 'Calculating…' : 'Refresh'}</Text></TouchableOpacity>
                            </View>
                            {prediction && (
                                <>
                                    <Text style={s.predBig}>{prediction.probability}%</Text>
                                    <View style={s.predBar}><View style={[s.predBarFill, { width: `${Math.min(100, prediction.probability)}%` }]} /></View>
                                    {Array.isArray(prediction.checklist) && prediction.checklist.length > 0 && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Action Items:</Text>
                                            {prediction.checklist.map((c: string, i: number) =>
                                                <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                                                    <Text style={{ color: COLORS.primary }}>•</Text>
                                                    <Text style={{ color: COLORS.textMuted, fontSize: 13, flex: 1 }}>{c}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </>
                            )}
                            {!prediction && !predLoading && <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>Tap "Refresh" to generate your prediction.</Text>}
                            {predLoading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />}
                        </View>
                    )}

                    {activeTab === 'improve' && (
                        <View style={s.tabContent}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <View><Text style={s.tabCardTitle}>Improve Your Chances</Text><Text style={s.tabCardSub}>Actions based on your profile inputs</Text></View>
                                <TouchableOpacity onPress={loadPrediction} style={s.refreshBtn}><Text style={s.refreshText}>{predLoading ? 'Loading' : prediction ? 'Refresh' : 'Load'}</Text></TouchableOpacity>
                            </View>
                            {prediction && (
                                <View style={{ gap: 12 }}>
                                    {/* Current inputs */}
                                    <View style={s.inputsCard}>
                                        <Text style={s.inputsTitle}>Your Current Inputs</Text>
                                        {[
                                            { label: 'Internships', value: prediction.inputsUsed?.internships ? 'Yes' : 'No' },
                                            { label: 'Projects', value: prediction.inputsUsed?.projects ?? 0 },
                                            { label: 'Workshops/Certs', value: prediction.inputsUsed?.workshopsCertifications ?? 0 },
                                            { label: 'CGPA', value: prediction.inputsUsed?.cgpa ?? 0 },
                                            { label: 'SSC/HSC', value: `${prediction.inputsUsed?.sscMarks ?? 0}% / ${prediction.inputsUsed?.hscMarks ?? 0}%` },
                                        ].map(row => (
                                            <View key={row.label} style={s.inputRow}>
                                                <Text style={s.inputLabel}>{row.label}</Text>
                                                <Text style={s.inputVal}>{String(row.value)}</Text>
                                            </View>
                                        ))}
                                        {prediction.inputsUsed?.interviewOverall != null && (
                                            <>
                                                <View style={s.inputRow}><Text style={s.inputLabel}>Interview Overall</Text><Text style={s.inputVal}>{prediction.inputsUsed.interviewOverall}/10</Text></View>
                                                <View style={s.inputRow}><Text style={s.inputLabel}>Comm / DSA / Tech</Text><Text style={s.inputVal}>{prediction.inputsUsed.interviewCommunication}/10 / {prediction.inputsUsed.interviewDsa}/10 / {prediction.inputsUsed.interviewTechnical}/10</Text></View>
                                            </>
                                        )}
                                    </View>

                                    {/* Actions */}
                                    <View style={s.inputsCard}>
                                        <Text style={s.inputsTitle}>What To Do Next</Text>
                                        {!prediction.inputsUsed?.internships && <Text style={s.actionItem}>• Get at least 1 internship (even remote/short-term)</Text>}
                                        {(prediction.inputsUsed?.projects ?? 0) < 3 && <Text style={s.actionItem}>• Build 3+ solid projects (deployed + GitHub)</Text>}
                                        {(prediction.inputsUsed?.workshopsCertifications ?? 0) < 2 && <Text style={s.actionItem}>• Complete 2–3 workshops/certifications</Text>}
                                        <Text style={s.actionItem}>• Keep applying weekly and track applications</Text>
                                        <Text style={s.actionItem}>• Do mock interviews and improve weak areas</Text>

                                        {Array.isArray(prediction.checklist) && prediction.checklist.length > 0 && (
                                            <>
                                                <Text style={[s.inputsTitle, { marginTop: 12 }]}>Priority Actions (AI + Profile)</Text>
                                                {prediction.checklist.map((c: string, i: number) => <Text key={i} style={s.actionItem}>• {c}</Text>)}
                                            </>
                                        )}
                                    </View>
                                </View>
                            )}
                            {!prediction && !predLoading && <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>Tap "Load" to see personalized actions.</Text>}
                            {predLoading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />}
                        </View>
                    )}

                    {/* Quick Actions */}
                    <Text style={s.secTitle}>Quick Actions</Text>
                    <View style={s.quickRow}>
                        {([
                            { icon: 'map', label: 'Roadmap', route: '/(tabs)/roadmap', grad: COLORS.gradSecondary, locked: !allExamsDone },
                            { icon: 'mic', label: 'Interview', route: '/(tabs)/interview', grad: COLORS.gradPrimary, locked: false },
                            { icon: 'chatbubbles', label: 'Study AI', route: '/(tabs)/study', grad: ['#f093fb', '#f5576c'] as [string, string], locked: false },
                            { icon: 'trophy', label: 'Ranks', route: '/(tabs)/leaderboard', grad: ['#ffecd2', '#fcb69f'] as [string, string], locked: false },
                            { icon: 'document-text', label: 'Resume ATS', route: '/resume-ats', grad: ['#43e97b', '#38f9d7'] as [string, string], locked: false },
                        ] as const).map(q => (
                            <TouchableOpacity key={q.label} onPress={() => { if (q.locked) { Alert.alert('Locked', 'Complete all 4 assessments first.'); return; } router.push(q.route as any); }}
                                style={[s.quickCard, q.locked && { opacity: 0.5 }]}>
                                <LinearGradient colors={q.grad} style={s.quickIcon}><Icon name={q.icon as any} size={18} color="#fff" /></LinearGradient>
                                <Text style={s.quickLabel}>{q.label}</Text>
                                {q.locked && <Icon name="lock-closed" size={10} color={COLORS.textDim} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={{ height: 30 }} />
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    headerGrad: { padding: 20, paddingTop: 56, paddingBottom: 24 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    greeting: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
    career: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
    navBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    navBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    kpiCard: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 12, marginRight: 10, width: 130, borderWidth: 1, borderColor: COLORS.bgBorder },
    kpiLabel: { color: COLORS.textDim, fontSize: 10 },
    kpiValue: { color: COLORS.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
    readinessCard: { backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 16 },
    readCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
    readPct: { fontSize: 22, fontWeight: '900' },
    readLabel: { color: COLORS.textMuted, fontSize: 10 },
    readTitle: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
    readSub: { color: COLORS.textMuted, fontSize: 12 },
    readBadge: { backgroundColor: COLORS.bgInput, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    readBadgeText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
    readStat: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 10, padding: 10 },
    readStatLabel: { color: COLORS.textDim, fontSize: 10 },
    readStatVal: { color: COLORS.text, fontWeight: '700', fontSize: 13, marginTop: 2 },
    tabRow: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: COLORS.bgBorder },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10 },
    tabActive: { backgroundColor: COLORS.bg },
    tabText: { color: COLORS.textDim, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: COLORS.primary },
    ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14 },
    ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    doneBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 12 },
    examGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    examCard: { width: '48%' },
    examGrad: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.bgBorder, minHeight: 100 },
    examTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginTop: 8 },
    examScore: { color: '#fff', fontWeight: '800', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    examStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
    detailBox: { backgroundColor: COLORS.bgCard, borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: COLORS.bgBorder },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    detailLabel: { color: COLORS.textDim, fontSize: 12 },
    detailVal: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
    tabContent: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 16 },
    tabCardTitle: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
    tabCardSub: { color: COLORS.textDim, fontSize: 11 },
    refreshBtn: { backgroundColor: COLORS.bgInput, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    refreshText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
    predBig: { color: COLORS.text, fontSize: 32, fontWeight: '900' },
    predBar: { height: 10, backgroundColor: COLORS.bgBorder, borderRadius: 5, overflow: 'hidden', marginTop: 8 },
    predBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 5 },
    inputsCard: { backgroundColor: COLORS.bg, borderRadius: 12, padding: 14 },
    inputsTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    inputLabel: { color: COLORS.textMuted, fontSize: 12 },
    inputVal: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
    actionItem: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4, lineHeight: 20 },
    secTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 12, marginTop: 4 },
    quickRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    quickCard: { flex: 1, alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.bgBorder, gap: 6 },
    quickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    quickLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600' },
});
