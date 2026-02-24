import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

function firstLetter(name: string | undefined) {
  const s = String(name ?? "").trim();
  return s ? s.charAt(0).toUpperCase() : "U";
}

export default function ProfileEdit() {
  const { user, refreshUser } = useAuth();

  const initial = useMemo(() => {
    const p: any = user?.profile ?? {};
    return {
      avatarUrl: p.avatarUrl ?? "",
      fullName: p.fullName ?? "",
      phone: p.phone ?? "",

      tenthPercent: p.education?.tenthPercent ?? "",
      twelfthPercent: p.education?.twelfthPercent ?? "",
      btechCgpa: p.education?.btechCgpa ?? "",
      collegeName: p.education?.collegeName ?? "",
      branch: p.education?.branch ?? "",
      year: p.education?.year ?? "",

      projectCount: p.experience?.projectCount ?? "",
      internshipsCount: p.experience?.internshipsCount ?? (p.experience?.hasInternship ? 1 : ""),
      workshopsCertificationsCount: p.experience?.workshopsCertificationsCount ?? "",

      careerPath: p.career?.careerPath ?? "",
      targetCompany: p.career?.targetCompany ?? "",
      targetLpa: p.career?.targetLpa ?? "",
      dailyStudyHours: p.career?.dailyStudyHours ?? "",
    };
  }, [user]);

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initial), [initial]);

  const onPickAvatarFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image.", variant: "destructive" });
      return;
    }
    if (file.size > 1_000_000) {
      toast({ title: "Image too large", description: "Please use an image under 1MB.", variant: "destructive" });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });
    setForm((f: any) => ({ ...f, avatarUrl: dataUrl }));
  };

  const toNum = (v: any) => {
    if (v === "" || v === null || typeof v === "undefined") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        avatarUrl: String(form.avatarUrl ?? "").trim() || undefined,
        fullName: String(form.fullName ?? "").trim() || undefined,
        phone: String(form.phone ?? "").trim() || undefined,
        education: {
          tenthPercent: toNum(form.tenthPercent),
          twelfthPercent: toNum(form.twelfthPercent),
          btechCgpa: toNum(form.btechCgpa),
          collegeName: String(form.collegeName ?? "").trim() || undefined,
          branch: String(form.branch ?? "").trim() || undefined,
          year: String(form.year ?? "").trim() || undefined,
        },
        experience: {
          projectCount: toNum(form.projectCount),
          internshipsCount: toNum(form.internshipsCount),
          workshopsCertificationsCount: toNum(form.workshopsCertificationsCount),
        },
        career: {
          careerPath: String(form.careerPath ?? "").trim() || undefined,
          targetCompany: String(form.targetCompany ?? "").trim() || undefined,
          targetLpa: toNum(form.targetLpa),
          dailyStudyHours: toNum(form.dailyStudyHours),
        },
      };

      for (const key of ["education", "experience", "career"]) {
        const obj = payload[key];
        if (!obj) continue;
        const hasAny = Object.values(obj).some((x) => typeof x !== "undefined");
        if (!hasAny) delete payload[key];
      }

      await api.updateProfile(payload);
      toast({ title: "Profile updated", description: "Your profile was saved successfully." });
      await refreshUser();
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.error ?? "Could not update profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-20 pb-16 container mx-auto px-4">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Edit Profile</h1>
            <p className="text-sm text-muted-foreground">Update your details — placement prediction uses these inputs.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/profile">
              <Button variant="outline" disabled={saving}>Cancel</Button>
            </Link>
            <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground border-0">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="glass-card lg:col-span-1">
            <CardHeader>
              <CardTitle>Student</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={String(form.avatarUrl || "")} alt="Profile" />
                  <AvatarFallback>{firstLetter(form.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{user?.profile?.email}</div>
                  <div className="text-xs text-muted-foreground">Email is read-only</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar">Profile picture</Label>
                <Input id="avatar" type="file" accept="image/*" onChange={(e) => onPickAvatarFile(e.target.files?.[0] ?? null)} />
                <div className="text-xs text-muted-foreground">PNG/JPG under 1MB.</div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={form.fullName} onChange={(e) => setForm((f: any) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Education</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>10th %</Label>
                  <Input value={form.tenthPercent} onChange={(e) => setForm((f: any) => ({ ...f, tenthPercent: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>12th %</Label>
                  <Input value={form.twelfthPercent} onChange={(e) => setForm((f: any) => ({ ...f, twelfthPercent: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>B.Tech CGPA</Label>
                  <Input value={form.btechCgpa} onChange={(e) => setForm((f: any) => ({ ...f, btechCgpa: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>College</Label>
                  <Input value={form.collegeName} onChange={(e) => setForm((f: any) => ({ ...f, collegeName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Input value={form.branch} onChange={(e) => setForm((f: any) => ({ ...f, branch: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input value={form.year} onChange={(e) => setForm((f: any) => ({ ...f, year: e.target.value }))} />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Experience</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Projects</Label>
                  <Input value={form.projectCount} onChange={(e) => setForm((f: any) => ({ ...f, projectCount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Internships (count)</Label>
                  <Input value={form.internshipsCount} onChange={(e) => setForm((f: any) => ({ ...f, internshipsCount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Workshops/Certifications</Label>
                  <Input value={form.workshopsCertificationsCount} onChange={(e) => setForm((f: any) => ({ ...f, workshopsCertificationsCount: e.target.value }))} />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Career goals</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Career path</Label>
                  <Input value={form.careerPath} onChange={(e) => setForm((f: any) => ({ ...f, careerPath: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Target company</Label>
                  <Input value={form.targetCompany} onChange={(e) => setForm((f: any) => ({ ...f, targetCompany: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Target LPA</Label>
                  <Input value={form.targetLpa} onChange={(e) => setForm((f: any) => ({ ...f, targetLpa: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Daily study hours</Label>
                  <Input value={form.dailyStudyHours} onChange={(e) => setForm((f: any) => ({ ...f, dailyStudyHours: e.target.value }))} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground border-0">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </main>
    </div>
  );
}
