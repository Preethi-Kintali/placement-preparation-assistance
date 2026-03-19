import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, KeyRound, Lock, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Stage = "email" | "otp" | "reset";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer]);

  // Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
      toast.success("OTP sent! Check your email inbox.");
      setStage("otp");
      setResendTimer(60);
    } catch (err: any) {
      setError(err?.error ?? "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
      toast.success("A new OTP has been sent to your email.");
      setResendTimer(60);
    } catch (err: any) {
      setError(err?.error ?? "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.verifyOtp(email.trim().toLowerCase(), otp);
      toast.success("OTP verified! Create your new password.");
      setStage("reset");
    } catch (err: any) {
      setError(err?.error ?? "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword(email.trim().toLowerCase(), otp, newPassword);
      toast.success("Password reset successfully! You can now log in.");
      navigate("/login");
    } catch (err: any) {
      setError(err?.error ?? "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const stageConfig = {
    email: {
      title: "Forgot Password",
      subtitle: "Enter your email to receive a verification code",
      icon: <Mail className="w-7 h-7 text-primary-foreground" />,
    },
    otp: {
      title: "Verify OTP",
      subtitle: `Enter the 6-digit code sent to ${email}`,
      icon: <ShieldCheck className="w-7 h-7 text-primary-foreground" />,
    },
    reset: {
      title: "New Password",
      subtitle: "Create a new password for your account",
      icon: <Lock className="w-7 h-7 text-primary-foreground" />,
    },
  };

  const config = stageConfig[stage];

  const handleBack = () => {
    setError(null);
    if (stage === "otp") setStage("email");
    else if (stage === "reset") setStage("otp");
    else navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="glass-card p-8">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                {config.icon}
              </div>
              <h1 className="text-2xl font-bold">{config.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{config.subtitle}</p>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {(["email", "otp", "reset"] as Stage[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    stage === s
                      ? "w-8 bg-primary"
                      : (["email", "otp", "reset"].indexOf(stage) > i
                        ? "w-2 bg-green-500"
                        : "w-2 bg-muted-foreground/30")
                  }`}
                />
              ))}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-destructive mb-4"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Stage: Email */}
            {stage === "email" && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fp-email"
                      type="email"
                      placeholder="Enter your registered email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0 gap-2" disabled={loading}>
                  {loading ? "Sending..." : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </form>
            )}

            {/* Stage: OTP */}
            {stage === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-otp">One-Time Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fp-otp"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      className="pl-10 text-center text-xl font-bold tracking-[0.5em]"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0 gap-2" disabled={loading}>
                  {loading ? "Verifying..." : <>Verify OTP <CheckCircle2 className="w-4 h-4" /></>}
                </Button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors mt-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                </button>
              </form>
            )}

            {/* Stage: Reset Password */}
            {stage === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fp-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fp-password"
                      type="password"
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      minLength={8}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-confirm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fp-confirm"
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <p className="text-xs text-yellow-500">⚠️ Password must be at least 8 characters</p>
                )}
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-xs text-yellow-500">⚠️ Passwords do not match</p>
                )}
                <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0 gap-2" disabled={loading}>
                  {loading ? "Resetting..." : <>Reset Password <CheckCircle2 className="w-4 h-4" /></>}
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-muted-foreground mt-6">
              Remember your password?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
