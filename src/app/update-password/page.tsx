"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage("Your password has been updated.");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap container">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Choose a password<span className="accent">.</span></h1>
        <p className="muted">Set a new password for your account.</p>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <small>Use at least 8 characters.</small>
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
        <button className="button button-full" disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </button>
        <p className="auth-switch"><Link href="/login">Back to log in</Link></p>
      </form>
    </div>
  );
}
