import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Analyzer from "@/components/Analyzer";

const VERDICT_BADGE: Record<string, string> = {
  SAFE: "bg-emerald-100 text-emerald-800",
  RISKY: "bg-amber-100 text-amber-800",
  SCAM: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const history = await prisma.analysis.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold text-emerald-950">
          Salam{session.user.name ? `, ${session.user.name}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Paste a suspicious listing below and let OLX Guard check it for you.
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Analyzer />

          <aside>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Your recent checks
            </h2>
            {history.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-emerald-200 bg-white p-5 text-sm text-gray-500">
                Nothing yet. Your analyzed listings will appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          VERDICT_BADGE[item.verdict] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {item.verdict} · {item.riskScore}/100
                      </span>
                      <time className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                      {item.listing}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
