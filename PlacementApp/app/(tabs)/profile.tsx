import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

function Heatmap({ days }: { days: Array<{ dateKey: string; count: number }> }) {
    if (!days?.length) return null;
    const map = new Map(days.map(d => [d.dateKey, d.count]));
    const cells: Array<{ key: string; count: number }> = [];
    const end = new Date();
    for (let i = 90; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        cells.push({ key, count: map.get(key) ?? 0 });
    }
    return (
        <View style={h.row}>
            {cells.map(c => (
                <View key={c.key} style={[h.cell,
                c.count >= 4 ? h.c4 : c.count >= 2 ? h.c2 : c.count >= 1 ? h.c1 : h.c0
                ]} />
            ))}
        </View>
    );
}

const h = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 8 },
    cell: { width: 10, height: 10, borderRadius: 2 },
    c0: { backgroundColor: COLORS.bgBorder },
    c1: { backgroundColor: COLORS.success + '44' },
    c2: { backgroundColor: COLORS.success + '88' },
    c4: { backgroundColor: COLORS.success },
});

export default function ProfileScreen() {
    const { user, refreshUser, logout } = useAuth();
    const router = useRouter();
    const [activity, setActivity] = useState<any>(null);
    const [examStatus, setExamStatus] = useState<any>(null);
    const [prediction, setPrediction] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [newTech, setNewTech] = useState('');

    const load = async () => {
        try {
            const [act, es] = await Promise.all([
                api.activitySummary().catch(() => null),
                api.examStatus().catch(() => null),
            ]);
            setActivity(act);
            setExamStatus(es);
            if (es?.aptitude?.latest && es?.dsa?.latest && es?.soft_skills?.latest && es?.career?.latest) {
                try { setPrediction(await api.placementPrediction()); } catch { }
            }
        } catch { } finally { setRefreshing(false); }
    };

    useFocusEffect(useCallback(() => { load(); refreshUser(); }, []));

    const submitNewTech = async () => {
        const t = newTech.trim();
        if (!t) return;
        try {
            await api.newTechLearnedSubmit(t);
            setNewTech('');
            Alert.alert('🎉 New Tech', `"${t}" recorded!`);
            load(); refreshUser();
        } catch (e: any) { Alert.alert('Error', e?.error || 'Failed'); }
    };

    const profile = user?.profile;
    const gam = user?.gamification;
    const heatmapDays = activity?.heatmap?.days ?? activity?.days ?? [];
    const streakStats = activity?.streakStats ?? {};
    const stats = activity?.stats ?? {};
    const timeline = activity?.timeline?.events ?? [];

    const examScores: Record<string, number> = {};
    ['aptitude', 'dsa', 'soft_skills', 'career'].forEach(k => {
        if (examStatus?.[k]?.latest?.percentage != null) examScores[k] = Math.round(examStatus[k].latest.percentage);
    });

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header */}
                <LinearGradient colors={['#1a1a2e', COLORS.bg] as const} style={{ padding: 20, paddingTop: 56, paddingBottom: 24, alignItems: 'center' }}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{profile?.fullName?.charAt(0)?.toUpperCase() || '?'}</Text>
                    </View>
                    <Text style={s.name}>{profile?.fullName || 'Student'}</Text>
                    <Text style={s.studentId}>{user?.studentId || ''}</Text>
                    <Text style={s.email}>{profile?.email || ''}</Text>
                    {profile?.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}

                    <View style={s.tagRow}>
                        {profile?.career?.careerPath && <View style={s.tag}><Text style={s.tagText}>{profile.career.careerPath}</Text></View>}
                        {profile?.education?.collegeName && <View style={s.tag}><Text style={s.tagText}>{profile.education.collegeName}</Text></View>}
                    </View>

                    <TouchableOpacity onPress={() => router.push('/profile-edit')} style={s.editBtn}>
                        <Icon name="pencil" size={14} color={COLORS.primary} />
                        <Text style={s.editText}>Edit Profile</Text>
                    </TouchableOpacity>
                </LinearGradient>

                <View style={{ padding: 16 }}>
                    {/* Stats Grid */}
                    <View style={s.statsGrid}>
                        {([
                            { icon: 'flame', label: 'Streak', value: `${gam?.currentStreak ?? 0}d`, color: COLORS.accent },
                            { icon: 'flash', label: 'HP', value: `${gam?.healthPoints ?? 0}`, color: COLORS.warning },
                            { icon: 'medal', label: 'Badges', value: `${gam?.badges?.length ?? 0}`, color: COLORS.secondary },
                            { icon: 'trending-up', label: 'Prediction', value: prediction ? `${Math.round(prediction.probability * 100)}%` : '—', color: COLORS.success },
                        ] as const).map(st => (
                            <View key={st.label} style={s.statCard}>
                                <Icon name={st.icon as any} size={18} color={st.color} />
                                <Text style={s.statVal}>{st.value}</Text>
                                <Text style={s.statLabel}>{st.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Activity Heatmap */}
                    <Text style={s.secTitle}>Activity Heatmap (90 days)</Text>
                    <View style={s.card}>
                        <Heatmap days={heatmapDays} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                            <Text style={s.dimText}>Less</Text>
                            <View style={{ flexDirection: 'row', gap: 3 }}>
                                {[h.c0, h.c1, h.c2, h.c4].map((c, i) => <View key={i} style={[{ width: 10, height: 10, borderRadius: 2 }, c]} />)}
                            </View>
                            <Text style={s.dimText}>More</Text>
                        </View>
                    </View>

                    {/* Exam Scores */}
                    {Object.keys(examScores).length > 0 && (
                        <>
                            <Text style={s.secTitle}>Assessment Scores</Text>
                            <View style={s.card}>
                                {Object.entries(examScores).map(([k, v]) => (
                                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <Text style={{ color: COLORS.textMuted, flex: 1, fontSize: 13, textTransform: 'capitalize' }}>{k.replace('_', ' ')}</Text>
                                        <View style={{ flex: 2, height: 8, backgroundColor: COLORS.bgBorder, borderRadius: 4, overflow: 'hidden' }}>
                                            <View style={{ height: '100%', width: `${v}%`, backgroundColor: v >= 70 ? COLORS.success : v >= 40 ? COLORS.warning : COLORS.error, borderRadius: 4 }} />
                                        </View>
                                        <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 13, width: 36, textAlign: 'right' }}>{v}%</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* Badges */}
                    {(gam?.badges?.length ?? 0) > 0 && (
                        <>
                            <Text style={s.secTitle}>Badges</Text>
                            <View style={s.card}>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                    {gam?.badges?.map((b: any, i: number) => (
                                        <View key={i} style={s.badge}>
                                            <Icon name="ribbon" size={16} color={COLORS.warning} />
                                            <Text style={s.badgeText}>{b.id || b}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </>
                    )}

                    {/* New Tech Learned */}
                    <Text style={s.secTitle}>Log New Tech Learned</Text>
                    <View style={[s.card, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
                        <TextInput
                            style={s.techInput}
                            value={newTech}
                            onChangeText={setNewTech}
                            placeholder="e.g. Docker, GraphQL…"
                            placeholderTextColor={COLORS.textDim}
                        />
                        <TouchableOpacity onPress={submitNewTech} style={s.techBtn}><Icon name="add" size={20} color="#fff" /></TouchableOpacity>
                    </View>

                    {/* Recent Activity */}
                    {timeline.length > 0 && (
                        <>
                            <Text style={s.secTitle}>Recent Activity</Text>
                            <View style={s.card}>
                                {timeline.slice(0, 8).map((ev: any, i: number) => (
                                    <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                        <Icon name="time" size={14} color={COLORS.textDim} />
                                        <Text style={{ color: COLORS.textMuted, fontSize: 13, flex: 1 }}>{ev.title || ev.type}</Text>
                                        <Text style={{ color: COLORS.textDim, fontSize: 11 }}>{new Date(ev.createdAt ?? ev.date ?? '').toLocaleDateString()}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    {/* Education & Experience */}
                    <Text style={s.secTitle}>Education</Text>
                    <View style={s.card}>
                        {profile?.education?.collegeName && <Text style={s.detailRow}>🎓 {profile.education.collegeName} · {profile.education.branch ?? ''} · {profile.education.year ?? ''}</Text>}
                        {profile?.education?.btechCgpa != null && <Text style={s.detailRow}>CGPA: {profile.education.btechCgpa}</Text>}
                        {profile?.education?.tenthPercent != null && <Text style={s.detailRow}>10th: {profile.education.tenthPercent}% · 12th: {profile.education?.twelfthPercent ?? '—'}%</Text>}
                    </View>

                    <Text style={s.secTitle}>Experience</Text>
                    <View style={s.card}>
                        <Text style={s.detailRow}>Projects: {profile?.experience?.projectCount ?? 0}</Text>
                        <Text style={s.detailRow}>Internships: {profile?.experience?.internshipsCount ?? 0}</Text>
                        <Text style={s.detailRow}>Workshops/Certs: {profile?.experience?.workshopsCertificationsCount ?? 0}</Text>
                        {(profile?.experience?.technologies?.length ?? 0) > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                {profile?.experience?.technologies?.map((t: string, i: number) => (
                                    <View key={i} style={s.techTag}><Text style={s.techTagText}>{t}</Text></View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Logout */}
                    <TouchableOpacity onPress={() => { Alert.alert('Logout', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Logout', style: 'destructive', onPress: logout }]); }}
                        style={s.logoutBtn}>
                        <Icon name="log-out" size={18} color={COLORS.error} />
                        <Text style={{ color: COLORS.error, fontWeight: '700' }}>Logout</Text>
                    </TouchableOpacity>

                    <View style={{ height: 30 }} />
                </View>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
    name: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
    studentId: { color: COLORS.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },
    email: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
    bio: { color: COLORS.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 },
    tagRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    tag: { backgroundColor: COLORS.bgCard, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bgBorder },
    tagText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
    editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: COLORS.bgCard, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bgBorder },
    editText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
    statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.bgBorder },
    statVal: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    statLabel: { color: COLORS.textMuted, fontSize: 10 },
    secTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800', marginBottom: 8, marginTop: 8 },
    card: { backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 12 },
    dimText: { color: COLORS.textDim, fontSize: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.warning + '18', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    badgeText: { color: COLORS.warning, fontSize: 12, fontWeight: '700' },
    techInput: { flex: 1, backgroundColor: COLORS.bgInput, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text, borderWidth: 1, borderColor: COLORS.bgBorder },
    techBtn: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    techTag: { backgroundColor: COLORS.primary + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    techTagText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
    detailRow: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: COLORS.error + '44' },
});
