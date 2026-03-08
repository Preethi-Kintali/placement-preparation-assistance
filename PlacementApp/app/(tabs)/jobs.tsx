import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Linking, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';

interface Job {
    title: string;
    company: string;
    location: string;
    applyLink: string;
    posted: string;
}

export default function JobsScreen() {
    const { user } = useAuth();
    const defaultRole = user?.profile?.career?.careerPath || 'Full Stack Developer';

    const [query, setQuery] = useState(defaultRole);
    const [roles, setRoles] = useState<string[]>([]);
    const [rolesOpen, setRolesOpen] = useState(false);
    const [rolesLoading, setRolesLoading] = useState(false);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [searchedRole, setSearchedRole] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    // Fetch suggestions as user types
    useEffect(() => {
        if (!query.trim() || query.length < 2) {
            setRoles([]);
            setRolesOpen(false);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setRolesLoading(true);
            try {
                const res = await api.jobRoles(query);
                setRoles(res?.roles || []);
                setRolesOpen(true);
            } catch {
                setRoles([]);
            } finally {
                setRolesLoading(false);
            }
        }, 500);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    const searchJobs = async (role: string) => {
        if (!role.trim()) return;
        setJobsLoading(true);
        setHasSearched(true);
        setSearchedRole(role);
        setRolesOpen(false);
        try {
            const res = await api.jobSearch(role);
            setJobs(res?.jobs || []);
        } catch {
            setJobs([]);
        } finally {
            setJobsLoading(false);
            setRefreshing(false);
        }
    };

    const selectRole = (role: string) => {
        setQuery(role);
        setRolesOpen(false);
        searchJobs(role);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Recently';
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Auto-search on initial load
    useFocusEffect(useCallback(() => {
        if (!hasSearched && defaultRole) {
            searchJobs(defaultRole);
        }
    }, []));

    const quickRoles = ['Full Stack Developer', 'Data Scientist', 'ML Engineer', 'Backend Developer', 'DevOps Engineer'];

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />

            {/* Header */}
            <LinearGradient colors={['#1a1a2e', COLORS.bg] as [string, string]} style={s.header}>
                <View style={s.headerRow}>
                    <LinearGradient colors={COLORS.gradPrimary as unknown as [string, string]} style={s.iconBox}>
                        <Icon name="briefcase" size={24} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={s.title}>Job Search</Text>
                        <Text style={s.subtitle}>Find live opportunities matching your profile</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchRow}>
                    <View style={s.inputWrap}>
                        <Icon name="search" size={16} color={COLORS.textDim} />
                        <TextInput
                            style={s.input}
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search job role..."
                            placeholderTextColor={COLORS.textDim}
                            returnKeyType="search"
                            onSubmitEditing={() => searchJobs(query)}
                        />
                        {query ? (
                            <TouchableOpacity onPress={() => { setQuery(''); setRoles([]); setRolesOpen(false); }}>
                                <Icon name="close-circle" size={18} color={COLORS.textDim} />
                            </TouchableOpacity>
                        ) : null}
                        {rolesLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
                    </View>
                    <TouchableOpacity onPress={() => searchJobs(query)} disabled={jobsLoading || !query.trim()}>
                        <LinearGradient colors={COLORS.gradPrimary as unknown as [string, string]} style={s.searchBtn}>
                            {jobsLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Icon name="search" size={18} color="#fff" />
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Role Suggestions */}
                {rolesOpen && roles.length > 0 && (
                    <View style={s.dropdown}>
                        <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                            {roles.map((role, i) => (
                                <TouchableOpacity key={i} onPress={() => selectRole(role)} style={s.dropItem}>
                                    <Icon name="briefcase" size={14} color={COLORS.primary} />
                                    <Text style={s.dropText} numberOfLines={1}>{role}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </LinearGradient>

            <ScrollView
                style={{ flex: 1, padding: 16 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); searchJobs(query || defaultRole); }} tintColor={COLORS.primary} />
                }
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Quick Role Chips */}
                {!hasSearched && (
                    <View style={{ marginBottom: 16 }}>
                        <Text style={s.secLabel}>Quick Search</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {quickRoles.map(role => (
                                    <TouchableOpacity key={role} onPress={() => { setQuery(role); searchJobs(role); }} style={s.chip}>
                                        <Text style={s.chipText}>{role}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* Results header */}
                {hasSearched && !jobsLoading && (
                    <View style={s.resultsHeader}>
                        <Text style={s.resultsTitle}>
                            {jobs.length > 0 ? `${jobs.length} jobs found` : 'No jobs found'}
                        </Text>
                        <Text style={s.resultsSubtitle} numberOfLines={1}>
                            Showing results for {searchedRole}
                        </Text>
                    </View>
                )}

                {/* Loading */}
                {jobsLoading && (
                    <View style={{ paddingTop: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={{ color: COLORS.textMuted, marginTop: 12, fontSize: 13 }}>Searching jobs...</Text>
                    </View>
                )}

                {/* Job Cards */}
                {!jobsLoading && jobs.map((job, i) => (
                    <View key={i} style={s.jobCard}>
                        <View style={s.jobHeader}>
                            <LinearGradient colors={COLORS.gradPrimary as unknown as [string, string]} style={s.jobIcon}>
                                <Icon name="briefcase" size={16} color="#fff" />
                            </LinearGradient>
                            <View style={{ flex: 1 }}>
                                <Text style={s.jobTitle} numberOfLines={2}>{job.title}</Text>
                            </View>
                        </View>

                        <View style={s.jobMeta}>
                            <View style={s.metaRow}>
                                <Icon name="business" size={13} color={COLORS.textDim} />
                                <Text style={s.metaText} numberOfLines={1}>{job.company}</Text>
                            </View>
                            <View style={s.metaRow}>
                                <Icon name="location" size={13} color={COLORS.textDim} />
                                <Text style={s.metaText} numberOfLines={1}>{job.location}</Text>
                            </View>
                            <View style={s.metaRow}>
                                <Icon name="time" size={13} color={COLORS.textDim} />
                                <Text style={s.metaText}>{formatDate(job.posted)}</Text>
                            </View>
                        </View>

                        {job.applyLink ? (
                            <TouchableOpacity onPress={() => Linking.openURL(job.applyLink)}>
                                <LinearGradient colors={COLORS.gradPrimary as unknown as [string, string]} style={s.applyBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <Text style={s.applyText}>Apply Now</Text>
                                    <Icon name="open-outline" size={14} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ))}

                {/* Empty state */}
                {hasSearched && !jobsLoading && jobs.length === 0 && (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                        <Icon name="search" size={40} color={COLORS.textDim} />
                        <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 16, marginTop: 12 }}>No jobs found</Text>
                        <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                            Try a different role or broader search term
                        </Text>
                    </View>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    header: { padding: 20, paddingTop: 56, paddingBottom: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    iconBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    title: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
    subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
    searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    inputWrap: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: COLORS.bgInput, borderRadius: 12, paddingHorizontal: 12, height: 46,
        borderWidth: 1, borderColor: COLORS.bgBorder,
    },
    input: { flex: 1, color: COLORS.text, fontSize: 14 },
    searchBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    dropdown: {
        backgroundColor: COLORS.bgCard, borderRadius: 12, marginTop: 6,
        borderWidth: 1, borderColor: COLORS.bgBorder, overflow: 'hidden',
    },
    dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.bgBorder },
    dropText: { color: COLORS.text, fontSize: 13, flex: 1 },
    secLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.bgBorder },
    chipText: { color: COLORS.textMuted, fontSize: 12 },
    resultsHeader: { marginBottom: 12 },
    resultsTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
    resultsSubtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
    jobCard: {
        backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 10,
    },
    jobHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    jobIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    jobTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
    jobMeta: { marginTop: 10, gap: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: COLORS.textMuted, fontSize: 12, flex: 1 },
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10, marginTop: 12 },
    applyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
