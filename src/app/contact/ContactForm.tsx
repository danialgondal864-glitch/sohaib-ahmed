"use client";

import { useState, type FormEvent } from "react";

type ContactFormProps = {
  contactEmail: string;
};

export default function ContactForm({ contactEmail }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message })
      });
      const result: { message?: unknown } = await response.json();

      if (!response.ok) {
        setError(
          typeof result.message === "string"
            ? result.message
            : "Your message could not be sent. Please email directly."
        );
        return;
      }

      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setSuccess(true);
    } catch {
      setError("Your message could not be sent. Please email directly.");
    } finally {
      setBusy(false);
    }
  }

  const emailSubject = subject || `Portfolio message from ${name || "website visitor"}`;
  const emailBody = `Name: ${name}\nEmail: ${email}\n\n${message}`;
  const mailto = `mailto:${contactEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  return (
    <form className="panel contact-form" onSubmit={submit}>
      <p className="eyebrow">SEND A MESSAGE</p>
      <label>
        Your name
        <input
          name="name"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="Name"
        />
      </label>
      <label>
        Email address
        <input
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="you@example.com"
        />
      </label>
      <label>
        Subject
        <input
          name="subject"
          maxLength={160}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
          placeholder="How can I help?"
        />
      </label>
      <label>
        Message
        <textarea
          name="message"
          rows={5}
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          placeholder="Tell me a little about it..."
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {success && <p className="success" role="status">Thanks, your message has been sent.</p>}
      <button className="button" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
      <p className="fine-print">
        Prefer email? <a href={mailto}>Send your message using your email app.</a>
      </p>
    </form>
  );
}
