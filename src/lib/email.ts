import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type EmailStatus = "sent" | "not_configured" | "failed";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function publicLink(path: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return path;
  }
  try {
    const url = new URL(siteUrl);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return new URL(path, url).toString();
    }
  } catch {
    console.error("Email notification links are using relative paths because NEXT_PUBLIC_SITE_URL is invalid.");
  }
  return path;
}

async function sendEmail(message: EmailMessage): Promise<EmailStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return "not_configured";
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text
      })
    });
    if (!response.ok) {
      console.error("Email provider rejected a notification.", response.status);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error(
      "Email notification request failed.",
      error instanceof Error ? error.message : "unknown_error"
    );
    return "failed";
  }
}

async function sendToRecipients(recipients: string[], subject: string, text: string): Promise<EmailStatus> {
  if (!isConfigured()) {
    return "not_configured";
  }
  if (recipients.length === 0) {
    console.error("Email notification has no recipients.");
    return "failed";
  }

  const statuses = await Promise.all(
    Array.from(new Set(recipients)).map((to) => sendEmail({ to, subject, text }))
  );
  if (statuses.every((status) => status === "sent")) {
    return "sent";
  }
  if (statuses.every((status) => status === "not_configured")) {
    return "not_configured";
  }
  return "failed";
}

async function getAdministratorEmails(): Promise<string[] | null> {
  try {
    const adminClient = createAdminClient();
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    if (profilesError) {
      console.error("Unable to load administrator notification recipients.", profilesError.code);
      return null;
    }

    const users = await Promise.all(
      (profiles ?? []).map(({ id }) => adminClient.auth.admin.getUserById(id))
    );
    if (users.some(({ error }) => error)) {
      console.error("Unable to resolve one or more administrator notification addresses.");
      return null;
    }
    return users
      .map(({ data }) => data.user?.email ?? null)
      .filter((email): email is string => typeof email === "string" && email.includes("@"));
  } catch (error) {
    console.error(
      "Unable to initialize administrator email notifications.",
      error instanceof Error ? error.message : "unknown_error"
    );
    return null;
  }
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error) {
      console.error("Unable to resolve author notification address.", error.code);
      return null;
    }
    return data.user.email ?? null;
  } catch (error) {
    console.error(
      "Unable to initialize author email notifications.",
      error instanceof Error ? error.message : "unknown_error"
    );
    return null;
  }
}

export async function notifyAdministratorsOfSubmission({
  title,
  contentType
}: {
  title: string;
  contentType: string;
}): Promise<EmailStatus> {
  if (!isConfigured()) {
    return "not_configured";
  }
  const recipients = await getAdministratorEmails();
  if (!recipients) {
    return "failed";
  }
  const reviewLink = publicLink("/admin#review-queue");
  return sendToRecipients(
    recipients,
    "Publication submitted for review",
    `A ${contentType} publication was submitted for administrator review.\n\nTitle: ${title}\nReview: ${reviewLink}\n`
  );
}

export async function notifyAuthorOfReview({
  authorId,
  title,
  slug,
  action,
  feedback
}: {
  authorId: string;
  title: string;
  slug: string;
  action: string;
  feedback: string | null;
}): Promise<EmailStatus> {
  if (!isConfigured()) {
    return "not_configured";
  }
  const email = await getUserEmail(authorId);
  if (!email) {
    return "failed";
  }
  const statusText = action.replace(/_/g, " ");
  const publicationLink = publicLink(action === "publish" ? `/blogs/${slug}` : "/author#submissions");
  const feedbackText = feedback ? `\n\nAdministrator feedback:\n${feedback}` : "";
  return sendToRecipients(
    [email],
    `Publication update: ${statusText}`,
    `There is an update to your publication "${title}".\n\nStatus: ${statusText}\nPublication: ${publicationLink}${feedbackText}\n`
  );
}

export async function notifyAuthorOfScheduledPublication({
  authorId,
  title,
  slug
}: {
  authorId: string;
  title: string;
  slug: string;
}): Promise<EmailStatus> {
  if (!isConfigured()) {
    return "not_configured";
  }
  const email = await getUserEmail(authorId);
  if (!email) {
    return "failed";
  }
  return sendToRecipients(
    [email],
    "Your scheduled publication is live",
    `Your scheduled publication "${title}" is now live.\n\nRead it here: ${publicLink(`/blogs/${slug}`)}\n`
  );
}
