import { useState, useEffect } from "react";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCompanies } from "@/lib/api";
import type { CompanyProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSelect: (company: CompanyProfile) => void;
}

export function CompanySelect({ onSelect }: Props) {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies()
      .then(setCompanies)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedCompany = companies.find((c) => c.id === selected);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold gradient-text">Select Target Company</h2>
        <p className="text-muted-foreground mt-1">Choose the company you're preparing for</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {companies.map((c) => (
          <Card
            key={c.id}
            className={`cursor-pointer transition-all hover:shadow-elevated ${
              selected === c.id ? "ring-2 ring-primary shadow-elevated" : "shadow-card"
            }`}
            onClick={() => setSelected(c.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <CardDescription>{c.difficulty}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {c.focus_areas.map((area) => (
                  <Badge key={area} variant="secondary" className="text-xs">{area}</Badge>
                ))}
              </div>
              {c.behavioral_model && (
                <p className="text-xs text-muted-foreground mt-2">Model: {c.behavioral_model}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          disabled={!selectedCompany}
          onClick={() => selectedCompany && onSelect(selectedCompany)}
          className="gradient-bg text-primary-foreground hover:opacity-90"
        >
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
