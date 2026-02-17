import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getToken, setToken, clearToken } from "@/lib/api";

export interface UserProfile {
  avatarUrl?: string;
  fullName: string;
  email: string;
  phone: string;
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
}

export interface User {
  id: string;
  studentId: string;
  role: "student" | "admin";
  profile: UserProfile;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const userData = await api.me();
      setUser(userData);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setUser(res.user);
  };

  const signup = async (payload: any) => {
    const res = await api.signup(payload);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
