"use client";

// Where TideCloak returns a browser after a successful (or refused) sign-in.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIdentity } from "@/lib/identity/client";

export default function AuthRedirect() {
  const { ready, authenticated } = useIdentity();
  const router = useRouter();

  useEffect(() => {
    if (ready) router.replace(authenticated ? "/home" : "/?signin=failed");
  }, [ready, authenticated, router]);

  return <div className="loading-screen">Completing sign-in…</div>;
}
