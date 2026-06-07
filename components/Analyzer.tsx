"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  verdict: "SAFE" | "RISKY" | "SCAM";
  riskScore: number;
  summary: string;
  redFlags: string[];
  questions: string[];
  engine: string;
  toolsUsed?: string[];
  steps?: number;
};

const TOOL_LABELS: Record<string, string> = {
  scanScamKeywords: "Scanned text for scam keywords",
  estimateMarketPrice: "Checked the fair market price",
  checkReportedSeller: "Checked the number against reported scammers",
};

const VERDICT_STYLES: Record<
  Result["verdict"],
  { box: string; bar: string; label: string; emoji: string }
> = {
  SAFE: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    bar: "bg-emerald-500",
    label: "Looks Safe",
    emoji: "✅",
  },
  RISKY: {
    box: "border-amber-200 bg-amber-50 text-amber-900",
    bar: "bg-amber-500",
    label: "Be Careful",
    emoji: "⚠️",
  },
  SCAM: {
    box: "border-red-200 bg-red-50 text-red-900",
    bar: "bg-red-500",
    label: "Likely Scam",
    emoji: "🚨",
  },
};

const EXAMPLE = `iPhone 13 Pro 256GB for sale, only Rs 60000 (urgent, going abroad).
I am an army officer posted in Quetta so cannot meet. Pay advance via
Easypaisa and I will send through TCS courier today.`;

export default function Analyzer() {
  const router = useRouter();
  const [listing, setListing] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setResult(data);
        // Refresh server component so the new item appears in history.
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const style = result ? VERDICT_STYLES[result.verdict] : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <label
          htmlFor="listing"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          Paste the listing text or the seller&apos;s message
        </label>
        <textarea
          id="listing"
          value={listing}
          onChange={(e) => setListing(e.target.value)}
          rows={6}
          placeholder="e.g. iPhone 13 for sale, urgent, pay advance via Easypaisa..."
          className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={loading || listing.trim().length < 15}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Check this listing"}
          </button>
          <button
            type="button"
            onClick={() => setListing(EXAMPLE)}
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            Try an example
          </button>
          <span className="ml-auto text-xs text-gray-400">
            {listing.trim().length}/5000
          </span>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {result && style && (
        <div className={`rounded-2xl border p-5 shadow-sm ${style.box}`}>
          <div className="flex items-center justify-between gap-4">
            <h3 className="flex items-center gap-2 text-xl font-bold">
              <span>{style.emoji}</span> {style.label}
            </h3>
            <span className="text-sm font-medium opacity-80">
              Risk score: {result.riskScore}/100
            </span>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/60">
            <div
              className={`h-full ${style.bar}`}
              style={{ width: `${result.riskScore}%` }}
            />
          </div>

          <p className="mt-4 text-sm leading-relaxed">{result.summary}</p>

          {result.toolsUsed && result.toolsUsed.length > 0 && (
            <div className="mt-4 rounded-xl bg-white/60 p-3">
              <h4 className="text-sm font-semibold">
                🔎 What the agent did{" "}
                {result.steps ? `(${result.steps} steps)` : ""}
              </h4>
              <ul className="mt-1 space-y-1 text-sm">
                {result.toolsUsed.map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-emerald-600">✓</span>
                    {TOOL_LABELS[t] ?? t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <h4 className="text-sm font-semibold">Red flags</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {result.redFlags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-semibold">Ask the seller this first</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {result.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-xs opacity-70">
            Analyzed by:{" "}
            {result.engine.includes("agent")
              ? "AI agent (with tools)"
              : result.engine === "groq"
                ? "Groq (Llama AI)"
                : result.engine === "gemini"
                  ? "Gemini AI"
                  : "built-in rules engine"}
            . This is guidance, not a guarantee — always meet in person and pay
            only after inspecting the item.
          </p>
        </div>
      )}
    </div>
  );
}
