import {
  generateText,
  generateObject,
  tool,
  stepCountIs,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  analysisSchema,
  scanScamSignals,
  type AnalysisResponse,
} from "@/lib/analyze";

// ---------------------------------------------------------------------------
// Tool data: a small curated table of typical USED prices in Pakistan (PKR).
// In a real product this would come from a live pricing API / scraped data.
// ---------------------------------------------------------------------------
const MARKET_PRICES: { match: RegExp; low: number; high: number }[] = [
  { match: /iphone\s*15/i, low: 210000, high: 320000 },
  { match: /iphone\s*14/i, low: 160000, high: 240000 },
  { match: /iphone\s*13/i, low: 120000, high: 185000 },
  { match: /iphone\s*12/i, low: 90000, high: 140000 },
  { match: /iphone\s*11/i, low: 70000, high: 110000 },
  { match: /samsung\s*galaxy\s*s2[0-9]/i, low: 90000, high: 250000 },
  { match: /ps5|playstation\s*5/i, low: 110000, high: 160000 },
  { match: /ps4|playstation\s*4/i, low: 35000, high: 65000 },
  { match: /macbook/i, low: 120000, high: 400000 },
  { match: /honda\s*70|cd\s*70/i, low: 90000, high: 130000 },
  { match: /honda\s*125|cg\s*125/i, low: 150000, high: 260000 },
  { match: /dawlance|refrigerator|fridge/i, low: 40000, high: 120000 },
  { match: /(inverter\s*ac|1\.5\s*ton\s*ac|split\s*ac)/i, low: 70000, high: 180000 },
];

function extractFirstPricePKR(text: string): number | null {
  // Matches "Rs 60000", "60,000", "60k", "1.2 lakh", etc. (best-effort)
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*lakh/i);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  const k = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  const plain = text.match(/(?:rs\.?|pkr|rupees?)?\s*([0-9]{2,3}(?:[, ]?[0-9]{3})+)/i);
  if (plain) return parseInt(plain[1].replace(/[, ]/g, ""), 10);
  return null;
}

function normalizeNumber(raw: string): string {
  let n = raw.replace(/[^0-9+]/g, "");
  if (n.startsWith("+92")) n = "0" + n.slice(3);
  else if (n.startsWith("92")) n = "0" + n.slice(2);
  return n;
}

// ---------------------------------------------------------------------------
// The tools the agent can choose to call.
// ---------------------------------------------------------------------------
const tools = {
  scanScamKeywords: tool({
    description:
      "Scan the listing text for known Pakistani scam keywords/phrases (advance payment, courier-only, army officer, etc.). Returns matched signals and a keyword risk score 0-100.",
    inputSchema: z.object({
      text: z.string().describe("The full listing text to scan."),
    }),
    execute: async ({ text }) => scanScamSignals(text),
  }),

  estimateMarketPrice: tool({
    description:
      "Estimate the typical USED market price range (in PKR) for a common item in Pakistan, and compare it to an asking price to see if it is suspiciously low.",
    inputSchema: z.object({
      item: z.string().describe("Item name, e.g. 'iPhone 13' or 'PS5'."),
      askingPricePKR: z
        .number()
        .optional()
        .describe("The asking price in PKR, if known."),
    }),
    execute: async ({ item, askingPricePKR }) => {
      const row = MARKET_PRICES.find((m) => m.match.test(item));
      if (!row) {
        return { found: false, note: "No market data for this item." };
      }
      let comparison: string | undefined;
      if (askingPricePKR) {
        const pctBelow = Math.round(((row.low - askingPricePKR) / row.low) * 100);
        comparison =
          askingPricePKR < row.low
            ? `Asking price is about ${pctBelow}% below the normal minimum — suspiciously cheap.`
            : "Asking price is within or above the normal range.";
      }
      return {
        found: true,
        typicalRangePKR: { low: row.low, high: row.high },
        comparison,
      };
    },
  }),

  checkReportedSeller: tool({
    description:
      "Check a phone number against the database of previously reported scammer numbers. Returns how many times it was reported.",
    inputSchema: z.object({
      phoneNumber: z
        .string()
        .describe("A phone number found in the listing, any format."),
    }),
    execute: async ({ phoneNumber }) => {
      const number = normalizeNumber(phoneNumber);
      const hit = await prisma.reportedNumber.findUnique({ where: { number } });
      if (!hit) {
        return { reported: false, number };
      }
      return {
        reported: true,
        number,
        reports: hit.reports,
        reason: hit.reason,
      };
    },
  }),
};

const AGENT_SYSTEM_PROMPT = `You are "OLX Guard", an autonomous fraud-investigation agent for Pakistani online classifieds (OLX, Facebook Marketplace, PakWheels).

Your job: investigate a listing and decide if it is SAFE, RISKY, or a SCAM.

You have tools. USE THEM before deciding — do not rely on guesswork:
1. scanScamKeywords — always run this first on the listing text.
2. estimateMarketPrice — if an item and price are mentioned, check if the price is suspiciously low. Pass the asking price in PKR when you can read it.
3. checkReportedSeller — if the listing contains a phone number, check whether it has been reported before.

Investigate step by step, gather evidence from the tools, then give your final judgement.

Guidelines:
- A price far below market, an advance-payment request, or a reported number are strong SCAM signals.
- If information is thin, lean RISKY and ask clarifying questions.
- "SAFE" only when there are genuinely no red flags and a normal in-person cash deal looks likely.
- Respond in the same language the listing uses (English or Urdu). Keep it simple for non-technical users.
- In redFlags, include concrete evidence you found via tools (e.g. "Number reported 7 times", "Price 40% below market").`;

export async function runAgent(
  listing: string,
  model: LanguageModel,
  engineLabel = "agent",
): Promise<AnalysisResponse> {
  const askingPrice = extractFirstPricePKR(listing);

  // Phase 1 — the agentic loop. The model reasons and calls tools on its own
  // (up to 8 steps) to gather evidence. Note: Groq does not allow structured
  // JSON output in the same call as tools, so this phase produces free text.
  const investigation = await generateText({
    model,
    tools,
    stopWhen: stepCountIs(8),
    system: AGENT_SYSTEM_PROMPT,
    prompt:
      `Investigate this listing and decide if it is a scam. Use your tools to gather evidence, then explain your findings.\n\n"""\n${listing}\n"""` +
      (askingPrice ? `\n\n(Detected asking price: ~Rs ${askingPrice})` : ""),
  });

  const toolsUsed: string[] = [];
  const toolEvidence: string[] = [];
  for (const step of investigation.steps) {
    for (const call of step.toolCalls ?? []) {
      toolsUsed.push(call.toolName);
    }
    for (const res of step.toolResults ?? []) {
      const output = (res as { output?: unknown }).output;
      toolEvidence.push(`${res.toolName}: ${JSON.stringify(output)}`);
    }
  }

  // Phase 2 — turn the investigation into a clean, structured verdict.
  const structured = await generateObject({
    model,
    schema: analysisSchema,
    system: AGENT_SYSTEM_PROMPT,
    prompt: `Original listing:\n"""${listing}"""\n\nEvidence gathered from tools:\n${
      toolEvidence.join("\n") || "(no tool evidence)"
    }\n\nYour reasoning:\n${investigation.text}\n\nNow return the final structured verdict, including the tool evidence in the redFlags.`,
  });

  return {
    ...structured.object,
    engine: engineLabel,
    toolsUsed: [...new Set(toolsUsed)],
    steps: investigation.steps.length,
  };
}
