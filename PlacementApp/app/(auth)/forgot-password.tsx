import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

type Stage = 'email' | 'otp' | 'reset';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [stage, setStage] = useState<Stage>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Countdown timer for resend OTP
    useEffect(() => {
        if (resendTimer > 0) {
            timerRef.current = setInterval(() => {
                setResendTimer(prev => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [resendTimer]);

    // Step 1: Send OTP
    const handleSendOtp = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email address.');
            return;
        }
        setLoading(true);
        try {
            await api.forgotPassword(email.trim().toLowerCase());
            Alert.alert('OTP Sent', 'If an account with that email exists, an OTP has been sent. Check your inbox.');
            setStage('otp');
            setResendTimer(60);
        } catch (err: any) {
            Alert.alert('Error', err?.error ?? 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        try {
            await api.forgotPassword(email.trim().toLowerCase());
            Alert.alert('OTP Resent', 'A new OTP has been sent to your email.');
            setResendTimer(60);
        } catch (err: any) {
            Alert.alert('Error', err?.error ?? 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            Alert.alert('Error', 'Please enter the 6-digit OTP.');
            return;
        }
        setLoading(true);
        try {
            await api.verifyOtp(email.trim().toLowerCase(), otp);
            setStage('reset');
        } catch (err: any) {
            Alert.alert('Invalid OTP', err?.error ?? 'The OTP is incorrect. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Reset Password
    const handleResetPassword = async () => {
        if (newPassword.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            await api.resetPassword(email.trim().toLowerCase(), otp, newPassword);
            Alert.alert('Success', 'Your password has been reset. You can now log in.', [
                { text: 'Go to Login', onPress: () => router.replace('/(auth)/login') },
            ]);
        } catch (err: any) {
            Alert.alert('Error', err?.error ?? 'Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const stageConfig = {
        email: { title: 'Forgot Password', subtitle: 'Enter your email to receive a verification code', icon: 'mail-outline' },
        otp: { title: 'Verify OTP', subtitle: `Enter the 6-digit code sent to ${email}`, icon: 'key-outline' },
        reset: { title: 'New Password', subtitle: 'Create a new password for your account', icon: 'lock-closed-outline' },
    };

    const config = stageConfig[stage];

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {/* Back button */}
                <TouchableOpacity style={styles.backBtn} onPress={() => {
                    if (stage === 'otp') setStage('email');
                    else if (stage === 'reset') setStage('otp');
                    else router.back();
                }}>
                    <Icon name="arrow-back" size={20} color={COLORS.text} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                {/* Header */}
                <LinearGradient colors={COLORS.gradPrimary as [string, string]} style={styles.iconBox}>
                    <Icon name={config.icon} size={36} color="#fff" />
                </LinearGradient>
                <Text style={styles.title}>{config.title}</Text>
                <Text style={styles.subtitle}>{config.subtitle}</Text>

                {/* Progress dots */}
                <View style={styles.dotsRow}>
                    {(['email', 'otp', 'reset'] as Stage[]).map((s, i) => (
                        <View key={s} style={[styles.dot, stage === s && styles.dotActive, ['otp', 'reset'].indexOf(stage) > i - 1 && i < ['otp', 'reset'].indexOf(stage) + 1 && { backgroundColor: COLORS.success }]} />
                    ))}
                </View>

                {/* Card */}
                <View style={styles.card}>
                    {stage === 'email' && (
                        <>
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputRow}>
                                <Icon name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your registered email"
                                    placeholderTextColor={COLORS.textDim}
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoFocus
                                />
                            </View>
                            <TouchableOpacity style={styles.btnPrimary} onPress={handleSendOtp} disabled={loading}>
                                <LinearGradient colors={COLORS.gradPrimary as [string, string]} style={styles.btnGrad} start={[0, 0]} end={[1, 0]}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (
                                        <View style={styles.btnContent}>
                                            <Icon name="send" size={16} color="#fff" />
                                            <Text style={styles.btnText}>Send OTP</Text>
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}

                    {stage === 'otp' && (
                        <>
                            <Text style={styles.label}>One-Time Password</Text>
                            <View style={styles.inputRow}>
                                <Icon name="key-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.otpInput]}
                                    placeholder="Enter 6-digit OTP"
                                    placeholderTextColor={COLORS.textDim}
                                    value={otp}
                                    onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                />
                            </View>

                            <TouchableOpacity style={styles.btnPrimary} onPress={handleVerifyOtp} disabled={loading}>
                                <LinearGradient colors={COLORS.gradPrimary as [string, string]} style={styles.btnGrad} start={[0, 0]} end={[1, 0]}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (
                                        <View style={styles.btnContent}>
                                            <Icon name="checkmark" size={16} color="#fff" />
                                            <Text style={styles.btnText}>Verify OTP</Text>
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleResendOtp}
                                disabled={resendTimer > 0 || loading}
                                style={styles.resendRow}
                            >
                                <Icon name="refresh" size={14} color={resendTimer > 0 ? COLORS.textDim : COLORS.primary} />
                                <Text style={[styles.resendText, resendTimer > 0 && { color: COLORS.textDim }]}>
                                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {stage === 'reset' && (
                        <>
                            <Text style={styles.label}>New Password</Text>
                            <View style={styles.inputRow}>
                                <Icon name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholder="Minimum 8 characters"
                                    placeholderTextColor={COLORS.textDim}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry={!showPass}
                                    autoFocus
                                />
                                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                                    <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
                            <View style={styles.inputRow}>
                                <Icon name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholder="Re-enter your password"
                                    placeholderTextColor={COLORS.textDim}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirm}
                                />
                                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                                    <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {newPassword.length > 0 && newPassword.length < 8 && (
                                <Text style={styles.hint}>⚠️ Password must be at least 8 characters</Text>
                            )}
                            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                                <Text style={styles.hint}>⚠️ Passwords do not match</Text>
                            )}

                            <TouchableOpacity style={styles.btnPrimary} onPress={handleResetPassword} disabled={loading}>
                                <LinearGradient colors={COLORS.gradPrimary as [string, string]} style={styles.btnGrad} start={[0, 0]} end={[1, 0]}>
                                    {loading ? <ActivityIndicator color="#fff" /> : (
                                        <View style={styles.btnContent}>
                                            <Icon name="checkmark-circle" size={16} color="#fff" />
                                            <Text style={styles.btnText}>Reset Password</Text>
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: COLORS.bg },
    container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    backBtn: { position: 'absolute', top: 56, left: 20, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10 },
    backText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
    iconBox: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24, textAlign: 'center', paddingHorizontal: 20 },
    dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.bgBorder },
    dotActive: { backgroundColor: COLORS.primary, width: 28, borderRadius: 5 },
    card: { width: '100%', backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.bgBorder },
    label: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgInput, borderRadius: 12, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: COLORS.bgBorder },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.text, fontSize: 15 },
    otpInput: { fontSize: 24, fontWeight: '800', letterSpacing: 8, textAlign: 'center' },
    btnPrimary: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
    btnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
    btnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
    resendText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
    hint: { color: COLORS.warning, fontSize: 12, marginTop: 8 },
});
