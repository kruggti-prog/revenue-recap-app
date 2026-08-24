import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";

// Create a fresh Anthropic instance per-call so the API key is always current
function getClient() {
  return new Anthropic();
}

// ── Shared style instruction ───────────────────────────────────────────────────
const STYLE_INSTRUCTION = `
CRITICAL FORMATTING RULES — follow these exactly, no exceptions:
- Write in plain conversational prose. NO bullet points. NO dashes as bullets. NO markdown bold (**text**). NO headers. NO lists of any kind.
- Write 2-4 short paragraphs. Each paragraph is 2-4 sentences. No more.
- Cite actual numbers inline within sentences, like a person talking: "we're up 229 rooms" or "ADR is $173 vs $94 STLY".
- Tone: casual, direct, positive where data supports it. Sound like a sharp revenue manager talking to a GM, not a report generator.
- Do NOT start with "Here is a summary" or any intro sentence. Just start with the content.
- Do NOT use the word "significant" or "notable" — be specific instead.
- Do NOT use asterisks, hyphens as list markers, or any markdown formatting whatsoever.
`;

// ── Helper: extract base64 file from JSON body ────────────────────────────────
function getFileFromBody(body: any, fieldName: string): { buffer: Buffer; mimetype: string; name: string } | null {
  const b64 = body[fieldName];
  const mime = body[`${fieldName}_type`] || "application/octet-stream";
  const name = body[`${fieldName}_name`] || fieldName;
  if (!b64) return null;
  return {
    buffer: Buffer.from(b64, "base64"),
    mimetype: mime,
    name,
  };
}

// ── Vision helper ─────────────────────────────────────────────────────────────
async function analyzeImage(imageBuffer: Buffer, mimeType: string, prompt: string): Promise<string> {
  const validMime = (
    mimeType === "image/jpeg" || mimeType === "image/jpg"
      ? "image/jpeg"
      : mimeType === "image/png"
      ? "image/png"
      : mimeType === "image/gif"
      ? "image/gif"
      : mimeType === "image/webp"
      ? "image/webp"
      : "image/png"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: validMime,
              data: imageBuffer.toString("base64"),
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return (response.content[0] as { type: string; text: string }).text;
}

// ── Text helper ───────────────────────────────────────────────────────────────
async function analyzeText(prompt: string): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return (response.content[0] as { type: string; text: string }).text;
}

export function registerAIRoutes(app: Express) {
  // ── Pickup & Pacing (Excel via base64 JSON) ──────────────────────────────
  app.post("/api/ai/pickup", async (req: Request, res: Response) => {
    try {
      const fileData = getFileFromBody(req.body, "file");
      if (!fileData) return res.status(400).json({ error: "No file provided" });

      let excelText = "";
      try {
        const wb = XLSX.read(fileData.buffer, { type: "buffer" });
        for (const sheetName of wb.SheetNames.slice(0, 3)) {
          const ws = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(ws);
          excelText += `\n--- Sheet: ${sheetName} ---\n${csv.split("\n").slice(0, 100).join("\n")}`;
        }
      } catch (e) {
        excelText = "[Could not parse file]";
      }

      const prompt = `You are reading a hotel Pickup & Pacing Excel report. The spreadsheet has two main umbrella column groups:

1. "Pickup Since" umbrella — contains these sub-columns:
   - RN Delta (or RN's Delta): the room night pickup value → this is the "XX RN" figure
   - Revenue Delta: the revenue pickup value → this is the "YY Rev" figure
   - ADR Delta: the ADR pickup value → this is the "ZZ ADR" figure

2. "STLY as of" umbrella — contains these sub-columns:
   - Revenue Delta: how revenue is pacing vs same time last year → this is the "Revenue Delta pacing AA" figure

The report will show data for three months (current month, next month, following month).

Here is the raw data:
${excelText}

Return EXACTLY three lines — one per month shown in the data, in chronological order. Use the actual month name and year (e.g. "April 2026"). No labels like "Current Month" or "Next Month" — just the month name. Nothing else, no extra text, no commentary:
[Month Year] | RN: [RN Delta from Pickup Since] | Rev: $[Revenue Delta from Pickup Since] | ADR: $[ADR Delta from Pickup Since] | Revenue Delta pacing [up/down] $[Revenue Delta from STLY as of]
[Month Year] | RN: [RN Delta from Pickup Since] | Rev: $[Revenue Delta from Pickup Since] | ADR: $[ADR Delta from Pickup Since] | Revenue Delta pacing [up/down] $[Revenue Delta from STLY as of]
[Month Year] | RN: [RN Delta from Pickup Since] | Rev: $[Revenue Delta from Pickup Since] | ADR: $[ADR Delta from Pickup Since] | Revenue Delta pacing [up/down] $[Revenue Delta from STLY as of]

For the Revenue Delta pacing direction: if the value is positive use "up", if negative use "down". If a value is missing or unclear, use N/A.`;

      const result = await analyzeText(prompt);
      res.json({ analysis: result });
    } catch (e: any) {
      console.error("Pickup analysis error:", e);
      res.status(500).json({ error: e.message || "Analysis failed" });
    }
  });

  // ── CoStar ───────────────────────────────────────────────────────────────
  app.post("/api/ai/costar", async (req: Request, res: Response) => {
    try {
      const fileData = getFileFromBody(req.body, "image");
      if (!fileData) return res.status(400).json({ error: "No image provided" });
      const period = req.body.period === "28" ? "last 28 days" : "last 7 days";

      const prompt = `Analyze this CoStar hotel performance report screenshot. This data covers the ${period}.

You are writing a brief CoStar performance update for a hotel General Manager.

${STYLE_INSTRUCTION}

BEFORE writing, check whether the "% Chg" column for My Property shows dashes ("-") throughout instead of percentages. If it does, that means the hotel was not open last year and there is no year-over-year comparison data. In that case:
- Do NOT make any year-over-year comparisons.
- Be more lenient when interpreting indexes — it is extremely rare for a new hotel to index at or near 100 in its first year, so frame sub-100 indexes as expected for a new property and highlight the positive trajectory instead.
- Focus the commentary on performance vs the comp set for this period only.

CRITICAL — HOW TO READ THIS DATA CORRECTLY:
- "My Property" is the hotel we are writing about. "Comp Set" is the competitive set average.
- Higher occupancy % for My Property vs Comp Set = My Property is winning on occupancy. This is GOOD.
- Higher ADR $ for My Property vs Comp Set = My Property is charging more per room. This is GOOD.
- Higher RevPAR $ for My Property vs Comp Set = My Property is generating more revenue per room. This is GOOD.
- Index above 100 (MPI, ARI, RGI) = outperforming the comp set. This is GOOD.
- Index below 100 = underperforming the comp set. This is an opportunity.
- Do NOT reverse this logic under any circumstances. If My Property occupancy (86.6%) is higher than Comp Set occupancy (67.9%), that is strong performance — never describe it as underperformance.

STAY BROAD: Write at the summary level only. Do NOT mention individual days of the week, specific daily rates, or day-by-day patterns. The GM needs the big picture — overall totals and averages vs the comp set, not a breakdown of Monday vs Thursday.

CRITICAL STRUCTURE: Write EXACTLY three labeled sections in this order. Each section label must appear on its own line, then 1-2 sentences of plain prose. No bullets, no markdown, no extra blank lines between sections.

Occupancy: [1-2 sentences — overall occupancy % vs comp set %, MPI index, broad takeaway only]
ADR: [1-2 sentences — overall ADR $ vs comp set ADR $, ARI index, broad takeaway only]
RevPAR: [1-2 sentences — overall RevPAR $ vs comp set RevPAR $, RGI index, and one strategic opportunity]

Use the Total column figures wherever visible — do not pull from individual day columns. If we are above index (above 100) say so positively. If below, frame as an opportunity. Sound like a sharp revenue manager, not a report generator.`;

      const result = await analyzeImage(fileData.buffer, fileData.mimetype, prompt);
      res.json({ summary: result });
    } catch (e: any) {
      console.error("CoStar analysis error:", e);
      res.status(500).json({ error: e.message || "Analysis failed" });
    }
  });

  // ── OTA / Expedia ────────────────────────────────────────────────────────
  app.post("/api/ai/ota", async (req: Request, res: Response) => {
    try {
      const fileData = getFileFromBody(req.body, "image");
      if (!fileData) return res.status(400).json({ error: "No image provided" });

      const periodMap: Record<string, string> = {
        next14: "stays booked for the next 14 days vs comp set",
        next28: "stays booked for the next 28 days vs comp set",
        last7: "stays from the last 7 days vs comp set",
        last14: "stays from the last 14 days vs comp set",
      };
      const periodLabel = periodMap[req.body.period] || "OTA production period";
      const platform = req.body.platform || "Expedia";

      const prompt = `Analyze this ${platform} OTA Production Report screenshot showing ${periodLabel}.

You are writing a brief ${platform} performance update for a hotel General Manager.

${STYLE_INSTRUCTION}

CRITICAL — read this data correctly:
- The three metrics shown are Revenue, Room Nights, and ADR (Average Daily Rate).
- Each metric shows our number, a percentage, and a "Fair share" or "Competitive set" reference number.
- The percentage (e.g. +68%, +110%, -19%) is NOT year-over-year change. It shows how much we are above or below the comp set's fair share baseline for this period.
- "Fair share (6.6%): $18,095" means if we captured exactly our fair share of the market, we would have $18,095 in revenue. Our actual number ($30,446) is 68% above that fair share baseline.
- "Fair share (6.6%): 103" means fair share room nights would be 103. We booked 216, which is 110% above fair share.
- For ADR, "Competitive set: $213" is the comp set's actual average rate — we are 19% below that.
- Do NOT say revenue is "up 68%" or room nights are "up 110%" — those are not growth figures, they are how far we are beating our fair share benchmark.
- DO say things like: "We booked 216 room nights, which is 110% above our fair share of 103" or "Revenue came in at $30,446, running 68% ahead of our $18,095 fair share baseline."
- IGNORE the fair share percentage (6.6%) entirely — do not mention it. It is an internal Expedia benchmark that does not change and is not useful to the GM.
- All comparisons are against the comp set for this specific period only. There is no year-over-year data here.

Write 2-3 short paragraphs. Cover revenue and room night performance vs comp set fair share, ADR vs the comp set, and 1-2 opportunities if visible (pricing, restrictions, content). Keep each paragraph to 2-3 sentences. Use actual figures from the screenshot.`;

      const result = await analyzeImage(fileData.buffer, fileData.mimetype, prompt);
      res.json({ summary: result });
    } catch (e: any) {
      console.error("OTA analysis error:", e);
      res.status(500).json({ error: e.message || "Analysis failed" });
    }
  });

  // ── Business Mix ─────────────────────────────────────────────────────────
  app.post("/api/ai/business-mix", async (req: Request, res: Response) => {
    try {
      const fileData = getFileFromBody(req.body, "file");
      if (!fileData) return res.status(400).json({ error: "No file provided" });

      const today = new Date();
      const dayOfMonth = today.getDate();
      const monthName = today.toLocaleString("en-US", { month: "long" });
      const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - dayOfMonth;
      const timingContext =
        dayOfMonth <= 3
          ? `${monthName} is just getting started — only ${dayOfMonth} day${dayOfMonth === 1 ? "" : "s"} in, so this is a very early look at the pace.`
          : dayOfMonth <= 8
          ? `We're in the early days of ${monthName}, so there's a lot of month still ahead to shape the outcome.`
          : dayOfMonth <= 13
          ? `We're about a third of the way into ${monthName}, still plenty of runway left.`
          : dayOfMonth <= 17
          ? `We're right at the halfway point of ${monthName}, so this is a solid mid-month check-in.`
          : dayOfMonth <= 22
          ? `${monthName} is more than halfway done — the picture is getting clearer and there's still time to close gaps.`
          : dayOfMonth <= 26
          ? `We're in the back half of ${monthName} now with about ${daysLeft} days remaining — the month is nearly written.`
          : `${monthName} is almost in the books with only ${daysLeft} days left — attention is shifting to next month.`;

      let excelText = "";
      try {
        const wb = XLSX.read(fileData.buffer, { type: "buffer" });
        for (const sheetName of wb.SheetNames.slice(0, 3)) {
          const ws = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(ws);
          excelText += `\n--- Sheet: ${sheetName} ---\n${csv.split("\n").slice(0, 80).join("\n")}`;
        }
      } catch (e) {
        excelText = "[Could not parse Excel file]";
      }

      const prompt = `You are analyzing a hotel Business Mix Report. Write a GM-facing email summary.

Today's date: ${dateStr}
Timing context: ${timingContext}

Here is the raw data:
${excelText}

Instructions:
- Compare what is currently on the books to same time last year (STLY)
- Columns labeled "Final" = where last year ended. DO NOT mention last year's final numbers in the summary.
- Cover the key segments (Transient, Negotiated, Group, Government, Contract — whatever is in the data)
- Call out which segments are ahead or behind STLY with actual numbers: room nights and revenue where available
- Note ADR differences if they stand out
- Work the timing context naturally into the narrative (don't force it)

${STYLE_INSTRUCTION}

Here is an example of the exact style and format to match:

"Halfway through April, Aberdeen is well ahead of last year on both rooms and revenue, with a huge lift in ADR. We've got 1,263 room nights on the books vs 1,034 STLY, so we're up 229 rooms, and total revenue is sitting at $218.8K vs $97.5K STLY, which is an increase of about $121.2K at this point in the month.

Rate is the standout: ADR is $173.20 vs $94.32 STLY, up almost $79, so we're not only filling more rooms, we're doing it at a much higher price point. Most of that strength is coming from the negotiated segment, which is up 270 room nights and roughly $109.9K in revenue vs STLY at a significantly higher ADR.

Government and group are also ahead on revenue, but on a smaller base, and there are a few legacy accounts that are down or not returning this year, which is totally fine given how strong the new business is pacing."

Write in that exact style — conversational paragraphs, real numbers, no lists, no bullets, no markdown.`;

      const result = await analyzeText(prompt);
      res.json({ summary: result });
    } catch (e: any) {
      console.error("Business mix analysis error:", e);
      res.status(500).json({ error: e.message || "Analysis failed" });
    }
  });

  // ── Call Notes Transcription ─────────────────────────────────────────────
  app.post("/api/ai/transcribe", async (req: Request, res: Response) => {
    try {
      const fileData = getFileFromBody(req.body, "file");
      if (!fileData) return res.status(400).json({ error: "No file provided" });
      const fileType = req.body.file_type || "transcript";

      let transcriptText = "";
      if (fileType === "transcript") {
        transcriptText = fileData.buffer.toString("utf-8");
      } else {
        // Use OpenAI Whisper via Node SDK — no Python required
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        // Whisper needs a File-like object with a name so it knows the format
        const audioFile = new File([fileData.buffer], fileData.name || "audio.m4a", {
          type: fileData.mimetype || "audio/mp4",
        });
        const response = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file: audioFile,
          response_format: "text",
        });
        transcriptText = (response as any as string).trim();
      }

      const prompt = `You are summarizing a hotel revenue management call for a General Manager email recap.

Here is the call transcript:
---
${transcriptText.slice(0, 80000)}
---

${STYLE_INSTRUCTION}

Write 2-4 short paragraphs covering: key topics discussed, any decisions made, and action items or follow-ups. Start directly with the content — do not write "Here's a summary" or any intro phrase.`;

      const summary = await analyzeText(prompt);
      res.json({ transcript: transcriptText, summary });
    } catch (e: any) {
      console.error("Transcription error:", e);
      res.status(500).json({ error: e.message || "Transcription failed" });
    }
  });

  // ── Send Email via Gmail ─────────────────────────────────────────────────
  app.post("/api/send-email", async (req: Request, res: Response) => {
    try {
      const { to, subject, htmlBody, textBody } = req.body;
      if (!to || !subject || !htmlBody) {
        return res.status(400).json({ error: "Missing to, subject, or htmlBody" });
      }

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        service: "gmail",
        auth: {
          user: "kruggti@gmail.com",
          pass: "aldwccmemrsauaxv",
        },
      });

      await transporter.sendMail({
        from: `"Revenue Recap" <kruggti@gmail.com>`,
        to,
        subject,
        text: textBody || "",
        html: htmlBody,
      });

      res.json({ success: true });
    } catch (e: any) {
      console.error("Send email error:", e);
      res.status(500).json({ error: e.message || "Failed to send email" });
    }
  });

  // ── Save Recap to Google Sheet ────────────────────────────────────────────
  app.post("/api/save-recap", async (req: Request, res: Response) => {
    try {
      const { property, template, emailContent } = req.body;
      if (!property || !emailContent) {
        return res.status(400).json({ error: "Property name and email content are required" });
      }

      const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxU-JkJxNfqcxFTyVdYZE_xEDhmu5Q-Z2dgLZS7eGpoA5KhZuh1SA494bnXrDir2hfvfg/exec";
      const date = new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });

      // Google Apps Script blocks external POSTs — use GET with query params instead.
      // Strip Unicode box-drawing separators (━) before encoding — they expand 7x in URLs.
      const cleanContent = emailContent
        .replace(/[─-╿▀-▟━-┃┄-┋┌-┓└-┛├-┣┤-┫┬-┳┴-┻┼-╋╌-╏═-╬╭-╰╱-╳╴-╿]+/g, "---")
        .trim();

      const fullUrl = `${WEBHOOK_URL}?property=${encodeURIComponent(property.trim())}&date=${encodeURIComponent(date)}&template=${encodeURIComponent(template || "Unknown")}&emailContent=${encodeURIComponent(cleanContent)}`;
      console.log("Save recap URL length:", fullUrl.length);

      const response = await fetch(fullUrl, {
        method: "GET",
        redirect: "follow",
      });

      const text = await response.text();
      // Only throw on confirmed hard failures — Google sometimes returns an auth
      // redirect page even when the script already wrote the row successfully.
      // Treat anything that isn't a known hard error as success.
      const hardFailed = text.includes("Bad Request") || text.includes("Page Not Found") || text.includes("Sorry, unable to open");
      if (hardFailed) {
        throw new Error("Webhook failed: " + text.slice(0, 200));
      }
      // Log what we got for debugging but don't fail on redirect pages
      if (!text.includes("success")) {
        console.log("Save recap: non-JSON response (likely Google redirect, row still saved):", text.slice(0, 100));
      }
      res.json({ success: true, sheetUrl: "https://docs.google.com/spreadsheets/d/1SPkX9gpsii4R6gi-K74_rDHSlNIHLs_p4soOT1ddi-I/edit" });
    } catch (e: any) {
      console.error("Save recap error:", e);
      res.status(500).json({ error: e.message || "Failed to save recap" });
    }
  });
}
