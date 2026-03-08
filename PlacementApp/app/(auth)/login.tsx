import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            Alert.alert('Error', 'Please enter email and password.');
            return;
        }
        setLoading(true);
        try {
            await login(email.trim().toLowerCase(), password);
        } catch (err: any) {
            Alert.alert('Login Failed', err?.error ?? 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <LinearGradient colors={COLORS.gradPrimary} style={styles.iconBox}>
                    <Icon name="school" size={36} color="#fff" />
                </LinearGradient>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in to continue your placement prep</Text>

                {/* Form */}
                <View style={styles.card}>
                    <Text style={styles.label}>Email</Text>
                    <View style={styles.inputRow}>
                        <Icon name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor={COLORS.textDim}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
                    <View style={styles.inputRow}>
                        <Icon name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Enter your password"
                            placeholderTextColor={COLORS.textDim}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPass}
                        />
                        <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                            <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
                        <LinearGradient colors={COLORS.gradPrimary} style={styles.btnGrad} start={[0, 0]} end={[1, 0]}>
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Sign In</Text>}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.linkRow}>
                        <Text style={styles.linkText}>Don't have an account? </Text>
                        <Text style={[styles.linkText, { color: COLORS.primary, fontWeight: '700' }]}>Register</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: COLORS.bg },
    container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    iconBox: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 32, textAlign: 'center' },
    card: { width: '100%', backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.bgBorder },
    label: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgInput, borderRadius: 12, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: COLORS.bgBorder },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: COLORS.text, fontSize: 15 },
    btnPrimary: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
    btnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    linkText: { color: COLORS.textMuted, fontSize: 14 },
});
