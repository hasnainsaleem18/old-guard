import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { analyzeListing } from "@/lib/analyze";

const bodySchema = z.object({
  listing: z.string().trim().min(15, "Please paste a longer listing.").max(5000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await analyzeListing(parsed.data.listing);

  const saved = await prisma.analysis.create({
    data: {
      userId: session.user.id,
      listing: parsed.data.listing,
      verdict: result.verdict,
      riskScore: result.riskScore,
      summary: result.summary,
      redFlags: JSON.stringify(result.redFlags),
      questions: JSON.stringify(result.questions),
      engine: result.engine,
      toolsUsed: result.toolsUsed ? JSON.stringify(result.toolsUsed) : null,
    },
  });

  return NextResponse.json({ id: saved.id, ...result });
}
