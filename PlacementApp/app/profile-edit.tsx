import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { COLORS } from '../constants/colors';
import { StatusBar } from 'expo-status-bar';

export default function ProfileEditScreen() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const p = user?.profile;
    const [form, setForm] = useState({
        fullName: p?.fullName ?? '',
        phone: p?.phone ?? '',
        bio: p?.bio ?? '',
        collegeName: p?.education?.collegeName ?? '',
        branch: p?.education?.branch ?? '',
        year: p?.education?.year ?? '',
        tenthPercent: String(p?.education?.tenthPercent ?? ''),
        twelfthPercent: String(p?.education?.twelfthPercent ?? ''),
        btechCgpa: String(p?.education?.btechCgpa ?? ''),
        projectCount: String(p?.experience?.projectCount ?? ''),
        targetCompany: p?.career?.targetCompany ?? '',
        targetLpa: String(p?.career?.targetLpa ?? ''),
        dailyStudyHours: String(p?.career?.dailyStudyHours ?? ''),
    });

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const save = async () => {
        if (!form.fullName.trim()) { Alert.alert('Error', 'Full name is required'); return; }
        setLoading(true);
        try {
            await api.updateProfile({
                fullName: form.fullName.trim(),
                phone: form.phone.trim(),
                bio: form.bio.trim() || undefined,
                education: {
                    collegeName: form.collegeName || undefined,
                    branch: form.branch || undefined,
                    year: form.year || undefined,
                    tenthPercent: form.tenthPercent ? +form.tenthPercent : undefined,
                    twelfthPercent: form.twelfthPercent ? +form.twelfthPercent : undefined,
                    btechCgpa: form.btechCgpa ? +form.btechCgpa : undefined,
                },
                experience: {
                    projectCount: form.projectCount ? +form.projectCount : undefined,
                },
                career: {
                    targetCompany: form.targetCompany || undefined,
                    targetLpa: form.targetLpa ? +form.targetLpa : undefined,
                    dailyStudyHours: form.dailyStudyHours ? +form.dailyStudyHours : undefined,
                },
            });
            await refreshUser();
            Alert.alert('Saved!', 'Profile updated successfully.', [{ text: 'OK', onPress: () => router.back() }]);
        } catch (err: any) {
            Alert.alert('Error', err?.error || 'Failed to save');
        } finally {
            setLoading(false);
        }
    };

    function Field({ label, value, onChange, numeric, multiline }: any) {
        return (
            <View style={{ marginBottom: 14 }}>
                <Text style={s.label}>{label}</Text>
                <TextInput
                    style={[s.input, multiline && { height: 80, textAlignVertical: 'top' }]}
                    value={value}
                    onChangeText={onChange}
                    placeholder={label}
                    placeholderTextColor={COLORS.textDim}
                    keyboardType={numeric ? 'numeric' : 'default'}
                    multiline={!!multiline}
                    numberOfLines={multiline ? 3 : 1}
                />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            <LinearGradient colors={['#1a1a2e', COLORS.bg]} style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Icon name="arrow-back" size={22} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={s.title}>Edit Profile</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.section}>Personal Info</Text>
                <Field label="Full Name" value={form.fullName} onChange={(v: string) => set('fullName', v)} />
                <Field label="Phone" value={form.phone} onChange={(v: string) => set('phone', v.replace(/\D/g, ''))} numeric />
                <Field label="Bio" value={form.bio} onChange={(v: string) => set('bio', v)} multiline />

                <Text style={s.section}>Education</Text>
                <Field label="College Name" value={form.collegeName} onChange={(v: string) => set('collegeName', v)} />
                <Field label="Branch" value={form.branch} onChange={(v: string) => set('branch', v)} />
                <Field label="Year" value={form.year} onChange={(v: string) => set('year', v)} />
                <Field label="10th Percentage" value={form.tenthPercent} onChange={(v: string) => set('tenthPercent', v)} numeric />
                <Field label="12th Percentage" value={form.twelfthPercent} onChange={(v: string) => set('twelfthPercent', v)} numeric />
                <Field label="B.Tech CGPA" value={form.btechCgpa} onChange={(v: string) => set('btechCgpa', v)} numeric />

                <Text style={s.section}>Experience</Text>
                <Field label="Number of Projects" value={form.projectCount} onChange={(v: string) => set('projectCount', v)} numeric />

                <Text style={s.section}>Career Goals</Text>
                <Field label="Target Company" value={form.targetCompany} onChange={(v: string) => set('targetCompany', v)} />
                <Field label="Target LPA" value={form.targetLpa} onChange={(v: string) => set('targetLpa', v)} numeric />
                <Field label="Daily Study Hours" value={form.dailyStudyHours} onChange={(v: string) => set('dailyStudyHours', v)} numeric />

                <TouchableOpacity style={s.saveBtn} onPress={save} disabled={loading}>
                    <LinearGradient colors={COLORS.gradPrimary} style={s.saveBtnGrad} start={[0, 0]} end={[1, 0]}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
                    </LinearGradient>
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
    section: { color: COLORS.primary, fontSize: 14, fontWeight: '800', marginBottom: 12, marginTop: 8 },
    label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { backgroundColor: COLORS.bgInput, borderRadius: 12, padding: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.bgBorder, fontSize: 15 },
    saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 20 },
    saveBtnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
