"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
    >
      Sign out
    </button>
  );
}
