"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth-callback") {
      setError("That email link is invalid or expired. Request a new one and try again.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to log in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap container">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Log in<span className="accent">.</span></h1>
        <p className="muted">Access your portfolio account.</p>
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <p className="auth-switch"><Link href="/forgot-password">Forgot your password?</Link></p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button button-full" disabled={busy}>
          {busy ? "Signing in…" : "Log in"}
        </button>
        <p className="auth-switch">New here? <Link href="/signup">Create an account</Link></p>
      </form>
    </div>
  );
}
