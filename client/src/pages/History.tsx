import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Copy, Check, Building2 } from "lucide-react";
import { useState } from "react";
import type { Recap } from "@shared/schema";

function buildEmailText(r: Recap): string {
  const lines: string[] = [];
  lines.push("Hi Team,");
  lines.push("Thank you for today's call!");
  lines.push("Please find the recap below.");
  lines.push("");
  lines.push("─────────────────────────────────────────────");
  lines.push("PICKUP & PACING SNAPSHOT");
  lines.push("─────────────────────────────────────────────");
  lines.push("[Screenshot attached as usual]");
  lines.push("Note: The pickup shows 14 days of movement.");
  lines.push("");
  lines.push(`${r.month1Label || "Month 1"} Pickup  ${r.month1RN ? r.month1RN + " RN" : "__ RN"} / ${r.month1Rev ? "$" + r.month1Rev + " Rev" : "__ Rev"} / ${r.month1ADR ? "$" + r.month1ADR + " ADR" : "__ ADR"}, Revenue Delta pacing ${r.month1Delta || "__"}`);
  lines.push(`${r.month2Label || "Month 2"} Pickup  ${r.month2RN ? r.month2RN + " RN" : "__ RN"} / ${r.month2Rev ? "$" + r.month2Rev + " Rev" : "__ Rev"} / ${r.month2ADR ? "$" + r.month2ADR + " ADR" : "__ ADR"}, Revenue Delta pacing ${r.month2Delta || "__"}`);
  lines.push(`${r.month3Label || "Month 3"} Pickup  ${r.month3RN ? r.month3RN + " RN" : "__ RN"} / ${r.month3Rev ? "$" + r.month3Rev + " Rev" : "__ Rev"} / ${r.month3ADR ? "$" + r.month3ADR + " ADR" : "__ ADR"}, Revenue Delta pacing ${r.month3Delta || "__"}`);
  lines.push("");
  lines.push("─────────────────────────────────────────────");
  lines.push("PRICING RECOMMENDATIONS");
  lines.push("─────────────────────────────────────────────");
  lines.push("Based on your forward-looking demand:");
  lines.push(`• Recommended BAR adjustments: ${r.barAdjustments || "[Insert]"}`);
  lines.push(`• Length-of-stay or discount strategy recommendations: ${r.losStrategy || "[Insert]"}`);
  lines.push(`• Compression or special event adjustments: ${r.compressionAdjustments || "[Insert]"}`);
  lines.push("");
  lines.push("─────────────────────────────────────────────");
  lines.push("COSTAR PERFORMANCE");
  lines.push("─────────────────────────────────────────────");
  lines.push(r.costarPerformance || "[Insert]");
  lines.push("");
  lines.push("Key Takeaway:");
  lines.push(r.costarKeyTakeaway || "[Insert]");
  lines.push("");
  lines.push("─────────────────────────────────────────────");
  lines.push("OTA PRODUCTION REVIEW");
  lines.push("─────────────────────────────────────────────");
  lines.push(r.otaProduction || "[Insert]");
  lines.push(`• Top-producing promotions: ${r.topPromotions || "[Insert]"}`);
  lines.push(`• Compare production to comp set & opportunities: ${r.otaOpportunities || "[Insert]"}`);
  lines.push("");
  lines.push(`Rate Check 1: ${r.rateCheck1Date || "mm/dd"} inside 10 days    Pulse: ${r.rateCheck1Pulse || "—"}    Expedia: ${r.rateCheck1Expedia || "—"}`);
  lines.push(`Rate Check 2: ${r.rateCheck2Date || "mm/dd"} outside 10 days   Pulse: ${r.rateCheck2Pulse || "—"}    Expedia: ${r.rateCheck2Expedia || "—"}`);
  lines.push("");
  lines.push("─────────────────────────────────────────────");
  lines.push("BUSINESS MIX REVIEW");
  lines.push("─────────────────────────────────────────────");
  lines.push("See current mix report attached.");
  lines.push("");
  lines.push("Key Takeaway:");
  lines.push(r.businessMixKeyTakeaway || "[Insert]");
  if (r.additionalNotes) {
    lines.push("");
    lines.push("─────────────────────────────────────────────");
    lines.push("ADDITIONAL NOTES");
    lines.push("─────────────────────────────────────────────");
    lines.push(r.additionalNotes);
  }
  lines.push("");
  lines.push("Best regards");
  return lines.join("\n");
}

function RecapCard({ recap, onDelete }: { recap: Recap; onDelete: (id: number) => void }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildEmailText(recap));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const date = new Date(recap.createdAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <Card data-testid={`card-recap-${recap.id}`} className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-base truncate">
                {recap.propertyName || "Unnamed Property"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{formatted}</p>
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <Button
              data-testid={`button-copy-${recap.id}`}
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
            </Button>
            <Button
              data-testid={`button-delete-${recap.id}`}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(recap.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-1">
          {recap.month1Label && <Badge variant="secondary" className="text-xs">{recap.month1Label}</Badge>}
          {recap.month2Label && <Badge variant="secondary" className="text-xs">{recap.month2Label}</Badge>}
          {recap.month3Label && <Badge variant="secondary" className="text-xs">{recap.month3Label}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <button
          data-testid={`button-expand-${recap.id}`}
          className="text-xs text-primary hover:underline mb-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide preview" : "Show email preview"}
        </button>
        {expanded && (
          <div className="email-preview bg-muted/50 rounded-md p-3 max-h-60 overflow-y-auto border border-border text-xs">
            {buildEmailText(recap)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function History() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: recaps = [], isLoading } = useQuery<Recap[]>({
    queryKey: ["/api/recaps"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/recaps/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/recaps"] });
      toast({ title: "Recap deleted" });
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" data-testid="link-back">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Saved Recaps
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4 mt-1" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : recaps.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-medium" style={{ fontFamily: "var(--font-display)" }}>No saved recaps yet</h2>
            <p className="text-muted-foreground text-sm mt-1">Fill out a recap and click "Save" to store it here.</p>
            <Link href="/">
              <Button className="mt-4" data-testid="button-go-home">Create a Recap</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{recaps.length} saved {recaps.length === 1 ? "recap" : "recaps"}</p>
            {recaps.map((r) => (
              <RecapCard key={r.id} recap={r} onDelete={(id) => deleteMutation.mutate(id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
