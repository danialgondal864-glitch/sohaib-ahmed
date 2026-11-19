"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const signupEmail = email.trim();

    try {
      const { data, error: signUpError } = await createClient().auth.signUp({
        email: signupEmail,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: new URL("/auth/callback", window.location.origin).toString()
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setMessage("Account created. Check your inbox for a link to verify your email.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    const resendEmail = email.trim();
    if (!resendEmail) {
      setError("Enter your email address to request a new confirmation email.");
      return;
    }

    setResending(true);
    setError("");
    setMessage("");

    try {
      const { error: resendError } = await createClient().auth.resend({
        type: "signup",
        email: resendEmail,
        options: {
          emailRedirectTo: new URL("/auth/callback", window.location.origin).toString()
        }
      });

      if (resendError) {
        setError(resendError.message);
        return;
      }

      setMessage("If this address still needs verification, a new confirmation email has been sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to resend the confirmation email. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-wrap container">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">JOIN THE COMMUNITY</p>
        <h1>Create account<span className="accent">.</span></h1>
        <p className="muted">Sign up to save articles and access your account.</p>
        <label>
          Full name
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setMessage("");
              setError("");
            }}
            required
          />
        </label>
        <label>
          Password
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
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}
        <button className="button button-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="auth-switch">Already signed up? Request another confirmation link.</p>
        <button
          className="button button-full"
          type="button"
          onClick={resendConfirmation}
          disabled={busy || resending || !email.trim()}
        >
          {resending ? "Sending…" : "Resend confirmation email"}
        </button>
        <p className="auth-switch">Already registered? <Link href="/login">Log in</Link></p>
      </form>
    </div>
  );
}
