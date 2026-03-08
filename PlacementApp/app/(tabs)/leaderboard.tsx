import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen() {
    const { user } = useAuth();
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        try {
            const data = await api.leaderboard(user?.profile?.career?.careerPath);
            setEntries(data?.rows ?? []);
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { load(); }, []);

    const myRank = entries.findIndex((e: any) => e.isMe) + 1;

    if (loading) return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
            <StatusBar style="light" />
            <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            <LinearGradient colors={['#1a1a2e', COLORS.bg]} style={s.header}>
                <Text style={s.title}>Leaderboard</Text>
                <Text style={s.subtitle}>{user?.profile?.career?.careerPath || 'All Students'}</Text>
                {myRank > 0 && (
                    <View style={s.myRankPill}>
                        <Icon name="person" size={14} color={COLORS.primary} />
                        <Text style={s.myRankText}>Your rank: #{myRank}</Text>
                    </View>
                )}
            </LinearGradient>

            {/* Top 3 podium */}
            {entries.length >= 3 && (
                <View style={s.podium}>
                    {[1, 0, 2].map(idx => {
                        const e = entries[idx];
                        const rank = idx + 1;
                        return (
                            <View key={idx} style={[s.podiumItem, idx === 0 && s.podiumCenter]}>
                                <LinearGradient
                                    colors={rank === 1 ? ['#FFD700', '#FFA500'] : rank === 2 ? ['#C0C0C0', '#A0A0A0'] : ['#CD7F32', '#A0522D']}
                                    style={[s.podiumBadge, idx === 0 && s.podiumBadgeLarge]}
                                >
                                    <Text style={s.podiumRank}>{rank}</Text>
                                </LinearGradient>
                                <Text style={s.podiumName} numberOfLines={1}>{e.name?.split(' ')[0] || 'Student'}</Text>
                                <Text style={s.podiumHp}>{e.healthPoints} HP · 🔥{e.currentStreak}</Text>
                            </View>
                        );
                    })}
                </View>
            )}

            <FlatList
                data={entries.slice(3)}
                keyExtractor={(_, i) => String(i)}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item, index }) => {
                    const rank = index + 4;
                    const isMe = item.isMe;
                    return (
                        <View style={[s.row, isMe && s.rowMe]}>
                            <Text style={s.rankNum}>#{rank}</Text>
                            <View style={s.avatar}>
                                <Text style={s.avatarChar}>{(item.name || 'S')[0].toUpperCase()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.name} numberOfLines={1}>{item.name || 'Student'} {isMe ? '(You)' : ''}</Text>
                                <Text style={s.careerPath}>{item.careerPath || '—'}</Text>
                            </View>
                            <View style={s.hpBadge}>
                                <Icon name="flash" size={12} color={COLORS.warning} />
                                <Text style={s.hpText}>{item.healthPoints}</Text>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <Text style={{ color: COLORS.textMuted, textAlign: 'center', marginTop: 40 }}>No data yet</Text>
                }
            />
        </View>
    );
}

const s = StyleSheet.create({
    header: { padding: 20, paddingTop: 56, paddingBottom: 20 },
    title: { color: COLORS.text, fontSize: 26, fontWeight: '800' },
    subtitle: { color: COLORS.primary, fontSize: 13, marginTop: 4 },
    myRankPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: COLORS.primary + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary + '44', alignSelf: 'flex-start' },
    myRankText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
    podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 16, paddingVertical: 16, paddingHorizontal: 20, backgroundColor: COLORS.bgCard, borderBottomWidth: 1, borderBottomColor: COLORS.bgBorder },
    podiumItem: { alignItems: 'center', flex: 1 },
    podiumCenter: { marginBottom: 16 },
    podiumBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    podiumBadgeLarge: { width: 56, height: 56, borderRadius: 28 },
    podiumRank: { color: '#fff', fontWeight: '900', fontSize: 18 },
    podiumName: { color: COLORS.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    podiumHp: { color: COLORS.textMuted, fontSize: 11 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.bgCard, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.bgBorder },
    rowMe: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '11' },
    rankNum: { color: COLORS.textMuted, fontWeight: '700', width: 28, textAlign: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + '33', alignItems: 'center', justifyContent: 'center' },
    avatarChar: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
    name: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
    careerPath: { color: COLORS.textMuted, fontSize: 11 },
    hpBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.warning + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    hpText: { color: COLORS.warning, fontWeight: '700', fontSize: 13 },
});
