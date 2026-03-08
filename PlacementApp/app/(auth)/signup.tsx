import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { api } from '../../lib/api';
import { StatusBar } from 'expo-status-bar';

const branches = ['Computer Science', 'Information Technology', 'Electronics', 'Electrical', 'Mechanical', 'Civil'];
const projectTechs = ['React', 'Node.js', 'Python', 'Java', 'Spring Boot', 'Django', 'Flutter', 'MongoDB', 'PostgreSQL', 'AWS', 'Docker', 'ML/AI'];
const fallbackPaths = ['Full Stack Developer', 'Backend Developer', 'Frontend Developer', 'Data Analyst', 'ML Engineer', 'App Developer', 'DevOps Engineer'];
const skillLevels = ['Beginner', 'Intermediate', 'Advanced'];
const targetCompanies = ['Google', 'Amazon', 'Microsoft', 'Meta', 'Flipkart', 'Apple', 'Adobe', 'Goldman Sachs'];
const targetLPAList = ['4', '6', '8', '10', '12', '15', '20', '30'];
const studyHoursList = ['2', '3', '4', '5'];
const yearsList = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const STEPS = ['Personal', 'Education', 'Experience', 'Career'];

// ── Password Strength ──
function getPasswordStrength(password: string) {
    const checks = {
        minLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    const isStrong = passed >= 4 && checks.minLength;
    const level: 'none' | 'weak' | 'medium' | 'strong' = !password ? 'none' : passed <= 2 ? 'weak' : passed <= 3 ? 'medium' : 'strong';
    const color = level === 'strong' ? '#00d4aa' : level === 'medium' ? '#ffa726' : level === 'weak' ? '#ff5252' : COLORS.bgBorder;
    const label = level === 'none' ? '' : level === 'weak' ? 'Weak password' : level === 'medium' ? 'Fair password' : 'Strong password';
    const pct = !password ? 0 : (passed / 5) * 100;
    return { checks, passed, isStrong, level, color, label, pct };
}

function PasswordStrengthBar({ password }: { password: string }) {
    const pw = getPasswordStrength(password);
    if (!password) return null;
    return (
        <View style={{ marginBottom: 14 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.bgBorder, overflow: 'hidden', marginBottom: 6 }}>
                <View style={{ height: '100%', width: `${pw.pct}%`, backgroundColor: pw.color as string, borderRadius: 3 }} />
            </View>
            <Text style={{ color: pw.color as string, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>{pw.label}</Text>
            <View style={{ gap: 3 }}>
                {([
                    { key: 'minLength' as const, label: 'At least 8 characters' },
                    { key: 'hasUpper' as const, label: 'An uppercase letter (A-Z)' },
                    { key: 'hasLower' as const, label: 'A lowercase letter (a-z)' },
                    { key: 'hasNumber' as const, label: 'A number (0-9)' },
                    { key: 'hasSpecial' as const, label: 'A special character (!@#...)' },
                ]).map(item => (
                    <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: pw.checks[item.key] ? '#00d4aa' : '#ff5252', fontSize: 12 }}>
                            {pw.checks[item.key] ? '✓' : '✗'}
                        </Text>
                        <Text style={{ color: pw.checks[item.key] ? COLORS.textMuted : '#ff8a80', fontSize: 11 }}>{item.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ── Shared Components ──
function PickerRow({ label, value, options, onSelect }: { label: string; value: string; options: string[]; onSelect: (v: string) => void }) {
    return (
        <View style={{ marginBottom: 16 }}>
            <Text style={s.label}>{label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt}
                            onPress={() => onSelect(opt)}
                            style={[s.chip, value === opt && s.chipActive]}
                        >
                            <Text style={[s.chipText, value === opt && s.chipTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

function Field({ label, value, onChange, placeholder, numeric, secure }: any) {
    return (
        <View style={{ marginBottom: 14 }}>
            <Text style={s.label}>{label}</Text>
            <TextInput
                style={s.input}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder || label}
                placeholderTextColor={COLORS.textDim}
                keyboardType={numeric ? 'numeric' : 'default'}
                secureTextEntry={!!secure}
                autoCapitalize="none"
            />
        </View>
    );
}

// ── Main Screen ──
export default function SignupScreen() {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [careerPaths, setCareerPaths] = useState(fallbackPaths);
    const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
    const { signup } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({
        fullName: '', email: '', phone: '', password: '',
        tenthPercent: '', twelfthPercent: '', btechCgpa: '', collegeName: '', branch: '', year: '',
        projectCount: '', hasInternship: false, hasPatents: false,
        careerPath: '', targetCompany: '', targetLpa: '', dailyStudyHours: '',
        aptitudeLevel: '', dsaLevel: '', softSkillsLevel: '',
    });

    useEffect(() => {
        api.metaCareerPaths().then(r => { if (r?.careerPaths?.length) setCareerPaths(r.careerPaths); }).catch(() => { });
    }, []);

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
    const toggleTech = (t: string) => setSelectedTechs(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

    const pwStrength = getPasswordStrength(form.password);

    const validate = () => {
        if (step === 0) {
            if (!form.fullName.trim()) return Alert.alert('Error', 'Please enter Full Name'), false;
            if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return Alert.alert('Error', 'Please enter a valid Email'), false;
            if (!/^[0-9]{10}$/.test(form.phone)) return Alert.alert('Error', 'Phone must be 10 digits'), false;
            if (!form.password) return Alert.alert('Error', 'Please enter Password'), false;
            if (!pwStrength.isStrong) return Alert.alert('Weak Password', 'Please create a stronger password. It must have at least 8 characters and include uppercase, lowercase, number, and special character.'), false;
        }
        if (step === 1) {
            if (!form.branch) return Alert.alert('Error', 'Please select Branch'), false;
            if (!form.year) return Alert.alert('Error', 'Please select Year'), false;
        }
        if (step === 3) {
            if (!form.careerPath) return Alert.alert('Error', 'Please select Career Path'), false;
            if (!form.aptitudeLevel || !form.dsaLevel || !form.softSkillsLevel) return Alert.alert('Error', 'Please select all skill levels'), false;
        }
        return true;
    };

    const next = () => { if (!validate()) return; if (step < 3) setStep(s => s + 1); };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoading(true);
        try {
            await signup({
                role: 'student',
                fullName: form.fullName, email: form.email, phone: form.phone, password: form.password,
                education: { tenthPercent: form.tenthPercent ? +form.tenthPercent : undefined, twelfthPercent: form.twelfthPercent ? +form.twelfthPercent : undefined, btechCgpa: form.btechCgpa ? +form.btechCgpa : undefined, collegeName: form.collegeName || undefined, branch: form.branch || undefined, year: form.year || undefined },
                experience: { projectCount: form.projectCount ? +form.projectCount : undefined, technologies: selectedTechs, hasInternship: form.hasInternship, hasPatents: form.hasPatents },
                career: { careerPath: form.careerPath || undefined, targetCompany: form.targetCompany || undefined, targetLpa: form.targetLpa ? +form.targetLpa : undefined, dailyStudyHours: form.dailyStudyHours ? +form.dailyStudyHours : undefined, aptitudeLevel: form.aptitudeLevel || undefined, dsaLevel: form.dsaLevel || undefined, softSkillsLevel: form.softSkillsLevel || undefined },
            });
            router.replace({ pathname: '/exam', params: { type: 'aptitude' } });
        } catch (err: any) {
            Alert.alert('Signup Failed', err?.error ?? 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar style="light" />
            {/* Header */}
            <LinearGradient colors={['#1a1a2e', COLORS.bg] as [string, string]} style={s.header}>
                <LinearGradient colors={COLORS.gradPrimary as unknown as [string, string]} style={s.iconBox}>
                    <Icon name="school" size={28} color="#fff" />
                </LinearGradient>
                <Text style={s.title}>Create Profile</Text>
                <Text style={s.subtitle}>Step {step + 1} of 4 — {STEPS[step]}</Text>
                {/* Step indicators */}
                <View style={s.stepRow}>
                    {STEPS.map((_, i) => (
                        <View key={i} style={[s.stepDot, i <= step && s.stepDotActive, i < step && s.stepDotDone]} />
                    ))}
                </View>
            </LinearGradient>

            <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
                {step === 0 && <>
                    <Field label="Full Name *" value={form.fullName} onChange={(v: string) => set('fullName', v)} />
                    <Field label="Email *" value={form.email} onChange={(v: string) => set('email', v)} placeholder="you@example.com" />
                    <Field label="Phone *" value={form.phone} onChange={(v: string) => set('phone', v.replace(/\D/g, ''))} numeric />
                    <Field label="Password *" value={form.password} onChange={(v: string) => set('password', v)} secure />
                    <PasswordStrengthBar password={form.password} />
                </>}

                {step === 1 && <>
                    <Field label="10th Percentage" value={form.tenthPercent} onChange={(v: string) => set('tenthPercent', v)} numeric />
                    <Field label="12th Percentage" value={form.twelfthPercent} onChange={(v: string) => set('twelfthPercent', v)} numeric />
                    <Field label="B.Tech CGPA" value={form.btechCgpa} onChange={(v: string) => set('btechCgpa', v)} numeric />
                    <Field label="College Name" value={form.collegeName} onChange={(v: string) => set('collegeName', v)} />
                    <PickerRow label="Branch *" value={form.branch} options={branches} onSelect={v => set('branch', v)} />
                    <PickerRow label="Year *" value={form.year} options={yearsList} onSelect={v => set('year', v)} />
                </>}

                {step === 2 && <>
                    <Field label="Number of Projects" value={form.projectCount} onChange={(v: string) => set('projectCount', v)} numeric />
                    <Text style={s.label}>Technologies Used</Text>
                    <View style={s.techWrap}>
                        {projectTechs.map(t => (
                            <TouchableOpacity key={t} onPress={() => toggleTech(t)} style={[s.chip, selectedTechs.includes(t) && s.chipActive]}>
                                <Text style={[s.chipText, selectedTechs.includes(t) && s.chipTextActive]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={s.switchRow}>
                        <Text style={s.label}>Internship Experience</Text>
                        <Switch value={form.hasInternship} onValueChange={v => set('hasInternship', v)} trackColor={{ true: COLORS.primary }} />
                    </View>
                    <View style={s.switchRow}>
                        <Text style={s.label}>Has Patents</Text>
                        <Switch value={form.hasPatents} onValueChange={v => set('hasPatents', v)} trackColor={{ true: COLORS.primary }} />
                    </View>
                </>}

                {step === 3 && <>
                    <PickerRow label="Career Path *" value={form.careerPath} options={careerPaths} onSelect={v => set('careerPath', v)} />
                    <PickerRow label="Aptitude Level *" value={form.aptitudeLevel} options={skillLevels} onSelect={v => set('aptitudeLevel', v)} />
                    <PickerRow label="DSA Level *" value={form.dsaLevel} options={skillLevels} onSelect={v => set('dsaLevel', v)} />
                    <PickerRow label="Soft Skills Level *" value={form.softSkillsLevel} options={skillLevels} onSelect={v => set('softSkillsLevel', v)} />
                    <PickerRow label="Target Company" value={form.targetCompany} options={targetCompanies} onSelect={v => set('targetCompany', v)} />
                    <PickerRow label="Target LPA" value={form.targetLpa} options={targetLPAList} onSelect={v => set('targetLpa', v)} />
                    <PickerRow label="Daily Study Hours" value={form.dailyStudyHours} options={studyHoursList} onSelect={v => set('dailyStudyHours', v)} />
                </>}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom Nav */}
            <View style={s.bottomBar}>
                {step > 0 && (
                    <TouchableOpacity onPress={() => setStep(s => s - 1)} style={s.btnSecondary}>
                        <Icon name="arrow-back" size={18} color={COLORS.primary} />
                        <Text style={s.btnSecondaryText}>Back</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[s.btnNext, step === 0 && { flex: 1 }]}
                    onPress={step === 3 ? handleSubmit : next}
                    disabled={loading || (step === 0 && form.password.length > 0 && !pwStrength.isStrong)}
                >
                    <LinearGradient
                        colors={(step === 0 && form.password.length > 0 && !pwStrength.isStrong) ? ['#555', '#444'] as [string, string] : COLORS.gradPrimary as unknown as [string, string]}
                        style={s.btnGrad}
                        start={[0, 0]}
                        end={[1, 0]}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={s.btnText}>{step === 3 ? 'Complete Setup' : 'Continue'}</Text>}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{ alignItems: 'center', paddingBottom: 16 }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
                    Already have an account? <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Sign In</Text>
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const s = StyleSheet.create({
    header: { alignItems: 'center', padding: 24, paddingTop: 60, paddingBottom: 20 },
    iconBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.text },
    subtitle: { color: COLORS.textMuted, marginTop: 4, fontSize: 13 },
    stepRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    stepDot: { width: 24, height: 6, borderRadius: 3, backgroundColor: COLORS.bgBorder },
    stepDotActive: { backgroundColor: COLORS.primaryLight },
    stepDotDone: { backgroundColor: COLORS.secondary },
    label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
    input: { backgroundColor: COLORS.bgInput, borderRadius: 12, padding: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.bgBorder, fontSize: 15 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bgInput, borderWidth: 1, borderColor: COLORS.bgBorder, marginBottom: 8 },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.textMuted, fontSize: 13 },
    chipTextActive: { color: '#fff', fontWeight: '700' },
    techWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    bottomBar: { flexDirection: 'row', gap: 12, padding: 20, backgroundColor: COLORS.bg },
    btnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary },
    btnSecondaryText: { color: COLORS.primary, fontWeight: '700' },
    btnNext: { flex: 1, borderRadius: 12, overflow: 'hidden' },
    btnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
