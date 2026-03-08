import React, { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../components/Icon';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/colors';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const FEATURES = [
    { icon: 'bulb', title: 'Smart Assessments', desc: 'Aptitude, DSA, Soft Skills & Career tests' },
    { icon: 'map', title: '12-Week Roadmap', desc: 'Personalized learning plan with daily topics' },
    { icon: 'mic', title: 'AI Mock Interviews', desc: 'Practice & get scored by AI instantly' },
    { icon: 'analytics', title: 'Placement Prediction', desc: 'ML-powered prediction with action plan' },
] as const;

export default function LandingScreen() {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const featureAnims = FEATURES.map(() => ({
        opacity: useRef(new Animated.Value(0)).current,
        translateY: useRef(new Animated.Value(30)).current,
    }));

    useEffect(() => {
        // Hero animation
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]).start();

        // Staggered feature cards
        featureAnims.forEach((anim, i) => {
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(anim.opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
                    Animated.timing(anim.translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
                ]).start();
            }, 600 + i * 150);
        });
    }, []);

    return (
        <View style={s.container}>
            <StatusBar style="light" />

            {/* Background gradient */}
            <LinearGradient
                colors={['#0a0a1a', '#1a1a3e', '#0d0d2b'] as const}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Decorative circles */}
            <View style={[s.circle, s.circle1]} />
            <View style={[s.circle, s.circle2]} />
            <View style={[s.circle, s.circle3]} />

            {/* Hero Section */}
            <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <LinearGradient colors={COLORS.gradPrimary} style={s.logoBadge}>
                    <Icon name="school" size={36} color="#fff" />
                </LinearGradient>

                <Text style={s.appName}>PlacePrep</Text>
                <Text style={s.tagline}>Your AI-Powered Placement{'\n'}Preparation Companion</Text>

                <View style={s.statRow}>
                    {([
                        { val: '4', label: 'Assessments' },
                        { val: '12', label: 'Week Plan' },
                        { val: 'AI', label: 'Powered' },
                    ] as const).map(st => (
                        <View key={st.label} style={s.statItem}>
                            <Text style={s.statVal}>{st.val}</Text>
                            <Text style={s.statLabel}>{st.label}</Text>
                        </View>
                    ))}
                </View>
            </Animated.View>

            {/* Feature Cards */}
            <View style={s.features}>
                {FEATURES.map((f, i) => (
                    <Animated.View key={f.title} style={[s.featureCard, {
                        opacity: featureAnims[i].opacity,
                        transform: [{ translateY: featureAnims[i].translateY }],
                    }]}>
                        <View style={s.featureIcon}>
                            <Icon name={f.icon} size={18} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.featureTitle}>{f.title}</Text>
                            <Text style={s.featureDesc}>{f.desc}</Text>
                        </View>
                    </Animated.View>
                ))}
            </View>

            {/* CTA Buttons */}
            <View style={s.cta}>
                <TouchableOpacity
                    onPress={() => router.push('/(auth)/signup')}
                    style={s.btnPrimary}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={COLORS.gradPrimary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.btnGrad}
                    >
                        <Text style={s.btnPrimaryText}>Get Started</Text>
                        <Icon name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push('/(auth)/login')}
                    style={s.btnSecondary}
                    activeOpacity={0.85}
                >
                    <Text style={s.btnSecondaryText}>Already have an account? </Text>
                    <Text style={s.btnLink}>Sign In</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, justifyContent: 'space-between', paddingBottom: 24 },

    // Decorative circles
    circle: { position: 'absolute', borderRadius: 999, opacity: 0.08 },
    circle1: { width: 300, height: 300, backgroundColor: COLORS.primary, top: -80, right: -80 },
    circle2: { width: 200, height: 200, backgroundColor: COLORS.secondary, bottom: 100, left: -60 },
    circle3: { width: 140, height: 140, backgroundColor: COLORS.accent, top: '40%' as any, right: -40 },

    // Hero
    hero: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24 },
    logoBadge: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    appName: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 1 },
    tagline: { fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, lineHeight: 24 },
    statRow: { flexDirection: 'row', gap: 24, marginTop: 24 },
    statItem: { alignItems: 'center' },
    statVal: { color: COLORS.primary, fontSize: 22, fontWeight: '900' },
    statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

    // Features
    features: { paddingHorizontal: 20, gap: 8 },
    featureCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    featureIcon: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: COLORS.primary + '18', alignItems: 'center', justifyContent: 'center',
    },
    featureTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    featureDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },

    // CTA
    cta: { paddingHorizontal: 20, gap: 12 },
    btnPrimary: { borderRadius: 16, overflow: 'hidden' },
    btnGrad: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    btnPrimaryText: { color: '#fff', fontSize: 17, fontWeight: '800' },
    btnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    btnSecondaryText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    btnLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
});
