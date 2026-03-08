import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
    Search, Briefcase, MapPin, ExternalLink, Clock, Building2,
    Loader2, Sparkles, ArrowRight, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.06, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
    }),
};

interface Job {
    title: string;
    company: string;
    location: string;
    applyLink: string;
    posted: string;
}

export default function JobSearch() {
    const { user } = useAuth();
    const defaultRole = user?.profile?.career?.careerPath || "Full Stack Developer";

    const [query, setQuery] = useState(defaultRole);
    const [roles, setRoles] = useState<string[]>([]);
    const [rolesOpen, setRolesOpen] = useState(false);
    const [rolesLoading, setRolesLoading] = useState(false);

    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [searchedRole, setSearchedRole] = useState("");
    const [hasSearched, setHasSearched] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch role suggestions as user types
    useEffect(() => {
        if (!query.trim() || query.length < 2) {
            setRoles([]);
            setRolesOpen(false);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setRolesLoading(true);
            try {
                const res = await api.jobRoles(query);
                setRoles(res?.roles || []);
                setRolesOpen(true);
            } catch {
                setRoles([]);
            } finally {
                setRolesLoading(false);
            }
        }, 400);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setRolesOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const searchJobs = async (role: string) => {
        if (!role.trim()) return;
        setJobsLoading(true);
        setHasSearched(true);
        setSearchedRole(role);
        setRolesOpen(false);
        try {
            const res = await api.jobSearch(role);
            setJobs(res?.jobs || []);
        } catch {
            setJobs([]);
        } finally {
            setJobsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        searchJobs(query);
    };

    const selectRole = (role: string) => {
        setQuery(role);
        setRolesOpen(false);
        searchJobs(role);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "Recently";
        try {
            return new Date(dateStr).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="min-h-screen bg-muted/30">
            <Navbar />

            <main className="pt-20 pb-16 container mx-auto px-4">
                {/* Hero Section */}
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    custom={0}
                    className="glass-card p-6 md:p-8 mb-6 relative overflow-hidden"
                >
                    <div className="absolute inset-0 gradient-primary opacity-5" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center">
                                <Briefcase className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold">Job Search</h1>
                                <p className="text-muted-foreground text-sm">
                                    <Sparkles className="w-4 h-4 inline mr-1" />
                                    Find live job opportunities matching your career path
                                </p>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <form onSubmit={handleSubmit} className="mt-5">
                            <div className="relative" ref={dropdownRef}>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            id="job-role-input"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Search job role... (e.g., Full Stack Developer)"
                                            className="pl-10 pr-10 h-12 text-base bg-background border-0 shadow-sm"
                                        />
                                        {query && (
                                            <button
                                                type="button"
                                                onClick={() => { setQuery(""); setRoles([]); setRolesOpen(false); }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        {rolesLoading && (
                                            <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                                        )}
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={jobsLoading || !query.trim()}
                                        className="h-12 px-6 gradient-primary text-primary-foreground border-0 gap-2"
                                    >
                                        {jobsLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                Search <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {/* Role Suggestions Dropdown */}
                                {rolesOpen && roles.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto"
                                    >
                                        <div className="p-1">
                                            {roles.map((role, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => selectRole(role)}
                                                    className="w-full text-left px-4 py-2.5 text-sm rounded-lg hover:bg-muted/70 transition-colors flex items-center gap-2"
                                                >
                                                    <Briefcase className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    <span className="truncate">{role}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </form>
                    </div>
                </motion.div>

                {/* Loading Skeleton */}
                {jobsLoading && (
                    <div className="grid md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} className="border-0 animate-pulse">
                                <CardContent className="p-6">
                                    <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                                    <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                                    <div className="h-4 bg-muted rounded w-1/3" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Results Header */}
                {hasSearched && !jobsLoading && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp}
                        custom={0}
                        className="flex items-center justify-between mb-4"
                    >
                        <div>
                            <h2 className="text-lg font-semibold">
                                {jobs.length > 0
                                    ? `${jobs.length} jobs found`
                                    : "No jobs found"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Showing results for <span className="font-medium text-foreground">{searchedRole}</span>
                            </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                            Live from RapidAPI
                        </Badge>
                    </motion.div>
                )}

                {/* Job Cards */}
                {!jobsLoading && jobs.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                        {jobs.map((job, i) => (
                            <motion.div
                                key={i}
                                initial="hidden"
                                animate="visible"
                                variants={fadeUp}
                                custom={i + 1}
                            >
                                <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border-0 group">
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                        <Briefcase className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="font-semibold truncate text-[15px] leading-snug">{job.title}</h3>
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{job.company}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{job.location}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                                        <span>{formatDate(job.posted)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {job.applyLink && (
                                            <div className="mt-4">
                                                <a
                                                    href={job.applyLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <Button
                                                        size="sm"
                                                        className="w-full gradient-primary text-primary-foreground border-0 gap-2 transition-all group-hover:shadow-glow"
                                                    >
                                                        Apply Now <ExternalLink className="w-3.5 h-3.5" />
                                                    </Button>
                                                </a>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {hasSearched && !jobsLoading && jobs.length === 0 && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp}
                        custom={0}
                        className="text-center py-16"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                            <Search className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h2 className="text-lg font-semibold mb-1">No jobs found</h2>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Try a different role or broader search term. Suggestions appear as you type.
                        </p>
                    </motion.div>
                )}

                {/* Initial State */}
                {!hasSearched && !jobsLoading && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={fadeUp}
                        custom={1}
                        className="text-center py-16"
                    >
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center opacity-80">
                            <Briefcase className="w-8 h-8 text-primary-foreground" />
                        </div>
                        <h2 className="text-lg font-semibold mb-1">Search for Jobs</h2>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Enter a job role above and click Search to find live job opportunities.
                            Your career path <span className="font-medium text-foreground">{defaultRole}</span> is pre-filled.
                        </p>

                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                            {["Full Stack Developer", "Data Scientist", "ML Engineer", "Backend Developer", "Frontend Developer"].map(
                                (role) => (
                                    <Button
                                        key={role}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => { setQuery(role); searchJobs(role); }}
                                    >
                                        {role}
                                    </Button>
                                )
                            )}
                        </div>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
