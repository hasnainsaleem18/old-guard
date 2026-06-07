import Link from "next/link";
import { auth } from "@/auth";
import SignOutButton from "@/components/SignOutButton";

export default async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-10 border-b border-emerald-100 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-lg font-bold text-white">
            🛡
          </span>
          <span className="text-lg font-bold tracking-tight text-emerald-900">
            OLX Guard
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-emerald-800 hover:underline"
              >
                Dashboard
              </Link>
              <span className="hidden text-sm text-gray-500 sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-emerald-800 hover:underline"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
