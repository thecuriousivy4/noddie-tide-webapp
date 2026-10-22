"use client";

// Shown on every signed-in screen while the identity provider is simulated. It is not
// dismissible: a visitor should never be in doubt about which of these mechanisms is the
// live Tide network and which is a local stand-in.

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function SimulationBanner() {
  return (
    <div className="sim-banner" role="status">
      <div className="svc-row sim-banner-inner">
        <AlertTriangle size={15} strokeWidth={2} />
        <p>
          <strong>Simulated identity — not the live Tide network.</strong> Sign-in, tokens and
          key custody run locally: RS256 tokens from a local keypair, verified against a local
          JWKS, and ciphertext prefixed <code>dev1:</code> rather than TideCloak&rsquo;s{" "}
          <code>ms1:</code>. The governance rules are real — a permit still needs two
          custodians.{" "}
          <Link href="/transparency">See exactly what is real</Link>.
        </p>
      </div>
    </div>
  );
}
