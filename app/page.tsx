import Link from "next/link";
import { auth } from "@/auth";
import Navbar from "@/components/Navbar";

export default async function Home() {
  const session = await auth();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Made for Pakistan 🇵🇰
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-emerald-950 sm:text-5xl">
            Don&apos;t get scammed on OLX again.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            Paste any OLX, Facebook Marketplace or PakWheels listing and OLX
            Guard instantly tells you if it&apos;s{" "}
            <span className="font-semibold text-emerald-700">SAFE</span>,{" "}
            <span className="font-semibold text-amber-600">RISKY</span> or a{" "}
            <span className="font-semibold text-red-600">SCAM</span> — with the
            exact red flags and what to ask the seller.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href={session?.user ? "/dashboard" : "/signup"}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {session?.user ? "Open Dashboard" : "Get started — it's free"}
            </Link>
            <Link
              href={session?.user ? "/dashboard" : "/login"}
              className="rounded-xl border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              {session?.user ? "Analyze a listing" : "Log in"}
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                emoji: "📋",
                title: "1. Paste it",
                body: "Copy the seller's message or the listing description and paste it in.",
              },
              {
                emoji: "🤖",
                title: "2. AI checks it",
                body: "An agent trained on Pakistani scam patterns reasons through every red flag.",
              },
              {
                emoji: "🛡",
                title: "3. Get a verdict",
                body: "A clear SAFE / RISKY / SCAM result with reasons and questions to ask.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm"
              >
                <div className="text-3xl">{card.emoji}</div>
                <h3 className="mt-3 font-bold text-emerald-900">{card.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{card.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-emerald-100 bg-white py-6 text-center text-sm text-gray-500">
        OLX Guard — built to make online buying in Pakistan safer.
      </footer>
    </>
  );
}
