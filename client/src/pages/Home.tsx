import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Copy, Check, RefreshCw, History, FileText, Upload,
  Loader2, Sparkles, X, ImageIcon, Paperclip, Mic, Send, FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadForAnalysis } from "@/lib/api";
import { ImageUploadSection } from "@/components/ImageUploadSection";

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateType = "mf-biweekly" | "mf-callrecap" | "nonmf-monthly";

interface SectionState {
  imageData: string | null;
  imageFile: File | null;
  analysis: string;
  analyzing: boolean;
}

interface FormState {
  propertyName: string;
  template: TemplateType;

  // Pickup & Pacing
  pickupImageData: string | null;  // screenshot for email display
  pickupFile: File | null;          // excel for AI analysis
  pickupFileName: string;
  pickupAnalyzing: boolean;
  pickupManual: string; // editable summary

  // Pricing
  pricingNotes: string;

  // Market Analysis (MF Bi-Weekly only)
  marketImageData: string | null;
  marketImageFile: File | null;

  // CoStar
  costar: SectionState;
  costarPeriod: "7" | "28";
  costarManual: string;

  // OTA
  ota: SectionState;
  otaPeriod: string;
  otaManual: string;
  // Booking.com (optional)
  includeBooking: boolean;
  booking: SectionState;
  bookingPeriod: string;
  bookingManual: string;

  // Business Mix
  businessMixFile: File | null;
  businessMixFileName: string;
  businessMixAnalysis: string;
  businessMixAnalyzing: boolean;

  // Call Notes (MF Call Recap only)
  callNotesFile: File | null;
  callNotesFileName: string;
  callNotesType: "audio" | "video" | "transcript";
  callNotesTranscript: string;
  callNotesSummary: string;
  callNotesAnalyzing: boolean;
}

const defaultSection = (): SectionState => ({
  imageData: null,
  imageFile: null,
  analysis: "",
  analyzing: false,
});

const DEFAULT: FormState = {
  propertyName: "",
  template: "mf-biweekly",
  pickupImageData: null,
  pickupFile: null,
  pickupFileName: "",
  pickupAnalyzing: false,
  pickupManual: "",
  pricingNotes: "",
  marketImageData: null,
  marketImageFile: null,
  costar: defaultSection(),
  costarPeriod: "7",
  costarManual: "",
  ota: defaultSection(),
  otaPeriod: "next14",
  otaManual: "",
  includeBooking: false,
  booking: defaultSection(),
  bookingPeriod: "next14",
  bookingManual: "",
  businessMixFile: null,
  businessMixFileName: "",
  businessMixAnalysis: "",
  businessMixAnalyzing: false,
  callNotesFile: null,
  callNotesFileName: "",
  callNotesType: "audio",
  callNotesTranscript: "",
  callNotesSummary: "",
  callNotesAnalyzing: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OTA_PERIOD_LABELS: Record<string, string> = {
  next14: "Stays Booked for the Next 14 Days vs Comp Set",
  next28: "Stays Booked for the Next 28 Days vs Comp Set",
  last7: "Stays from the Last 7 Days vs Comp Set",
  last14: "Stays from the Last 14 Days vs Comp Set",
};

const COSTAR_PERIOD_LABELS: Record<string, string> = {
  "7": "last 7 days",
  "28": "last 28 days",
};

// ─── Email Builders ──────────────────────────────────────────────────────────

/** Plain-text version (fallback / server send) */
function buildEmailSections(f: FormState): string {
  const lines: string[] = [];
  const templateLabel =
    f.template === "mf-biweekly"
      ? "MF Bi-Weekly"
      : f.template === "mf-callrecap"
      ? "MF Call Recap"
      : "NON MF Monthly";

  const currentMonth = new Date().toLocaleString("en-US", { month: "long" });
  lines.push("Hi Team,");
  if (f.template === "mf-callrecap") {
    lines.push("Thank you for today's call!");
  } else if (f.template === "mf-biweekly") {
    lines.push("I hope you're doing well. Below is your biweekly revenue update.");
  } else {
    lines.push(`I hope you're doing well. Below is your monthly revenue update for ${currentMonth}. If you have any questions or would like to talk through anything in more detail, please feel free to reach out.`);
  }
  lines.push("");

  // ── Pickup & Pacing ──
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("PICKUP & PACING SNAPSHOT");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("[Pickup & Pacing screenshot attached above]");
  lines.push("Note: The pickup shows 14 days of movement.");
  lines.push("");
  if (f.pickupManual.trim()) {
    lines.push(f.pickupManual.trim());
  } else {
    lines.push("Current Month Pickup __ RN / __ Rev / __ ADR, Revenue Delta pacing __");
    lines.push("Next Month Pickup __ RN / __ Rev / __ ADR, Revenue Delta pacing __");
    lines.push("Following Month Pickup __ RN / __ Rev / __ ADR, Revenue Delta pacing __");
  }
  lines.push("");

  // ── Pricing ──
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("PRICING RECOMMENDATIONS");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("Based on your forward-looking demand:");
  lines.push(f.pricingNotes.trim() || "[Revenue team — add pricing recommendations here]");
  lines.push("");

  // ── Market Analysis (MF Bi-Weekly only) ──
  if (f.template === "mf-biweekly" || f.template === "mf-callrecap") {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("MARKET ANALYSIS & UPCOMING DEMAND DRIVERS");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("Here's who is booking through local channels in your market");
    lines.push(f.marketImageData ? "[Market analysis screenshot attached above]" : "[Paste market analysis screenshot here]");
    lines.push("");
  }

  // ── CoStar ──
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("COSTAR PERFORMANCE");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(`[CoStar report screenshot — ${COSTAR_PERIOD_LABELS[f.costarPeriod]} — attached above]`);
  lines.push("");
  lines.push("Key Performance Takeaways:");
  lines.push(f.costarManual.trim() || f.costar.analysis.trim() || "[CoStar analysis will appear here after upload + analyze]");
  lines.push("");

  // ── OTA (MF Bi-Weekly + MF Call Recap only) ──
  if (f.template !== "nonmf-monthly") {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("OTA PRODUCTION REVIEW — EXPEDIA");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(`[Expedia OTA Production — ${OTA_PERIOD_LABELS[f.otaPeriod]} — screenshot attached above]`);
    lines.push("");
    lines.push(f.otaManual.trim() || f.ota.analysis.trim() || "[OTA analysis will appear here after upload + analyze]");
    lines.push("");
    if (f.includeBooking) {
      lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      lines.push("OTA PRODUCTION REVIEW — BOOKING.COM");
      lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      lines.push(`[Booking.com OTA Production — ${OTA_PERIOD_LABELS[f.bookingPeriod]} — screenshot attached above]`);
      lines.push("");
      lines.push(f.bookingManual.trim() || f.booking.analysis.trim() || "[Booking.com analysis will appear here after upload + analyze]");
      lines.push("");
    }
  }

  // ── Business Mix (MF Bi-Weekly and MF Call Recap and NON MF Monthly) ──
  if (f.template !== "nonmf-monthly") {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("BUSINESS MIX REVIEW");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (f.businessMixFileName) {
      lines.push("See Business Mix Review attached.");
    } else {
      lines.push("See current mix report attached.");
    }
    lines.push("");
    lines.push(f.businessMixAnalysis.trim() || "[Business Mix summary will appear here after Excel upload + analyze]");
    lines.push("");
  }

  // ── Call Notes (MF Call Recap only) ──
  if (f.template === "mf-callrecap") {
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("ADDITIONAL CALL DISCUSSION NOTES");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push(f.callNotesSummary.trim() || "[Call summary will appear here after uploading audio/video/transcript + analyze]");
    lines.push("");
  }

  lines.push("Best regards");
  return lines.join("\n");
}

/** HTML version — images rendered inline, used for preview + copy + send */
function buildEmailHTML(f: FormState): string {
  const templateLabel =
    f.template === "mf-biweekly"
      ? "MF Bi-Weekly"
      : f.template === "mf-callrecap"
      ? "MF Call Recap"
      : "NON MF Monthly";

  const hr = ``;
  const h2 = (t: string) =>
    `<h2 style="font-family:monospace;font-size:13px;font-weight:700;letter-spacing:.08em;color:#1e3a5f;margin:0 0 6px">${t}</h2>`;
  const p = (t: string) =>
    t ? `<p style="font-family:Aptos,Arial,sans-serif;font-size:12pt;line-height:1.2;margin:0;white-space:pre-wrap">${t}</p>` : "";
  const img = (dataUrl: string | null) =>
    dataUrl
      ? `<img src="${dataUrl}" style="max-width:100%;border:1px solid #ddd;border-radius:4px;margin:8px 0" alt="screenshot">`
      : "";

  let html = `<div style="font-family:Aptos,Arial,sans-serif;font-size:12pt;line-height:1.0;max-width:700px">`;
  const currentMonth = new Date().toLocaleString("en-US", { month: "long" });
  html += p("Hi Team,");
  if (f.template === "mf-callrecap") {
    html += p("Thank you for today's call!");
  } else if (f.template === "mf-biweekly") {
    html += p("I hope you're doing well. Below is your biweekly revenue update.");
  } else {
    html += p(`I hope you're doing well. Below is your monthly revenue update for ${currentMonth}. If you have any questions or would like to talk through anything in more detail, please feel free to reach out.`);
  }

  // Pickup & Pacing
  html += hr + h2("PICKUP &amp; PACING SNAPSHOT");
  html += img(f.pickupImageData);
  html += p("Note: The pickup shows 14 days of movement.");
  if (f.pickupManual.trim()) {
    html += p(f.pickupManual.trim());
  } else {
    html += p("Current Month Pickup __ RN / __ Rev / __ ADR, Revenue Delta pacing __\nNext Month Pickup __ RN / __ Rev / __ ADR, Revenue Delta pacing __\nFollowing Month Pickup __ RN / __ Rev / __ ADR, Revenue Delta pacing __");
  }

  // Pricing
  html += hr + h2("PRICING RECOMMENDATIONS");
  html += p("Based on your forward-looking demand:");
  html += p(f.pricingNotes.trim() || "[Revenue team — add pricing recommendations here]");

  // Market Analysis (MF Bi-Weekly only)
  if (f.template === "mf-biweekly" || f.template === "mf-callrecap") {
    html += hr + h2("MARKET ANALYSIS &amp; UPCOMING DEMAND DRIVERS");
    html += `<p style="font-family:Aptos,Arial,sans-serif;font-size:12pt;line-height:1.2;margin:0;color:#555">Here&#39;s who is booking through local channels in your market</p>`;
    html += img(f.marketImageData);
  }

  // CoStar
  html += hr + h2("COSTAR PERFORMANCE");
  html += img(f.costar.imageData);
  html += p("Key Performance Takeaways:");
  html += p(f.costarManual.trim() || f.costar.analysis.trim() || "[CoStar analysis will appear here after upload + analyze]");

  // OTA (MF Bi-Weekly + MF Call Recap only)
  if (f.template !== "nonmf-monthly") {
    html += hr + h2("OTA PRODUCTION REVIEW — EXPEDIA");
    html += img(f.ota.imageData);
    html += p(f.otaManual.trim() || f.ota.analysis.trim() || "[OTA analysis will appear here after upload + analyze]");
    if (f.includeBooking) {
      html += hr + h2("OTA PRODUCTION REVIEW — BOOKING.COM");
      html += img(f.booking.imageData);
      html += p(f.bookingManual.trim() || f.booking.analysis.trim() || "[Booking.com analysis will appear here after upload + analyze]");
    }
  }

  // Business Mix
  if (f.template !== "nonmf-monthly") {
    html += hr + h2("BUSINESS MIX REVIEW");
    html += p("See Business Mix Review attached.");
    html += p(f.businessMixAnalysis.trim() || "[Business Mix summary will appear here after Excel upload + analyze]");
  }

  // Call Notes
  if (f.template === "mf-callrecap") {
    html += hr + h2("ADDITIONAL CALL DISCUSSION NOTES");
    html += p(f.callNotesSummary.trim() || "[Call summary will appear here after uploading audio/video/transcript + analyze]");
  }

  html += p("Best regards");
  html += "</div>";
  return html;
}

// ─── Pickup Screenshot Paste Zone ───────────────────────────────────────────

function PickupPasteZone({
  imageData,
  onImageChange,
}: {
  imageData: string | null;
  onImageChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onImageChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleZonePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((i) => i.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      const blob = imageItem.getAsFile();
      if (blob) handleFile(new File([blob], `pickup-${Date.now()}.png`, { type: blob.type }));
    }
  };

  return (
    <div>
      <div
        ref={zoneRef}
        tabIndex={0}
        data-testid="dropzone-pickup-screenshot"
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-all outline-none",
          dragging ? "border-primary bg-accent scale-[1.01]"
            : focused ? "border-primary bg-accent/30 ring-2 ring-primary/20"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          imageData ? "p-2 cursor-default" : "p-5 cursor-pointer"
        )}
        onClick={() => zoneRef.current?.focus()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={handleZonePaste}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file?.type.startsWith("image/")) handleFile(file);
        }}
      >
        {imageData ? (
          <div className="relative">
            <img src={imageData} alt="Pickup screenshot" className="rounded max-h-48 w-full object-contain bg-muted" />
            <button
              className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-1 shadow transition-colors"
              onClick={(e) => { e.stopPropagation(); onImageChange(null); }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-center select-none pointer-events-none">
            <ImageIcon className="w-7 h-7 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-sm font-medium text-foreground">Click here, then paste your screenshot</p>
            <p className="text-xs text-muted-foreground mt-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">Ctrl+V</kbd>
              {" "}after clicking — or drag & drop
            </p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>
      {!imageData && (
        <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1.5"
          onClick={() => inputRef.current?.click()}>
          <FolderOpen className="w-3.5 h-3.5" /> Or browse to upload a file
        </button>
      )}
    </div>
  );
}

// ─── File Upload Component ────────────────────────────────────────────────────

function FileUploadZone({
  accept,
  label,
  sublabel,
  fileName,
  testId,
  onFile,
  icon: Icon = Upload,
}: {
  accept: string;
  label: string;
  sublabel?: string;
  fileName?: string;
  testId: string;
  onFile: (file: File) => void;
  icon?: React.ElementType;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      data-testid={`dropzone-${testId}`}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
        dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {fileName ? (
        <div className="flex items-center justify-center gap-2 text-sm text-foreground">
          <Paperclip className="w-4 h-4 text-primary" />
          <span className="truncate max-w-xs">{fileName}</span>
        </div>
      ) : (
        <>
          <Icon className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
          <p className="text-sm text-muted-foreground">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground/60 mt-0.5">{sublabel}</p>}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        data-testid={`file-input-${testId}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [copied, setCopied] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const { toast } = useToast();

  // Detects proxy/network failures and shows the timeout banner instead of a generic error
  const handleAnalysisError = (e: any, resetFn?: () => void) => {
    const msg: string = (e?.message || "").toLowerCase();
    // Only show timeout banner for true network-level failures (not API errors)
    const isNetworkError = msg === "failed to fetch" || msg === "networkerror when attempting to fetch resource." || msg === "load failed";
    if (isNetworkError) {
      setTimedOut(true);
    } else {
      toast({ title: "Analysis failed", description: e.message || "Unknown error", variant: "destructive" });
    }
    resetFn?.();
  };

  const emailText = buildEmailSections(form);
  const emailHTML = buildEmailHTML(form);

  // Generic updater
  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setSection = useCallback(<K extends keyof FormState>(
    key: K,
    updater: (prev: FormState[K]) => FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  }, []);

  // ── Image handlers ──
  const handleImageChange = (sectionKey: "costar" | "ota" | "booking") => (
    dataUrl: string | null,
    file: File | null
  ) => {
    setForm((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], imageData: dataUrl, imageFile: file, analysis: "" },
    }));
  };

  // ── AI Analyze: Pickup (Excel) ──
  const analyzePickup = async () => {
    if (!form.pickupFile) return;
    set("pickupAnalyzing", true);
    try {
      const fd = new FormData();
      fd.append("file", form.pickupFile);
      const res = await uploadForAnalysis("/api/ai/pickup", fd);
      const analysisText = res.analysis || "";
      setForm((p) => ({
        ...p,
        pickupAnalyzing: false,
        pickupManual: formatPickupAnalysis(analysisText),
      }));
    } catch (e: any) {
      handleAnalysisError(e, () => set("pickupAnalyzing", false));
    }
  };

  // ── AI Analyze: CoStar ──
  const analyzeCostar = async () => {
    const { imageFile } = form.costar;
    if (!imageFile) return;
    setForm((p) => ({ ...p, costar: { ...p.costar, analyzing: true } }));
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("period", form.costarPeriod);
      const res = await uploadForAnalysis("/api/ai/costar", fd);
      const summary = res.summary || "";
      setForm((p) => ({
        ...p,
        costar: { ...p.costar, analysis: summary, analyzing: false },
        costarManual: summary,
      }));
    } catch (e: any) {
      handleAnalysisError(e, () => setForm((p) => ({ ...p, costar: { ...p.costar, analyzing: false } })));
    }
  };

  // ── AI Analyze: OTA ──
  const analyzeOta = async () => {
    const { imageFile } = form.ota;
    if (!imageFile) return;
    setForm((p) => ({ ...p, ota: { ...p.ota, analyzing: true } }));
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("period", form.otaPeriod);
      const res = await uploadForAnalysis("/api/ai/ota", fd);
      const summary = res.summary || "";
      setForm((p) => ({
        ...p,
        ota: { ...p.ota, analysis: summary, analyzing: false },
        otaManual: summary,
      }));
    } catch (e: any) {
      handleAnalysisError(e, () => setForm((p) => ({ ...p, ota: { ...p.ota, analyzing: false } })));
    }
  };

  // ── AI Analyze: Booking.com ──
  const analyzeBooking = async () => {
    const { imageFile } = form.booking;
    if (!imageFile) return;
    setForm((p) => ({ ...p, booking: { ...p.booking, analyzing: true } }));
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("period", form.bookingPeriod);
      fd.append("platform", "Booking.com");
      const res = await uploadForAnalysis("/api/ai/ota", fd);
      const summary = res.summary || "";
      setForm((p) => ({
        ...p,
        booking: { ...p.booking, analysis: summary, analyzing: false },
        bookingManual: summary,
      }));
    } catch (e: any) {
      handleAnalysisError(e, () => setForm((p) => ({ ...p, booking: { ...p.booking, analyzing: false } })));
    }
  };

  // ── AI Analyze: Business Mix ──
  const analyzeBusinessMix = async () => {
    if (!form.businessMixFile) return;
    set("businessMixAnalyzing", true);
    try {
      const fd = new FormData();
      fd.append("file", form.businessMixFile);
      const res = await uploadForAnalysis("/api/ai/business-mix", fd);
      set("businessMixAnalysis", res.summary || "");
    } catch (e: any) {
      handleAnalysisError(e);
    } finally {
      set("businessMixAnalyzing", false);
    }
  };

  // ── AI Analyze: Call Notes ──
  const analyzeCallNotes = async () => {
    if (!form.callNotesFile) return;
    set("callNotesAnalyzing", true);
    try {
      const fd = new FormData();
      fd.append("file", form.callNotesFile);
      fd.append("file_type", form.callNotesType);
      const res = await uploadForAnalysis("/api/ai/transcribe", fd);
      setForm((p) => ({
        ...p,
        callNotesTranscript: res.transcript || "",
        callNotesSummary: res.summary || "",
        callNotesAnalyzing: false,
      }));
    } catch (e: any) {
      handleAnalysisError(e, () => set("callNotesAnalyzing", false));
    }
  };

  const handleCopy = () => {
    // Most reliable cross-browser approach: render HTML into a hidden div,
    // select all of it, then execCommand('copy') — works in Gmail/Outlook paste.
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1";
    container.innerHTML = emailHTML;
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch {}

    sel?.removeAllRanges();
    document.body.removeChild(container);

    if (!success) {
      // Last resort: plain text via clipboard API
      navigator.clipboard.writeText(emailText).catch(() => {});
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Paste into Gmail or Outlook — images included." });
  };

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      toast({ title: "No recipient", description: "Enter a To: email address.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const propertyName = form.propertyName || "Property";
      const templateLabel =
        form.template === "mf-biweekly" ? "MF Bi-Weekly"
        : form.template === "mf-callrecap" ? "MF Call Recap"
        : "NON MF Monthly";
      const subject = `${propertyName} — ${templateLabel} Revenue Recap`;
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail.trim(),
          subject,
          htmlBody: emailHTML,
          textBody: emailText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      toast({ title: "Email sent", description: `Sent to ${recipientEmail.trim()}` });
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => setForm(DEFAULT);

  const templateLabel = {
    "mf-biweekly": "MF Bi-Weekly",
    "mf-callrecap": "MF Call Recap",
    "nonmf-monthly": "NON MF Monthly",
  }[form.template];

  return (
    <div className="min-h-screen bg-background">
      {/* Session timeout banner */}
      {timedOut && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>The server session has expired. Return to the Perplexity chat and ask to restart the server, then reload this page.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg aria-label="Revenue Recap" viewBox="0 0 36 36" fill="none" className="w-8 h-8 flex-shrink-0">
              <rect width="36" height="36" rx="8" fill="hsl(221,50%,28%)" />
              <rect x="8" y="10" width="20" height="3" rx="1.5" fill="hsl(40,85%,53%)" />
              <rect x="8" y="16.5" width="14" height="2.5" rx="1.25" fill="white" fillOpacity="0.7" />
              <rect x="8" y="22" width="17" height="2.5" rx="1.25" fill="white" fillOpacity="0.5" />
            </svg>
            <div>
              <h1 className="text-base font-semibold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                Revenue Recap
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">Email Generator</p>
            </div>
          </div>
          <Link href="/history" data-testid="link-history">
            <Button variant="ghost" size="sm" className="gap-2">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Saved Recaps</span>
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <div className="space-y-5">
          {/* Template Selector */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Email Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(["mf-biweekly", "mf-callrecap", "nonmf-monthly"] as TemplateType[]).map((t) => {
                  const labels: Record<TemplateType, string> = {
                    "mf-biweekly": "MF Bi-Weekly",
                    "mf-callrecap": "MF Call Recap",
                    "nonmf-monthly": "NON MF Monthly",
                  };
                  return (
                    <button
                      key={t}
                      data-testid={`template-${t}`}
                      onClick={() => set("template", t)}
                      className={cn(
                        "px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-center",
                        form.template === t
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-card hover:border-primary/50 hover:bg-accent text-foreground"
                      )}
                    >
                      {labels[t]}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1">
                <Label htmlFor="propertyName">Property Name</Label>
                <Input
                  id="propertyName"
                  data-testid="input-property-name"
                  placeholder="e.g. Hilton Garden Inn Rapid City"
                  value={form.propertyName}
                  onChange={(e) => set("propertyName", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── PICKUP & PACING ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pickup &amp; Pacing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* Screenshot paste zone — goes into the email */}
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Screenshot for Email</p>
              <PickupPasteZone
                imageData={form.pickupImageData}
                onImageChange={(dataUrl) => setForm((p) => ({ ...p, pickupImageData: dataUrl }))}
              />

              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Excel for AI Analysis</p>
                <FileUploadZone
                  accept=".xlsx,.xls,.csv"
                  label="Upload Pickup & Pacing Excel file"
                  sublabel=".xlsx, .xls, or .csv"
                  fileName={form.pickupFileName}
                  testId="pickup-pacing"
                  icon={Paperclip}
                  onFile={(file) => {
                    setForm((p) => ({
                      ...p,
                      pickupFile: file,
                      pickupFileName: file.name,
                      pickupManual: "",
                    }));
                  }}
                />
                {form.pickupFile && (
                  <Button
                    data-testid="analyze-btn-pickup"
                    size="sm"
                    variant="outline"
                    className="gap-2 w-full mt-2"
                    onClick={analyzePickup}
                    disabled={form.pickupAnalyzing}
                  >
                    {form.pickupAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    )}
                    {form.pickupAnalyzing ? "Analyzing..." : "Analyze Pickup Data"}
                  </Button>
                )}
              </div>

              <Textarea
                data-testid="input-pickup-manual"
                placeholder="Pickup & pacing summary will appear here after analysis — edit as needed before copying the email."
                value={form.pickupManual}
                onChange={(e) => set("pickupManual", e.target.value)}
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Auto-filled from AI analysis — edit as needed before copying the email.</p>
            </CardContent>
          </Card>

          {/* ── PRICING ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pricing Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                data-testid="input-pricing"
                placeholder="Revenue team — enter BAR adjustments, LOS strategy, compression notes, etc."
                value={form.pricingNotes}
                onChange={(e) => set("pricingNotes", e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* ── MARKET ANALYSIS (MF Bi-Weekly only) ── */}
          {(form.template === "mf-biweekly" || form.template === "mf-callrecap") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Market Analysis &amp; Upcoming Demand Drivers
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Here&apos;s who is booking through local channels in your market</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Screenshot</Label>
                <PickupPasteZone
                  imageData={form.marketImageData}
                  onImageChange={(dataUrl) =>
                    setForm((p) => ({ ...p, marketImageData: dataUrl, marketImageFile: null }))
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* ── COSTAR ── */}
          <ImageUploadSection
            title="CoStar Performance Report"
            sectionKey="costar"
            imageData={form.costar.imageData}
            analysisText=""
            analyzing={form.costar.analyzing}
            onImageChange={handleImageChange("costar")}
            onAnalyze={analyzeCostar}
            analyzeLabel="Analyze CoStar Report"
          >
            <div className="space-y-1">
              <Label className="text-xs">Report Period</Label>
              <Select
                value={form.costarPeriod}
                onValueChange={(v) => set("costarPeriod", v as "7" | "28")}
              >
                <SelectTrigger data-testid="select-costar-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Data from last 7 days</SelectItem>
                  <SelectItem value="28">Data from last 28 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </ImageUploadSection>
          {/* Editable CoStar summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                CoStar Summary — Editable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                data-testid="input-costar-manual"
                placeholder="CoStar key takeaways will appear here after analysis — edit as needed."
                value={form.costarManual}
                onChange={(e) => set("costarManual", e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* ── OTA / EXPEDIA (MF Bi-Weekly + MF Call Recap only) ── */}
          {form.template !== "nonmf-monthly" && (
            <>
              <ImageUploadSection
                title="OTA Production Review — Expedia"
                sectionKey="ota"
                imageData={form.ota.imageData}
                analysisText=""
                analyzing={form.ota.analyzing}
                onImageChange={handleImageChange("ota")}
                onAnalyze={analyzeOta}
                analyzeLabel="Analyze OTA Report"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Report View</Label>
                  <Select value={form.otaPeriod} onValueChange={(v) => set("otaPeriod", v)}>
                    <SelectTrigger data-testid="select-ota-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="next14">Stays Booked for the Next 14 Days vs Comp Set</SelectItem>
                      <SelectItem value="next28">Stays Booked for the Next 28 Days vs Comp Set</SelectItem>
                      <SelectItem value="last7">Stays from the Last 7 Days vs Comp Set</SelectItem>
                      <SelectItem value="last14">Stays from the Last 14 Days vs Comp Set</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </ImageUploadSection>
              {/* Editable OTA summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    OTA Summary — Editable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    data-testid="input-ota-manual"
                    placeholder="OTA analysis will appear here after uploading screenshot + analyzing — edit as needed."
                    value={form.otaManual}
                    onChange={(e) => set("otaManual", e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>

              {/* ── Booking.com toggle ── */}
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="include-booking"
                  data-testid="toggle-booking"
                  checked={form.includeBooking}
                  onChange={(e) => set("includeBooking", e.target.checked)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <label htmlFor="include-booking" className="text-sm cursor-pointer select-none">
                  Also include Booking.com
                </label>
              </div>

              {/* ── Booking.com section (shown only when toggled on) ── */}
              {form.includeBooking && (
                <>
                  <ImageUploadSection
                    title="OTA Production Review — Booking.com"
                    sectionKey="booking"
                    imageData={form.booking.imageData}
                    analysisText=""
                    analyzing={form.booking.analyzing}
                    onImageChange={handleImageChange("booking")}
                    onAnalyze={analyzeBooking}
                    analyzeLabel="Analyze Booking Report"
                  >
                    <div className="space-y-1">
                      <Label className="text-xs">Report View</Label>
                      <Select value={form.bookingPeriod} onValueChange={(v) => set("bookingPeriod", v)}>
                        <SelectTrigger data-testid="select-booking-period">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="next14">Stays Booked for the Next 14 Days vs Comp Set</SelectItem>
                          <SelectItem value="next28">Stays Booked for the Next 28 Days vs Comp Set</SelectItem>
                          <SelectItem value="last7">Stays from the Last 7 Days vs Comp Set</SelectItem>
                          <SelectItem value="last14">Stays from the Last 14 Days vs Comp Set</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </ImageUploadSection>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Booking.com Summary — Editable
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        data-testid="input-booking-manual"
                        placeholder="Booking.com analysis will appear here after uploading screenshot + analyzing — edit as needed."
                        value={form.bookingManual}
                        onChange={(e) => set("bookingManual", e.target.value)}
                        rows={3}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {/* ── BUSINESS MIX (MF Bi-Weekly + MF Call Recap) ── */}
          {form.template !== "nonmf-monthly" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Business Mix Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FileUploadZone
                  accept=".xlsx,.xls,.csv"
                  label="Upload Business Mix Excel file"
                  sublabel=".xlsx, .xls, or .csv"
                  fileName={form.businessMixFileName}
                  testId="business-mix"
                  icon={Paperclip}
                  onFile={(file) => {
                    setForm((p) => ({
                      ...p,
                      businessMixFile: file,
                      businessMixFileName: file.name,
                      businessMixAnalysis: "",
                    }));
                  }}
                />
                {form.businessMixFile && (
                  <Button
                    data-testid="analyze-btn-business-mix"
                    size="sm"
                    variant="outline"
                    className="gap-2 w-full"
                    onClick={analyzeBusinessMix}
                    disabled={form.businessMixAnalyzing}
                  >
                    {form.businessMixAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    )}
                    {form.businessMixAnalyzing ? "Analyzing..." : "Analyze Business Mix"}
                  </Button>
                )}
                <Textarea
                  data-testid="input-business-mix-analysis"
                  placeholder="Business mix summary will appear here — edit as needed."
                  value={form.businessMixAnalysis}
                  onChange={(e) => set("businessMixAnalysis", e.target.value)}
                  rows={5}
                />
              </CardContent>
            </Card>
          )}

          {/* ── CALL NOTES (MF Call Recap only) ── */}
          {form.template === "mf-callrecap" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Additional Call Discussion Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload an audio recording, video file, or text transcript. The file will NOT be attached to the email — only the summary will appear.
                </p>
                <div className="space-y-1">
                  <Label className="text-xs">File Type</Label>
                  <Select
                    value={form.callNotesType}
                    onValueChange={(v) => set("callNotesType", v as "audio" | "video" | "transcript")}
                  >
                    <SelectTrigger data-testid="select-call-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="audio">Audio Recording (.mp3, .wav, .m4a)</SelectItem>
                      <SelectItem value="video">Video Recording (.mp4, .mov, .webm)</SelectItem>
                      <SelectItem value="transcript">Text Transcript (.txt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <FileUploadZone
                  accept={
                    form.callNotesType === "transcript"
                      ? ".txt"
                      : form.callNotesType === "video"
                      ? ".mp4,.mov,.webm,.mpeg"
                      : ".mp3,.wav,.m4a,.ogg,.flac,.webm"
                  }
                  label={`Upload ${form.callNotesType} file`}
                  sublabel={
                    form.callNotesType === "transcript"
                      ? ".txt"
                      : form.callNotesType === "video"
                      ? ".mp4, .mov, .webm"
                      : ".mp3, .wav, .m4a"
                  }
                  fileName={form.callNotesFileName}
                  testId="call-notes"
                  icon={Mic}
                  onFile={(file) => {
                    setForm((p) => ({
                      ...p,
                      callNotesFile: file,
                      callNotesFileName: file.name,
                      callNotesSummary: "",
                      callNotesTranscript: "",
                    }));
                  }}
                />
                {form.callNotesFile && (
                  <Button
                    data-testid="analyze-btn-call-notes"
                    size="sm"
                    variant="outline"
                    className="gap-2 w-full"
                    onClick={analyzeCallNotes}
                    disabled={form.callNotesAnalyzing}
                  >
                    {form.callNotesAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                    )}
                    {form.callNotesAnalyzing ? "Transcribing & Summarizing..." : "Transcribe & Summarize"}
                  </Button>
                )}
                {form.callNotesSummary && (
                  <Textarea
                    data-testid="input-call-notes-summary"
                    value={form.callNotesSummary}
                    onChange={(e) => set("callNotesSummary", e.target.value)}
                    rows={5}
                    placeholder="Call summary will appear here — edit as needed."
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: Email Preview */}
        <div className="xl:sticky xl:top-20 xl:self-start space-y-4">
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="w-4 h-4 text-primary" />
                  Email Preview
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs">{templateLabel}</Badge>
                  {form.propertyName && (
                    <Badge variant="secondary" className="text-xs">{form.propertyName}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                data-testid="email-preview"
                className="email-preview bg-white rounded-md p-4 min-h-[400px] max-h-[70vh] overflow-y-auto border border-border text-foreground text-xs"
                dangerouslySetInnerHTML={{ __html: emailHTML }}
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  data-testid="button-copy"
                  onClick={handleCopy}
                  className="flex-1 gap-2 min-w-[120px]"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Email"}
                </Button>
                <Button
                  data-testid="button-reset"
                  variant="ghost"
                  onClick={handleReset}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </Button>
              </div>
              {/* Send via Gmail */}
              <div className="border-t border-border pt-3 space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Send via Gmail</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="To: recipient@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="flex-1 text-sm"
                    data-testid="input-recipient-email"
                  />
                  <Button
                    data-testid="button-send"
                    onClick={handleSend}
                    disabled={sending}
                    className="gap-2 shrink-0"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sends from kruggti@gmail.com with screenshots embedded. Business Mix Excel will need to be manually attached.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Parse pickup AI response into clean format ───────────────────────────────
function formatPickupAnalysis(raw: string): string {
  const lines = raw.split("\n").filter((l) => l.trim());
  const formatted: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Try to parse the structured format from Claude
      // Pass through as-is — Claude now returns "Month Year | RN: ... | Rev: ... | ADR: ... | Revenue Delta pacing ..."
    formatted.push(trimmed);
  }
  return formatted.join("\n");
}
