import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { COLORS } from '../constants/colors';
import { StatusBar } from 'expo-status-bar';

type PickedFile = { uri: string; name: string; size?: number };

export default function ResumeATSScreen() {
    const router = useRouter();
    const [resumeFile, setResumeFile] = useState<PickedFile | null>(null);
    const [jdFile, setJdFile] = useState<PickedFile | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'score' | 'skills' | 'recs'>('score');

    const pickFile = async (setter: (f: PickedFile | null) => void) => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });
            if (!res.canceled && res.assets?.[0]) {
                const asset = res.assets[0];
                setter({ uri: asset.uri, name: asset.name, size: asset.size ?? undefined });
            }
        } catch {
            Alert.alert('Error', 'Could not pick file');
        }
    };

    const analyze = async () => {
        if (!resumeFile || loading) return;
        setLoading(true);
        setResult(null);
        try {
            const data = await api.resumeAnalyze(
                resumeFile.uri,
                resumeFile.name,
                jdFile?.uri,
                jdFile?.name,
            );
            setResult(data);
        } catch (err: any) {
            Alert.alert('Analysis Failed', err?.error || err?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const scoreColor = (score: number) =>
        score >= 80 ? COLORS.success : score >= 60 ? COLORS.warning : COLORS.error;

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={s.header}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                        <Icon name="arrow-back" size={20} color={COLORS.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={s.title}>📝 ATS Resume Analyzer</Text>
                        <Text style={s.subtitle}>Upload Resume (required) • JD optional</Text>
                    </View>
                </LinearGradient>

                <View style={{ padding: 16, marginTop: -12 }}>
                    {/* Upload Cards */}
                    <View style={s.uploadRow}>
                        {/* Resume upload */}
                        <TouchableOpacity style={[s.uploadCard, resumeFile && s.uploadCardDone]} onPress={() => pickFile(setResumeFile)}>
                            <Text style={s.uploadEmoji}>{resumeFile ? '✅' : '📄'}</Text>
                            <Text style={s.uploadLabel} numberOfLines={1}>
                                {resumeFile ? resumeFile.name : 'Resume PDF *'}
                            </Text>
                            <Text style={s.uploadHint}>{resumeFile ? `${((resumeFile.size ?? 0) / 1024).toFixed(0)} KB` : 'Required'}</Text>
                            {resumeFile && (
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); setResumeFile(null); setResult(null); }} style={s.removeBtn}>
                                    <Icon name="close-circle" size={16} color={COLORS.error} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>

                        {/* JD upload */}
                        <TouchableOpacity style={[s.uploadCard, jdFile && s.uploadCardDone]} onPress={() => pickFile(setJdFile)}>
                            <Text style={s.uploadEmoji}>{jdFile ? '✅' : '📋'}</Text>
                            <Text style={s.uploadLabel} numberOfLines={1}>
                                {jdFile ? jdFile.name : 'Job Description'}
                            </Text>
                            <Text style={s.uploadHint}>{jdFile ? `${((jdFile.size ?? 0) / 1024).toFixed(0)} KB` : 'Optional'}</Text>
                            {jdFile && (
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); setJdFile(null); }} style={s.removeBtn}>
                                    <Icon name="close-circle" size={16} color={COLORS.error} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Analyze button */}
                    <TouchableOpacity disabled={!resumeFile || loading} onPress={analyze} style={{ marginBottom: 16 }}>
                        <LinearGradient
                            colors={(!resumeFile || loading) ? [COLORS.bgCard, COLORS.bgCard] as const : COLORS.gradPrimary}
                            style={s.analyzeBtn}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        >
                            {loading ? (
                                <>
                                    <ActivityIndicator color="#fff" size="small" />
                                    <Text style={s.analyzeBtnText}>Analyzing...</Text>
                                </>
                            ) : (
                                <>
                                    <Icon name="analytics" size={20} color={!resumeFile ? COLORS.textDim : '#fff'} />
                                    <Text style={[s.analyzeBtnText, !resumeFile && { color: COLORS.textDim }]}>
                                        Analyze Resume
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Results */}
                    {result && (
                        <>
                            {/* Score Card */}
                            <View style={s.scoreCard}>
                                <View style={[s.scoreCircle, { borderColor: scoreColor(result.atsScore) }]}>
                                    <Text style={[s.scoreBig, { color: scoreColor(result.atsScore) }]}>{result.atsScore}</Text>
                                    <Text style={s.scoreLabel}>/ 100</Text>
                                </View>
                                <View style={{ flex: 1, gap: 4 }}>
                                    <Text style={s.scoreTitle}>ATS Score</Text>
                                    <Text style={s.scoreSub}>Category: {result.categoryPrediction}</Text>
                                    <View style={s.badgeRow}>
                                        {result.atsScore >= 80 && <View style={[s.badge, { backgroundColor: '#00d4aa22' }]}><Text style={[s.badgeText, { color: COLORS.success }]}>Strong</Text></View>}
                                        {result.atsScore >= 60 && result.atsScore < 80 && <View style={[s.badge, { backgroundColor: '#ffa72622' }]}><Text style={[s.badgeText, { color: COLORS.warning }]}>Good</Text></View>}
                                        {result.atsScore < 60 && <View style={[s.badge, { backgroundColor: '#ff525222' }]}><Text style={[s.badgeText, { color: COLORS.error }]}>Needs Work</Text></View>}
                                        {result.jdFileName && <View style={s.badge}><Text style={s.badgeText}>vs JD</Text></View>}
                                    </View>
                                </View>
                            </View>

                            {/* Score Breakdown */}
                            {result.scoreBreakdown && (
                                <View style={s.card}>
                                    <Text style={s.cardTitle}>Score Breakdown</Text>
                                    {Object.entries(result.scoreBreakdown).map(([key, val]) => (
                                        <View key={key} style={s.breakdownRow}>
                                            <Text style={s.breakdownLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                                            <View style={s.breakdownBarBg}>
                                                <View style={[s.breakdownBarFill, { width: `${Math.min(100, Number(val))}%`, backgroundColor: Number(val) >= 70 ? COLORS.success : Number(val) >= 40 ? COLORS.warning : COLORS.error }]} />
                                            </View>
                                            <Text style={s.breakdownVal}>{String(val)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Tabs */}
                            <View style={s.tabRow}>
                                {(['score', 'skills', 'recs'] as const).map(tab => (
                                    <TouchableOpacity key={tab} style={[s.tabBtn, activeTab === tab && s.tabActive]} onPress={() => setActiveTab(tab)}>
                                        <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                                            {tab === 'score' ? '📊 Stats' : tab === 'skills' ? '🎯 Skills' : '💡 Recs'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Tab: Stats */}
                            {activeTab === 'score' && (
                                <View style={s.card}>
                                    <View style={s.statRow}><Text style={s.statLabel}>Skills Found</Text><Text style={s.statVal}>{result.extractedSkills?.length || 0}</Text></View>
                                    <View style={s.statRow}><Text style={s.statLabel}>JD Skills</Text><Text style={s.statVal}>{result.jdSkills?.length || 0}</Text></View>
                                    <View style={s.statRow}><Text style={s.statLabel}>Matched</Text><Text style={[s.statVal, { color: COLORS.success }]}>{result.matchedSkills?.length || 0}</Text></View>
                                    <View style={s.statRow}><Text style={s.statLabel}>Missing</Text><Text style={[s.statVal, { color: COLORS.error }]}>{result.missingSkills?.length || 0}</Text></View>
                                    <View style={s.statRow}><Text style={s.statLabel}>Additional</Text><Text style={[s.statVal, { color: COLORS.primary }]}>{result.additionalSkills?.length || 0}</Text></View>
                                </View>
                            )}

                            {/* Tab: Skills */}
                            {activeTab === 'skills' && (
                                <View style={s.card}>
                                    {result.matchedSkills?.length > 0 && (
                                        <>
                                            <Text style={s.skillHeading}>✅ Matched Skills</Text>
                                            <View style={s.chipRow}>
                                                {result.matchedSkills.map((sk: string, i: number) => (
                                                    <View key={i} style={[s.chip, { backgroundColor: '#00d4aa22', borderColor: COLORS.success }]}>
                                                        <Text style={[s.chipText, { color: COLORS.success }]}>{sk}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </>
                                    )}
                                    {result.missingSkills?.length > 0 && (
                                        <>
                                            <Text style={[s.skillHeading, { marginTop: 12 }]}>❌ Missing Skills</Text>
                                            <View style={s.chipRow}>
                                                {result.missingSkills.map((sk: string, i: number) => (
                                                    <View key={i} style={[s.chip, { backgroundColor: '#ff525222', borderColor: COLORS.error }]}>
                                                        <Text style={[s.chipText, { color: COLORS.error }]}>{sk}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </>
                                    )}
                                    {result.additionalSkills?.length > 0 && (
                                        <>
                                            <Text style={[s.skillHeading, { marginTop: 12 }]}>➕ Additional Skills</Text>
                                            <View style={s.chipRow}>
                                                {result.additionalSkills.slice(0, 20).map((sk: string, i: number) => (
                                                    <View key={i} style={[s.chip, { backgroundColor: '#6c63ff22', borderColor: COLORS.primary }]}>
                                                        <Text style={[s.chipText, { color: COLORS.primary }]}>{sk}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </>
                                    )}
                                    {(!result.matchedSkills?.length && !result.missingSkills?.length) && (
                                        <>
                                            <Text style={s.skillHeading}>📋 Resume Skills</Text>
                                            <View style={s.chipRow}>
                                                {(result.extractedSkills || []).slice(0, 25).map((sk: string, i: number) => (
                                                    <View key={i} style={[s.chip, { backgroundColor: '#6c63ff22', borderColor: COLORS.primary }]}>
                                                        <Text style={[s.chipText, { color: COLORS.primary }]}>{sk}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </>
                                    )}
                                </View>
                            )}

                            {/* Tab: Recommendations */}
                            {activeTab === 'recs' && (
                                <View style={s.card}>
                                    <Text style={s.cardTitle}>💡 Recommendations</Text>
                                    {(result.finalRecommendations || []).map((rec: string, i: number) => (
                                        <View key={i} style={s.recItem}>
                                            <LinearGradient colors={COLORS.gradPrimary} style={s.recDot}>
                                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text>
                                            </LinearGradient>
                                            <Text style={s.recText}>{rec}</Text>
                                        </View>
                                    ))}
                                    {(!result.finalRecommendations || result.finalRecommendations.length === 0) && (
                                        <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>No recommendations available.</Text>
                                    )}
                                </View>
                            )}

                            {/* Pipeline */}
                            {result.pipeline?.length > 0 && (
                                <View style={s.card}>
                                    <Text style={s.cardTitle}>⚙️ Analysis Pipeline</Text>
                                    {result.pipeline.map((p: any, i: number) => (
                                        <View key={i} style={s.pipeRow}>
                                            <Text style={s.pipeDot}>{p.status === 'done' ? '✅' : '⏳'}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.pipeStep}>{p.step}</Text>
                                                <Text style={s.pipeDetail}>{p.detail}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </>
                    )}

                    <View style={{ height: 40 }} />
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    header: { padding: 20, paddingTop: 56, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center' },
    title: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
    subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

    uploadRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    uploadCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: COLORS.bgBorder, borderStyle: 'dashed', alignItems: 'center', gap: 6 },
    uploadCardDone: { borderColor: COLORS.success, borderStyle: 'solid' },
    uploadEmoji: { fontSize: 28 },
    uploadLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    uploadHint: { color: COLORS.textDim, fontSize: 11 },
    removeBtn: { position: 'absolute', top: 8, right: 8 },

    analyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14 },
    analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    scoreCard: { backgroundColor: COLORS.bgCard, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.bgBorder, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
    scoreCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
    scoreBig: { fontSize: 26, fontWeight: '900' },
    scoreLabel: { color: COLORS.textMuted, fontSize: 10 },
    scoreTitle: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
    scoreSub: { color: COLORS.textMuted, fontSize: 12 },
    badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    badge: { backgroundColor: COLORS.bgInput, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    badgeText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },

    card: { backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 12 },
    cardTitle: { color: COLORS.text, fontWeight: '700', fontSize: 14, marginBottom: 10 },

    breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    breakdownLabel: { color: COLORS.textMuted, fontSize: 11, width: 90 },
    breakdownBarBg: { flex: 1, height: 8, backgroundColor: COLORS.bgBorder, borderRadius: 4, overflow: 'hidden' },
    breakdownBarFill: { height: '100%', borderRadius: 4 },
    breakdownVal: { color: COLORS.text, fontSize: 11, fontWeight: '700', width: 30, textAlign: 'right' },

    tabRow: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: COLORS.bgBorder },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
    tabActive: { backgroundColor: COLORS.bg },
    tabText: { color: COLORS.textDim, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: COLORS.primary },

    statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    statLabel: { color: COLORS.textMuted, fontSize: 13 },
    statVal: { color: COLORS.text, fontSize: 13, fontWeight: '700' },

    skillHeading: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
    chipText: { fontSize: 11, fontWeight: '600' },

    recItem: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
    recDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    recText: { color: COLORS.textMuted, fontSize: 13, flex: 1, lineHeight: 20 },

    pipeRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
    pipeDot: { fontSize: 14, marginTop: 1 },
    pipeStep: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
    pipeDetail: { color: COLORS.textDim, fontSize: 11 },
});
