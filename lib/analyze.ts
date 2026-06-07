import { z } from "zod";
import { type LanguageModel } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";

// Pick an AI model based on whichever provider key is configured.
// Groq is the default because its free tier works in Pakistan without a card.
function pickModel(): { model: LanguageModel; engine: string } | null {
  if (process.env.GROQ_API_KEY) {
    return {
      model: groq(process.env.GROQ_MODEL || "openai/gpt-oss-20b"),
      engine: "groq",
    };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      model: google(process.env.GEMINI_MODEL || "gemini-2.0-flash"),
      engine: "gemini",
    };
  }
  return null;
}

export const analysisSchema = z.object({
  verdict: z
    .enum(["SAFE", "RISKY", "SCAM"])
    .describe("Overall judgement of the listing."),
  riskScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0 = clearly safe, 100 = almost certainly a scam."),
  summary: z
    .string()
    .describe("2-3 sentence plain-language verdict the buyer can act on."),
  redFlags: z
    .array(z.string())
    .describe("Specific warning signs found in the listing."),
  questions: z
    .array(z.string())
    .describe("Questions the buyer should ask the seller before paying."),
});

export type AnalysisResult = z.infer<typeof analysisSchema>;
export type AnalysisResponse = AnalysisResult & {
  engine: string;
  toolsUsed?: string[];
  steps?: number;
};

const SCAM_PATTERNS: { pattern: RegExp; flag: string; weight: number }[] = [
  {
    pattern: /\b(advance|booking|token)\b/i,
    flag: "Asks for advance / booking / token money before meeting.",
    weight: 35,
  },
  {
    pattern: /\b(easypaisa|jazzcash|jazz cash|easy paisa)\b/i,
    flag: "Wants payment via Easypaisa/JazzCash to a personal account.",
    weight: 25,
  },
  {
    pattern: /\b(bank transfer|account number|account no|iban)\b/i,
    flag: "Requests a bank transfer before any in-person meeting.",
    weight: 25,
  },
  {
    pattern: /\b(tcs|leopards?|courier|delivery|shipping)\b/i,
    flag: "Promises courier delivery — common pretext to take advance money.",
    weight: 20,
  },
  {
    pattern: /\b(army|fauji|officer|posted|cantt|military)\b/i,
    flag: "Seller claims to be an army/government officer posted elsewhere.",
    weight: 30,
  },
  {
    pattern: /\b(going abroad|abroad|foreign|leaving country|shifting abroad)\b/i,
    flag: "'Going abroad' urgency — a classic pressure tactic.",
    weight: 20,
  },
  {
    pattern: /\b(urgent|urgently|jaldi|today only|aj hi)\b/i,
    flag: "Creates false urgency to rush you into paying.",
    weight: 12,
  },
  {
    pattern: /\b(otp|cnic|pin|verification code)\b/i,
    flag: "Asks for OTP / CNIC / PIN — never share these.",
    weight: 40,
  },
  {
    pattern: /\b(gift|lottery|prize|reward|inaam)\b/i,
    flag: "Mentions a prize/gift/lottery — almost always a scam.",
    weight: 25,
  },
  {
    pattern: /\b(whatsapp only|only whatsapp|cant meet|can't meet|no meeting)\b/i,
    flag: "Refuses to meet in person.",
    weight: 18,
  },
];

// Scans text for known Pakistani scam keywords. Shared by the offline
// analyzer and by the agent's `scanScamKeywords` tool.
export function scanScamSignals(listing: string): {
  flags: string[];
  score: number;
} {
  const text = listing.toLowerCase();
  const flags: string[] = [];
  let score = 0;

  for (const { pattern, flag, weight } of SCAM_PATTERNS) {
    if (pattern.test(text)) {
      flags.push(flag);
      score += weight;
    }
  }

  if (/\b(only|sirf|just)\b/i.test(text) && /\b(rs|pkr|rupees?)\b/i.test(text)) {
    flags.push("Price is highlighted as unusually low — verify market rate.");
    score += 10;
  }

  return { flags, score: Math.min(score, 100) };
}

// Offline keyword-based analyzer. Used when no AI key is configured or the
// AI call fails, so the app is always usable.
export function heuristicAnalyze(listing: string): AnalysisResponse {
  const { flags: redFlags, score } = scanScamSignals(listing);

  const verdict: AnalysisResult["verdict"] =
    score >= 55 ? "SCAM" : score >= 25 ? "RISKY" : "SAFE";

  const summary =
    verdict === "SCAM"
      ? "This listing shows strong scam signals. Do NOT send any money. Only deal in person with cash after inspecting the item."
      : verdict === "RISKY"
        ? "This listing has some warning signs. Be careful: meet in a public place, inspect the item, and never pay in advance."
        : "No obvious scam signals were detected, but always meet in person, inspect the item, and pay only after you receive it.";

  const questions = [
    "Can we meet in person at a public place so I can inspect the item?",
    "Will you accept cash on delivery / payment only after I receive the item?",
    "Can you share your real local phone number for a call?",
  ];
  if (redFlags.some((f) => f.toLowerCase().includes("courier"))) {
    questions.push("Why can't I collect it myself instead of using a courier?");
  }

  return {
    verdict,
    riskScore: score,
    summary,
    redFlags:
      redFlags.length > 0
        ? redFlags
        : ["No common scam keywords were found in the text."],
    questions,
    engine: "heuristic",
  };
}

export async function analyzeListing(
  listing: string,
): Promise<AnalysisResponse> {
  const picked = pickModel();
  if (!picked) {
    return heuristicAnalyze(listing);
  }

  try {
    // Run the autonomous agent: it reasons and calls tools in a loop before
    // producing a structured verdict. Imported lazily to avoid a circular
    // import (agent.ts imports helpers from this file).
    const { runAgent } = await import("@/lib/agent");
    return await runAgent(listing, picked.model, `${picked.engine}-agent`);
  } catch (err) {
    console.error(
      `${picked.engine} agent failed, using heuristic fallback:`,
      err,
    );
    const fallback = heuristicAnalyze(listing);
    return { ...fallback, engine: "heuristic-fallback" };
  }
}
