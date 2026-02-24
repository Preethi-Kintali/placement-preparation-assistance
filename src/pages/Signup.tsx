import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, User, BookOpen, Briefcase, Target,
  ArrowRight, ArrowLeft, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

const steps = [
  { icon: User, label: "Personal" },
  { icon: BookOpen, label: "Education" },
  { icon: Briefcase, label: "Experience" },
  { icon: Target, label: "Career" },
];

const branches = [
  "Computer Science", "Information Technology", "Electronics", "Electrical",
  "Mechanical", "Civil", "Chemical", "Biotechnology",
];

const projectTechs = [
  "React", "Node.js", "Python", "Java", "Spring Boot", "Django",
  "Flutter", "MongoDB", "PostgreSQL", "AWS", "Docker", "ML/AI",
];

const fallbackCareerPaths = [
  "Full Stack Developer",
  "Backend Developer",
  "Frontend Developer",
  "Java Developer",
  "Python Developer",
  "DevOps Engineer",
  "Data Analyst",
  "ML Engineer",
  "App Developer",
];

const skillLevels = ["Beginner", "Intermediate", "Advanced"] as const;

const targetCompanies = [
  "Google", "Amazon", "Microsoft", "Meta", "Flipkart",
  "Apple", "Netflix", "Adobe", "Uber", "Goldman Sachs",
];

const targetLPA = ["4", "6", "8", "10", "12", "15", "20", "30", "40", "50"];
const studyHours = ["2", "3", "4", "5+"];
const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function Signup() {
  const [step, setStep] = useState(0);
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [careerPaths, setCareerPaths] = useState<string[]>(fallbackCareerPaths);
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    role: "student",
    fullName: "",
    email: "",
    phone: "",
    password: "",
    tenthPercent: "",
    twelfthPercent: "",
    btechCgpa: "",
    collegeName: "",
    branch: "",
    year: "",
    projectCount: "",
    hasInternship: false,
    hasPatents: false,
    careerPath: "",
    targetCompany: "",
    targetLpa: "",
    dailyStudyHours: "",

    aptitudeLevel: "",
    dsaLevel: "",
    softSkillsLevel: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const { [key]: _ignored, ...rest } = prev;
      return rest;
    });
  };

  const focusFieldById = (id: string) => {
    // Delay ensures element exists when switching steps.
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Some components (SelectTrigger) are buttons.
      if (typeof (el as any).focus === "function") (el as any).focus();
    }, 50);
  };

  const fail = (targetStep: number, fieldKey: string, fieldId: string, message: string) => {
    setError(message);
    setFieldErrors({ [fieldKey]: message });
    setStep(targetStep);
    focusFieldById(fieldId);
  };

  const validateStep = (targetStep: number) => {
    setError(null);
    setFieldErrors({});

    if (targetStep === 0) {
      if (!form.fullName.trim()) return fail(0, "fullName", "signup-fullName", "Please enter Full Name."), false;
      if (!form.email.trim()) return fail(0, "email", "signup-email", "Please enter Email."), false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        return fail(0, "email", "signup-email", "Please enter a valid Email."), false;
      }
      if (!form.phone.trim()) return fail(0, "phone", "signup-phone", "Please enter Phone."), false;
      if (!/^[0-9]{10}$/.test(form.phone.trim())) return fail(0, "phone", "signup-phone", "Phone must be 10 digits."), false;
      if (!form.password) return fail(0, "password", "signup-password", "Please enter Password."), false;
    }

    if (targetStep === 1) {
      // Keep education scores optional, but require branch/year so personalization works.
      if (!form.branch) return fail(1, "branch", "signup-branch", "Please select Branch."), false;
      if (!form.year) return fail(1, "year", "signup-year", "Please select Year."), false;
    }

    if (targetStep === 3) {
      if (!form.careerPath) return fail(3, "careerPath", "signup-careerPath", "Please choose a Career Path."), false;
      if (!form.aptitudeLevel) return fail(3, "aptitudeLevel", "signup-aptitudeLevel", "Please select your Aptitude Level."), false;
      if (!form.dsaLevel) return fail(3, "dsaLevel", "signup-dsaLevel", "Please select your DSA Level."), false;
      if (!form.softSkillsLevel) return fail(3, "softSkillsLevel", "signup-softSkillsLevel", "Please select your Soft Skills Level."), false;
    }

    return true;
  };

  useEffect(() => {
    api
      .metaCareerPaths()
      .then((res) => {
        if (Array.isArray(res?.careerPaths) && res.careerPaths.length) {
          setCareerPaths(res.careerPaths);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTech = (tech: string) => {
    setSelectedTechs((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const next = () => {
    if (step >= 3) return;
    if (!validateStep(step)) return;
    setStep(step + 1);
  };
  const prev = () => step > 0 && setStep(step - 1);

  const handleSubmit = async () => {
    setError(null);

    // Validate all steps (stop at first failure and focus it).
    for (const s of [0, 1, 3]) {
      if (!validateStep(s)) return;
    }

    setLoading(true);
    try {
      const payload = {
        role: form.role,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        education: {
          tenthPercent: form.tenthPercent ? Number(form.tenthPercent) : undefined,
          twelfthPercent: form.twelfthPercent ? Number(form.twelfthPercent) : undefined,
          btechCgpa: form.btechCgpa ? Number(form.btechCgpa) : undefined,
          collegeName: form.collegeName || undefined,
          branch: form.branch || undefined,
          year: form.year || undefined,
        },
        experience: {
          projectCount: form.projectCount ? Number(form.projectCount) : undefined,
          technologies: selectedTechs,
          hasInternship: form.hasInternship,
          hasPatents: form.hasPatents,
        },
        career: {
          careerPath: form.careerPath || undefined,
          targetCompany: form.targetCompany || undefined,
          targetLpa: form.targetLpa ? Number(form.targetLpa) : undefined,
          dailyStudyHours: form.dailyStudyHours ? Number(form.dailyStudyHours) : undefined,

          aptitudeLevel: (form.aptitudeLevel as any) || undefined,
          dsaLevel: (form.dsaLevel as any) || undefined,
          softSkillsLevel: (form.softSkillsLevel as any) || undefined,
        },
      };

      await signup(payload);
      toast({ title: "Registration completed", description: "Starting your first assessment." });
      navigate("/exam/aptitude");
    } catch (err: any) {
      setError(err?.error ?? "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div className="glass-card p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-7 h-7 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">Create Your Profile</h1>
              <p className="text-sm text-muted-foreground mt-1">Step {step + 1} of 4</p>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {steps.map((s, i) => (
                <div key={s.label} className="flex items-center">
                  <div
                    className={
                      i < step
                        ? "stepper-dot-completed"
                        : i === step
                        ? "stepper-dot-active"
                        : "stepper-dot-pending"
                    }
                  >
                    {i < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${i < step ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {step === 0 && <StepPersonal form={form} setForm={setForm} errors={fieldErrors} clearFieldError={clearFieldError} />}
                {step === 1 && <StepEducation form={form} setForm={setForm} errors={fieldErrors} clearFieldError={clearFieldError} />}
                {step === 2 && (
                  <StepExperience
                    form={form}
                    setForm={setForm}
                    selectedTechs={selectedTechs}
                    toggleTech={toggleTech}
                    errors={fieldErrors}
                    clearFieldError={clearFieldError}
                  />
                )}
                {step === 3 && <StepCareer form={form} setForm={setForm} careerPaths={careerPaths} errors={fieldErrors} clearFieldError={clearFieldError} />}
              </motion.div>
            </AnimatePresence>

            {error && <p className="text-sm text-destructive mt-4">{error}</p>}

            <div className="flex gap-3 mt-8">
              {step > 0 && (
                <Button variant="outline" onClick={prev} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              )}
              <Button
                onClick={step === 3 ? handleSubmit : next}
                className="flex-1 gradient-primary text-primary-foreground border-0 gap-2"
                disabled={loading}
              >
                {step === 3 ? (loading ? "Saving..." : "Complete Setup") : "Continue"} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function StepPersonal({
  form,
  setForm,
  errors,
  clearFieldError,
}: {
  form: any;
  setForm: (v: any) => void;
  errors: Record<string, string>;
  clearFieldError: (k: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Full Name <span className="text-destructive">*</span></Label>
        <Input
          id="signup-fullName"
          placeholder="Full Name"
          value={form.fullName}
          aria-invalid={Boolean(errors.fullName)}
          onChange={(e) => {
            clearFieldError("fullName");
            setForm({ ...form, fullName: e.target.value });
          }}
        />
        <FieldErrorText message={errors.fullName} />
      </div>
      <div className="space-y-2">
        <Label>Email <span className="text-destructive">*</span></Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="Email"
          value={form.email}
          aria-invalid={Boolean(errors.email)}
          onChange={(e) => {
            clearFieldError("email");
            setForm({ ...form, email: e.target.value });
          }}
        />
        <FieldErrorText message={errors.email} />
      </div>
      <div className="space-y-2">
        <Label>Phone <span className="text-destructive">*</span></Label>
        <Input
          id="signup-phone"
          type="tel"
          placeholder="Phone"
          value={form.phone}
          aria-invalid={Boolean(errors.phone)}
          onChange={(e) => {
            clearFieldError("phone");
            setForm({ ...form, phone: e.target.value.replace(/\D/g, "") });
          }}
        />
        <FieldErrorText message={errors.phone} />
      </div>
      <div className="space-y-2">
        <Label>Password <span className="text-destructive">*</span></Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="Password"
          value={form.password}
          aria-invalid={Boolean(errors.password)}
          onChange={(e) => {
            clearFieldError("password");
            setForm({ ...form, password: e.target.value });
          }}
        />
        <FieldErrorText message={errors.password} />
      </div>
    </div>
  );
}

function StepEducation({
  form,
  setForm,
  errors,
  clearFieldError,
}: {
  form: any;
  setForm: (v: any) => void;
  errors: Record<string, string>;
  clearFieldError: (k: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>10th %</Label>
          <Input type="number" placeholder="10th %" value={form.tenthPercent} onChange={(e) => setForm({ ...form, tenthPercent: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>12th / Diploma %</Label>
          <Input type="number" placeholder="12th / Diploma %" value={form.twelfthPercent} onChange={(e) => setForm({ ...form, twelfthPercent: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>B.Tech CGPA</Label>
        <Input type="number" step="0.01" placeholder="B.Tech CGPA" value={form.btechCgpa} onChange={(e) => setForm({ ...form, btechCgpa: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>College Name</Label>
        <Input placeholder="College Name" value={form.collegeName} onChange={(e) => setForm({ ...form, collegeName: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Branch <span className="text-destructive">*</span></Label>
          <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
            <SelectTrigger
              id="signup-branch"
              aria-invalid={Boolean(errors.branch)}
              onFocus={() => clearFieldError("branch")}
            >
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldErrorText message={errors.branch} />
        </div>
        <div className="space-y-2">
          <Label>Year <span className="text-destructive">*</span></Label>
          <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
            <SelectTrigger
              id="signup-year"
              aria-invalid={Boolean(errors.year)}
              onFocus={() => clearFieldError("year")}
            >
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldErrorText message={errors.year} />
        </div>
      </div>
    </div>
  );
}

function StepExperience({
  form,
  setForm,
  selectedTechs,
  toggleTech,
  errors: _errors,
  clearFieldError: _clearFieldError,
}: {
  form: any;
  setForm: (v: any) => void;
  selectedTechs: string[];
  toggleTech: (t: string) => void;
  errors: Record<string, string>;
  clearFieldError: (k: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Number of Projects</Label>
        <Input type="number" placeholder="Number of Projects" value={form.projectCount} onChange={(e) => setForm({ ...form, projectCount: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Technologies Used</Label>
        <div className="flex flex-wrap gap-2">
          {projectTechs.map((tech) => (
            <button
              key={tech}
              type="button"
              onClick={() => toggleTech(tech)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedTechs.includes(tech)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {tech}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox id="internship" checked={form.hasInternship} onCheckedChange={(v) => setForm({ ...form, hasInternship: Boolean(v) })} />
          <Label htmlFor="internship" className="text-sm">Internship experience</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="patent" checked={form.hasPatents} onCheckedChange={(v) => setForm({ ...form, hasPatents: Boolean(v) })} />
          <Label htmlFor="patent" className="text-sm">Patents</Label>
        </div>
      </div>
    </div>
  );
}

function StepCareer({
  form,
  setForm,
  careerPaths,
  errors,
  clearFieldError,
}: {
  form: any;
  setForm: (v: any) => void;
  careerPaths: string[];
  errors: Record<string, string>;
  clearFieldError: (k: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Career Path <span className="text-destructive">*</span></Label>
        <Select value={form.careerPath} onValueChange={(v) => setForm({ ...form, careerPath: v })}>
          <SelectTrigger
            id="signup-careerPath"
            aria-invalid={Boolean(errors.careerPath)}
            onFocus={() => clearFieldError("careerPath")}
          >
            <SelectValue placeholder="Career Path" />
          </SelectTrigger>
          <SelectContent>
            {careerPaths.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <FieldErrorText message={errors.careerPath} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Aptitude Level <span className="text-destructive">*</span></Label>
          <Select value={form.aptitudeLevel} onValueChange={(v) => setForm({ ...form, aptitudeLevel: v })}>
            <SelectTrigger
              id="signup-aptitudeLevel"
              aria-invalid={Boolean(errors.aptitudeLevel)}
              onFocus={() => clearFieldError("aptitudeLevel")}
            >
              <SelectValue placeholder="Aptitude Level" />
            </SelectTrigger>
            <SelectContent>
              {skillLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldErrorText message={errors.aptitudeLevel} />
        </div>
        <div className="space-y-2">
          <Label>DSA Level <span className="text-destructive">*</span></Label>
          <Select value={form.dsaLevel} onValueChange={(v) => setForm({ ...form, dsaLevel: v })}>
            <SelectTrigger
              id="signup-dsaLevel"
              aria-invalid={Boolean(errors.dsaLevel)}
              onFocus={() => clearFieldError("dsaLevel")}
            >
              <SelectValue placeholder="DSA Level" />
            </SelectTrigger>
            <SelectContent>
              {skillLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldErrorText message={errors.dsaLevel} />
        </div>
        <div className="space-y-2">
          <Label>Soft Skills Level <span className="text-destructive">*</span></Label>
          <Select value={form.softSkillsLevel} onValueChange={(v) => setForm({ ...form, softSkillsLevel: v })}>
            <SelectTrigger
              id="signup-softSkillsLevel"
              aria-invalid={Boolean(errors.softSkillsLevel)}
              onFocus={() => clearFieldError("softSkillsLevel")}
            >
              <SelectValue placeholder="Soft Skills Level" />
            </SelectTrigger>
            <SelectContent>
              {skillLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldErrorText message={errors.softSkillsLevel} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Target Company</Label>
        <Select value={form.targetCompany} onValueChange={(v) => setForm({ ...form, targetCompany: v })}>
          <SelectTrigger><SelectValue placeholder="Target Company" /></SelectTrigger>
          <SelectContent>
            {targetCompanies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target LPA (₹)</Label>
          <Select value={form.targetLpa} onValueChange={(v) => setForm({ ...form, targetLpa: v })}>
            <SelectTrigger><SelectValue placeholder="Target LPA" /></SelectTrigger>
            <SelectContent>
              {targetLPA.map((l) => <SelectItem key={l} value={l}>{l} LPA</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Daily Study (hrs)</Label>
          <Select value={form.dailyStudyHours} onValueChange={(v) => setForm({ ...form, dailyStudyHours: v.replace("+", "") })}>
            <SelectTrigger><SelectValue placeholder="Daily Study Hours" /></SelectTrigger>
            <SelectContent>
              {studyHours.map((h) => <SelectItem key={h} value={h}>{h} hrs</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

