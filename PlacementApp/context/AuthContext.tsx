import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken, clearToken } from '../lib/api';
import { useRouter, useSegments } from 'expo-router';

export interface User {
    id: string;
    studentId: string;
    role: 'student' | 'admin';
    profile: {
        avatarUrl?: string;
        fullName: string;
        email: string;
        phone: string;
        bio?: string;
        education?: {
            tenthPercent?: number;
            twelfthPercent?: number;
            btechCgpa?: number;
            collegeName?: string;
            branch?: string;
            year?: string;
        };
        experience?: {
            projectCount?: number;
            internshipsCount?: number;
            workshopsCertificationsCount?: number;
            technologies?: string[];
            hasInternship?: boolean;
            hasPatents?: boolean;
        };
        career?: {
            careerPath?: string;
            targetCompany?: string;
            targetLpa?: number;
            dailyStudyHours?: number;
        };
    };
    gamification?: {
        healthPoints: number;
        currentStreak: number;
        longestStreak: number;
        lastCheckInDate?: string;
        badges?: Array<{ id: string; unlockedAt: string }>;
    };
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isNewSignup: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (payload: any) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    clearNewSignup: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isNewSignup, setIsNewSignup] = useState(false);

    const refreshUser = async () => {
        const token = await getToken();
        if (!token) { setUser(null); setLoading(false); return; }
        try {
            const data = await api.me();
            setUser(data);
        } catch {
            await clearToken();
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refreshUser(); }, []);

    const login = async (email: string, password: string) => {
        const res = await api.login({ email, password });
        await setToken(res.token);
        setUser(res.user);
        setIsNewSignup(false);
    };

    const signup = async (payload: any) => {
        const res = await api.signup(payload);
        await setToken(res.token);
        setUser(res.user);
        // Flag so the root layout redirects to first exam instead of dashboard
        setIsNewSignup(true);
    };

    const logout = async () => {
        await clearToken();
        setUser(null);
        setIsNewSignup(false);
    };

    const clearNewSignup = () => setIsNewSignup(false);

    return (
        <AuthContext.Provider value={{ user, loading, isNewSignup, login, signup, logout, refreshUser, clearNewSignup }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
