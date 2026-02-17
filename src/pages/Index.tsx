import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Code2, Brain, Users, Trophy, Rocket, Target, BookOpen,
  ArrowRight, CheckCircle2, ChevronRight, Sparkles, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import heroImage from "@/assets/hero-illustration.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0, 0, 0.2, 1] as const },
  }),
};

const features = [
  { icon: Code2, title: "DSA Mastery", desc: "Structured problem-solving from basics to advanced with company-specific questions." },
  { icon: Brain, title: "Aptitude Training", desc: "Quantitative, logical, and verbal reasoning practice with timed tests." },
  { icon: Users, title: "Interview Prep", desc: "Mock interviews, behavioral questions, and communication skill building." },
  { icon: Trophy, title: "Project Guidance", desc: "Build portfolio-worthy projects aligned with your career path." },
];

const painPoints = [
  "No clear study roadmap",
  "Random YouTube tutorials",
  "Ignoring aptitude prep",
  "Starting too late",
  "No mock interviews",
  "Poor project portfolio",
];

const careerPaths = [
  "Full Stack Developer", "Backend Developer", "Frontend Developer",
  "Java Developer", "Python Developer", "DevOps Engineer",
  "Data Analyst", "ML Engineer", "App Developer",
];

const roadmapPreview = [
  { week: 1, title: "Foundations", status: "completed" as const },
  { week: 2, title: "Arrays & Strings", status: "completed" as const },
  { week: 3, title: "Linked Lists", status: "active" as const },
  { week: 4, title: "Trees & Graphs", status: "locked" as const },
  { week: 5, title: "Dynamic Programming", status: "locked" as const },
  { week: 6, title: "System Design", status: "locked" as const },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-60" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                AI-Powered Placement Prep
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-balance">
                Your Personalized Roadmap to{" "}
                <span className="gradient-text">Product-Based Company</span>{" "}
                Placements
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-lg text-muted-foreground max-w-lg">
                No confusion. No guesswork. Just a clear path from Day 1 to your dream offer at Google, Amazon, Microsoft & more.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-3">
                <Link to="/signup">
                  <Button size="lg" className="gradient-primary text-primary-foreground border-0 gap-2 text-base px-8 shadow-glow">
                    Get Started <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                    Login <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> Free to start</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> AI-powered</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-success" /> 1000+ students</div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute inset-0 gradient-primary rounded-3xl opacity-10 blur-3xl" />
                <img
                  src={heroImage}
                  alt="Student on a glowing placement preparation pathway"
                  className="relative rounded-3xl shadow-elevated w-full"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Why Students <span className="gradient-text">Struggle</span> in Placements
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-2xl mx-auto">
              Most engineering students face these common challenges. We solve all of them.
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {painPoints.map((point, i) => (
              <motion.div
                key={point}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="glass-card-hover p-4 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                  <X className="w-5 h-5 text-destructive" />
                </div>
                <p className="text-sm font-medium">{point}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              How <span className="gradient-text">PlacePrep</span> Helps You
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-2xl mx-auto">
              A complete system designed specifically for Indian engineering students targeting top companies.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="glass-card-hover p-6"
              >
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap Preview */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Your <span className="gradient-text">Learning Path</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground">
              Progressive weekly roadmap — unlock new topics as you master each level.
            </motion.p>
          </motion.div>

          <div className="max-w-md mx-auto relative">
            {/* Vertical connector line */}
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-border" />

            {roadmapPreview.map((node, i) => (
              <motion.div
                key={node.week}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="relative flex items-center gap-4 mb-6"
              >
                <div
                  className={
                    node.status === "completed"
                      ? "roadmap-node-completed shrink-0"
                      : node.status === "active"
                      ? "roadmap-node-active shrink-0"
                      : "roadmap-node-locked shrink-0"
                  }
                >
                  {node.status === "completed" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : node.status === "active" ? (
                    <Rocket className="w-6 h-6" />
                  ) : (
                    <span className="text-sm">W{node.week}</span>
                  )}
                </div>
                <div className={`glass-card p-4 flex-1 ${node.status === "locked" ? "opacity-50" : ""}`}>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Week {node.week}</div>
                  <div className="font-semibold">{node.title}</div>
                  <div className={`text-xs mt-1 font-medium ${
                    node.status === "completed" ? "text-success" :
                    node.status === "active" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {node.status === "completed" ? "✓ Completed" : node.status === "active" ? "● In Progress" : "🔒 Locked"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Career Paths */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold mb-4">
              Career Paths <span className="gradient-text">Supported</span>
            </motion.h2>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {careerPaths.map((path, i) => (
              <motion.div
                key={path}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="glass-card-hover px-5 py-3 text-sm font-medium"
              >
                <Target className="w-4 h-4 inline mr-2 text-primary" />
                {path}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="glass-card p-8 md:p-14 text-center max-w-3xl mx-auto relative overflow-hidden"
          >
            <div className="absolute inset-0 gradient-primary opacity-5" />
            <motion.div variants={fadeUp} custom={0} className="relative z-10">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Start Your Journey?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                Join thousands of engineering students who are systematically preparing for placements at top product-based companies.
              </p>
              <Link to="/signup">
                <Button size="lg" className="gradient-primary text-primary-foreground border-0 gap-2 text-base px-10 shadow-glow">
                  Start Free Today <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
