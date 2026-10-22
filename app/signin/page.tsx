"use client";

// Sign in.
//
// Under the simulated provider this is a real credential form: username + password, posted
// to /api/auth/signin, checked against a scrypt hash, answered with a signed token that
// every protected route verifies. There is no account list to click.
//
// TIDECLOAK: under IDENTITY=tidecloak this page does not collect credentials at all. It
// shows one button that calls `useTideCloak().login()`, which redirects to the realm; the
// person authenticates through their own Tide enclave and returns to /auth/redirect.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, LogIn } from "lucide-react";
import { useIdentity } from "@/lib/identity/client";
import { Mark } from "@/components/Mark";
import { Field } from "@/components/Field";
import { Callout } from "@/components/TaskFlow";

interface Account {
  username: string;
  name: string;
  blurb: string;
  roles: string[];
}

export default function SignInPage() {
  const { ready, authenticated, simulated, mode, signIn, login } = useIdentity();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (ready && authenticated) router.replace("/home");
  }, [ready, authenticated, router]);

  // The demo roster, so a judge can see which account does what. Usernames only — the
  // passwords are in the README, and the form still has to be filled in.
  useEffect(() => {
    fetch("/api/identity/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body?.accounts && setAccounts(body.accounts))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim().toLowerCase(), password);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <header className="signin-head">
        <div className="signin-head-inner">
          <Link href="/" className="svc-lockup">
            <Mark size={34} />
            <span>
              <span className="svc-lockup-name">Noddie</span>
              <span className="svc-lockup-sub">
                Heritage register &middot; each place held by its own Traditional Owner corporation
              </span>
            </span>
          </Link>
        </div>
      </header>

      <div className="signin-body">
        <h1>Sign in</h1>

        {mode === "tidecloak" ? (
          <div className="stack" style={{ marginTop: 20, maxWidth: 560 }}>
            <p className="svc-lede">
              This register uses TideCloak. You will be taken to the realm to authenticate with
              your own Tide account — there is no password for this service to hold.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ alignSelf: "flex-start" }}
              onClick={() => login()}
            >
              <LogIn size={16} strokeWidth={1.9} /> Continue to TideCloak
            </button>
          </div>
        ) : (
          <>
            <p className="svc-lede" style={{ maxWidth: 560 }}>
              Enter the username and password for your account. Your roles decide which
              corporations&rsquo; places you can act on.
            </p>

            <form className="signin-form" onSubmit={submit} noValidate>
              {error && (
                <div className="callout danger" role="alert">
                  <h2>There is a problem</h2>
                  <p>{error}</p>
                </div>
              )}

              <Field label="Username" htmlFor="username">
                <input
                  id="username"
                  name="username"
                  className="input"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </Field>

              <Field label="Password" htmlFor="password">
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>

              <div>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={busy || !username.trim() || !password}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </div>
            </form>

            {simulated && (
              <div style={{ marginTop: 36 }}>
                <Callout variant="warn" heading="Simulated identity — not the live Tide network">
                  <p>
                    Credentials are checked against a scrypt hash in this register&rsquo;s own
                    database, and the token you receive is signed by a local key rather than by
                    the Tide network. Verification, role checks and the quorum rules are the real
                    ones; the key custody is not.
                  </p>
                  <p>
                    Under TideCloak there would be no password to type: each person authenticates
                    through their own Tide enclave, and this service would never see a credential.
                  </p>
                </Callout>

                {accounts.length > 0 && (
                  <div className="stack-sm" style={{ marginTop: 24 }}>
                    <h2>Accounts in this scenario</h2>
                    <p className="small muted">
                      Passwords are listed in the README (<code>noddie-&lt;username&gt;</code>).
                      Select a row to fill the username — you still have to enter the password.
                    </p>
                    <div className="table-wrap">
                      <table className="cred-table">
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Person</th>
                            <th>Roles in their token</th>
                            <th>What they can do</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((a) => (
                            <tr key={a.username}>
                              <td>
                                <button type="button" onClick={() => setUsername(a.username)}>
                                  {a.username}
                                </button>
                              </td>
                              <td>{a.name}</td>
                              <td className="mono tiny">{a.roles.join(", ") || "—"}</td>
                              <td className="muted">{a.blurb}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p className="small muted" style={{ marginTop: 32 }}>
          <AlertTriangle size={13} strokeWidth={1.8} style={{ verticalAlign: "-2px" }} /> All
          accounts, places and records in this register are synthetic.{" "}
          <Link href="/">Back to the public page</Link>
        </p>
      </div>
    </div>
  );
}
