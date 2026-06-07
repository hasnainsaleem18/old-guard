# 🛡 OLX Guard

**Spot online scams on OLX, Facebook Marketplace and PakWheels — instantly.**

Paste any listing or seller message and OLX Guard gives you a clear
**SAFE / RISKY / SCAM** verdict, the exact red flags it found, and the
questions you should ask the seller before paying. Built specifically for the
scams that are common in Pakistan.

This is a full-stack, agentic AI application written entirely in **TypeScript**.

---

## What's inside (the tech stack)

- **Language:** TypeScript — one language across the whole app
- **Framework:** Next.js 16 (App Router) — frontend and backend in one project
- **Frontend / UI:** React 19 + Tailwind CSS 4
- **AI / Agent:** Vercel AI SDK + Groq (Llama / GPT-OSS) — the tool-using agent and its reasoning loop
- **Authentication:** Auth.js (NextAuth v5) — email/password login with JWT sessions
- **Database:** PostgreSQL (hosted on Neon)
- **ORM (database access):** Prisma — lets TypeScript talk to PostgreSQL
- **Validation:** Zod — checks all incoming data
- **Hosting / Deployment:** Vercel — auto-deploys on every `git push`
- **Version control:** Git + GitHub

> **No AI key? No problem.** If you don't set a `GROQ_API_KEY`, the app falls
> back to a built-in rules engine so everything still works. Add a key to get
> the full tool-using AI agent. (Google Gemini is also supported if you prefer.)

---

## How it works (the agentic flow)

This is a real **tool-using agent**, not a single prompt. The model decides
which tools to call, in a loop (up to 8 steps), gathers evidence, then gives a
structured verdict.

```
You paste a listing
        ↓
/api/analyze  (checks you are logged in)
        ↓
PHASE 1 — the agent loops, choosing tools on its own:
   • scanScamKeywords(text)        → matches known PK scam phrases + score
   • estimateMarketPrice(item)     → is the price suspiciously below market?
   • checkReportedSeller(number)   → is the phone number in the scam database?
        ↓
PHASE 2 — the agent turns its evidence into a structured verdict:
   { verdict, riskScore, summary, redFlags[], questions[] }
        ↓
Saved to the database (with which tools were used) and shown in history
```

The agent is smart about which tools to use — e.g. if a listing has no phone
number, it skips the reported-seller check. Every red flag it reports is backed
by real tool evidence (e.g. *"price 63% below market"*, *"number reported 7 times"*).

> **Two phases?** Groq doesn't allow tool-calling and strict JSON output in the
> same request, so Phase 1 does the tool loop and Phase 2 formats the result.
> This is a common, robust agent pattern.

---

## Run it locally (3 steps)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up the environment file
Fill in `.env` (a generated `AUTH_SECRET` is already there):

- `DATABASE_URL` — a free Postgres string from [Neon](https://neon.tech).
- `GROQ_API_KEY` — a free key from [console.groq.com](https://console.groq.com)
  (or leave blank to use the offline rules engine).

### 3. Create the database tables, seed, and start the app
```bash
npm run db:push        # creates the tables in your Neon database
node scripts/seed.mjs  # (optional) seed sample reported scam numbers
npm run dev            # starts http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start checking listings.

---

## Project structure

```
olx-guard/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── login/page.tsx            # Login form
│   ├── signup/page.tsx           # Signup form
│   ├── dashboard/page.tsx        # Protected: analyzer + history
│   └── api/
│       ├── auth/[...nextauth]/   # Auth.js routes
│       ├── signup/route.ts       # Create account
│       └── analyze/route.ts      # Run the scam check (auth required)
├── components/
│   ├── Navbar.tsx
│   ├── Analyzer.tsx              # The main input + result card
│   └── SignOutButton.tsx
├── lib/
│   ├── prisma.ts                 # Database client
│   ├── analyze.ts                # Provider picker + rules-engine fallback
│   └── agent.ts                  # The tool-using agent + its 3 tools
├── prisma/
│   └── schema.prisma             # User, Analysis, ReportedNumber tables
├── scripts/
│   └── seed.mjs                  # Seeds a few reported scam numbers
├── auth.ts                       # Auth.js configuration
└── .env                          # Secrets & config
```

---

## Deploy it free (Vercel + Neon)

**1. Get a free Postgres database (Neon)**
- Sign up at [neon.tech](https://neon.tech), create a project.
- Copy the connection string (Neon shows a ready-made `DATABASE_URL`).

**2. Point your local app at Neon and create the tables**
- Put that string in `.env` as `DATABASE_URL`.
- Run `npm run db:push` (and optionally `node scripts/seed.mjs`).

**3. Push the code to GitHub**
```bash
git init && git add -A && git commit -m "OLX Guard"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/olx-guard.git
git push -u origin main
```

**4. Deploy on Vercel**
- Go to [vercel.com](https://vercel.com), "Add New Project", import your repo.
- Add these Environment Variables (Settings → Environment Variables):
  - `DATABASE_URL` — your Neon string
  - `AUTH_SECRET` — copy from your `.env`
  - `GROQ_API_KEY` — your Groq key
  - `GROQ_MODEL` — `openai/gpt-oss-20b`
- Click **Deploy**. Vercel runs `prisma generate && next build` automatically.

Your app will be live at `https://your-project.vercel.app`. Done — free.

---

## Important note

OLX Guard gives **guidance, not a guarantee**. Always meet in person, inspect
the item, and pay only after you receive it. No tool can catch every scam.
