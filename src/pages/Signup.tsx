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

  const next = () => step < 3 && setStep(step + 1);
  const prev = () => step > 0 && setStep(step - 1);

  const handleSubmit = async () => {
    setError(null);

    if (!form.fullName || !form.email || !form.phone || !form.password) {
      setError("Please fill all required fields.");
      return;
    }
    if (!/^[0-9]{10}$/.test(form.phone)) {
      setError("Phone must be 10 digits.");
      return;
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
      navigate("/dashboard");
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
                {step === 0 && <StepPersonal form={form} setForm={setForm} />}
                {step === 1 && <StepEducation form={form} setForm={setForm} />}
                {step === 2 && (
                  <StepExperience
                    form={form}
                    setForm={setForm}
                    selectedTechs={selectedTechs}
                    toggleTech={toggleTech}
                  />
                )}
                {step === 3 && <StepCareer form={form} setForm={setForm} careerPaths={careerPaths} />}
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

function StepPersonal({ form, setForm }: { form: any; setForm: (v: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Full Name</Label>
        <Input placeholder="Ravi Kumar" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" placeholder="ravi@college.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input type="tel" placeholder="9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Password</Label>
        <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </div>
    </div>
  );
}

function StepEducation({ form, setForm }: { form: any; setForm: (v: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>10th %</Label>
          <Input type="number" placeholder="85" value={form.tenthPercent} onChange={(e) => setForm({ ...form, tenthPercent: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>12th / Diploma %</Label>
          <Input type="number" placeholder="78" value={form.twelfthPercent} onChange={(e) => setForm({ ...form, twelfthPercent: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>B.Tech CGPA</Label>
        <Input type="number" step="0.01" placeholder="8.5" value={form.btechCgpa} onChange={(e) => setForm({ ...form, btechCgpa: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>College Name</Label>
        <Input placeholder="IIT Hyderabad" value={form.collegeName} onChange={(e) => setForm({ ...form, collegeName: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Branch</Label>
          <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
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
}: {
  form: any;
  setForm: (v: any) => void;
  selectedTechs: string[];
  toggleTech: (t: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Number of Projects</Label>
        <Input type="number" placeholder="3" value={form.projectCount} onChange={(e) => setForm({ ...form, projectCount: e.target.value })} />
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
}: {
  form: any;
  setForm: (v: any) => void;
  careerPaths: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Career Path</Label>
        <Select value={form.careerPath} onValueChange={(v) => setForm({ ...form, careerPath: v })}>
          <SelectTrigger><SelectValue placeholder="Choose your path" /></SelectTrigger>
          <SelectContent>
            {careerPaths.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Aptitude Level</Label>
          <Select value={form.aptitudeLevel} onValueChange={(v) => setForm({ ...form, aptitudeLevel: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {skillLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>DSA Level</Label>
          <Select value={form.dsaLevel} onValueChange={(v) => setForm({ ...form, dsaLevel: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {skillLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Soft Skills Level</Label>
          <Select value={form.softSkillsLevel} onValueChange={(v) => setForm({ ...form, softSkillsLevel: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {skillLevels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Target Company</Label>
        <Select value={form.targetCompany} onValueChange={(v) => setForm({ ...form, targetCompany: v })}>
          <SelectTrigger><SelectValue placeholder="Dream company" /></SelectTrigger>
          <SelectContent>
            {targetCompanies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target LPA (₹)</Label>
          <Select value={form.targetLpa} onValueChange={(v) => setForm({ ...form, targetLpa: v })}>
            <SelectTrigger><SelectValue placeholder="LPA" /></SelectTrigger>
            <SelectContent>
              {targetLPA.map((l) => <SelectItem key={l} value={l}>{l} LPA</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Daily Study (hrs)</Label>
          <Select value={form.dailyStudyHours} onValueChange={(v) => setForm({ ...form, dailyStudyHours: v.replace("+", "") })}>
            <SelectTrigger><SelectValue placeholder="Hours" /></SelectTrigger>
            <SelectContent>
              {studyHours.map((h) => <SelectItem key={h} value={h}>{h} hrs</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

