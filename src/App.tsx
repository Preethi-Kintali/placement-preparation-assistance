import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute, PublicRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Roadmap from "./pages/Roadmap";
import NotFound from "./pages/NotFound";
import Exam from "./pages/Exam";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import Interview from "./pages/Interview";
import StudyAssistant from "./pages/StudyAssistant";
import Leaderboard from "./pages/Leaderboard";
import JobSearch from "./pages/JobSearch";
import ResumeAnalyzer from "./pages/ResumeAnalyzer";
import ForgotPassword from "./pages/ForgotPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute requiredRole="student"><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute requiredRole="student"><Profile /></ProtectedRoute>} />
              <Route path="/profile/edit" element={<ProtectedRoute requiredRole="student"><ProfileEdit /></ProtectedRoute>} />
              <Route path="/roadmap" element={<ProtectedRoute requiredRole="student"><Roadmap /></ProtectedRoute>} />
              <Route path="/interview" element={<ProtectedRoute requiredRole="student"><Interview /></ProtectedRoute>} />
              <Route path="/study-assistant" element={<ProtectedRoute requiredRole="student"><StudyAssistant /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute requiredRole="student"><Leaderboard /></ProtectedRoute>} />
              <Route path="/jobs" element={<ProtectedRoute requiredRole="student"><JobSearch /></ProtectedRoute>} />
              <Route path="/resume-analyzer" element={<ProtectedRoute requiredRole="student"><ResumeAnalyzer /></ProtectedRoute>} />
              <Route path="/exam/:type" element={<ProtectedRoute requiredRole="student"><Exam /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
