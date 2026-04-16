import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X, ImageIcon, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadSectionProps {
  title: string;
  sectionKey: string;
  imageData: string | null;
  analysisText: string;
  analyzing: boolean;
  children?: React.ReactNode;
  onImageChange: (dataUrl: string | null, file: File | null) => void;
  onAnalyze: () => void;
  analyzeLabel?: string;
}

export function ImageUploadSection({
  title,
  sectionKey,
  imageData,
  analysisText,
  analyzing,
  children,
  onImageChange,
  onAnalyze,
  analyzeLabel = "Analyze with AI",
}: ImageUploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => onImageChange(reader.result as string, file);
    reader.readAsDataURL(file);
  }, [onImageChange]);

  const handleImageBlob = useCallback((blob: Blob) => {
    const file = new File([blob], `paste-${Date.now()}.png`, { type: blob.type || "image/png" });
    handleFile(file);
  }, [handleFile]);

  // ── Global paste listener: catches Ctrl+V from Snipping Tool ──
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Only intercept if this zone is focused OR no other input/textarea is focused
      const active = document.activeElement;
      const isInputFocused =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable);

      // If an input/textarea is focused, don't intercept
      if (isInputFocused) return;

      // If this zone is focused, always accept
      // If nothing relevant is focused, accept on the first zone that is visible
      if (!focused && !zoneRef.current?.matches(":focus-within")) {
        // Only accept if zone is on screen and no other zone has claimed it
        // We'll use a custom event to coordinate between multiple zones
        return;
      }

      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (imageItem) {
        e.preventDefault();
        const blob = imageItem.getAsFile();
        if (blob) handleImageBlob(blob);
      }
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [focused, handleImageBlob]);

  // ── Zone-level paste (when zone div itself is focused via tabIndex) ──
  const handleZonePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (imageItem) {
      e.preventDefault();
      const blob = imageItem.getAsFile();
      if (blob) handleImageBlob(blob);
    }
  }, [handleImageBlob]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  // Click opens file picker ONLY when clicking the "browse" button, not the whole zone
  const handleZoneClick = (e: React.MouseEvent) => {
    // Focus the zone so paste works, but don't open file picker
    zoneRef.current?.focus();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          {title}
          {imageData && (
            <Badge variant="secondary" className="text-xs normal-case font-normal">
              Image attached
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Drop / Paste zone */}
        <div
          ref={zoneRef}
          tabIndex={0}
          data-testid={`dropzone-${sectionKey}`}
          className={cn(
            "relative border-2 border-dashed rounded-lg transition-all outline-none",
            dragging
              ? "border-primary bg-accent scale-[1.01]"
              : focused
              ? "border-primary bg-accent/30 ring-2 ring-primary/20"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            imageData ? "p-2 cursor-default" : "p-6 cursor-pointer"
          )}
          onClick={handleZoneClick}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={handleZonePaste}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {imageData ? (
            <div className="relative">
              <img
                src={imageData}
                alt={`${title} screenshot`}
                className="rounded max-h-64 w-full object-contain bg-muted"
              />
              <button
                data-testid={`remove-image-${sectionKey}`}
                className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-1 shadow transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onImageChange(null, null);
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-center select-none pointer-events-none">
              <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                Click here, then paste your screenshot
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">Ctrl+V</kbd>
                {" "}after clicking — or drag & drop
              </p>
            </div>
          )}

          {/* Hidden file input — only triggered by the Browse button below */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            data-testid={`file-input-${sectionKey}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              // Reset so same file can be re-selected
              e.target.value = "";
            }}
          />
        </div>

        {/* Browse button — separate from the paste zone */}
        {!imageData && (
          <button
            type="button"
            data-testid={`browse-btn-${sectionKey}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Or browse to upload a file
          </button>
        )}

        {/* Optional child controls */}
        {children}

        {/* Analyze button */}
        {imageData && (
          <Button
            data-testid={`analyze-btn-${sectionKey}`}
            size="sm"
            variant="outline"
            className="gap-2 w-full"
            onClick={onAnalyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            )}
            {analyzing ? "Analyzing..." : analyzeLabel}
          </Button>
        )}

        {/* Analysis result */}
        {analysisText && (
          <div
            data-testid={`analysis-${sectionKey}`}
            className="bg-accent/60 rounded-md p-3 text-sm text-foreground border border-border whitespace-pre-wrap"
          >
            {analysisText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
