"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: new URL(
          "/auth/callback?next=%2Fupdate-password",
          window.location.origin
        ).toString()
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage("If an account exists for this address, a password reset email has been sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request a reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap container">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Reset password<span className="accent">.</span></h1>
        <p className="muted">Enter the email address linked to your account.</p>
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
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
        <button className="button button-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <p className="auth-switch"><Link href="/login">Back to log in</Link></p>
      </form>
    </div>
  );
}
