import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 20 * 1024;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status });
}

function readField(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return errorResponse(415, "unsupported_media_type", "Send the form using the website.");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorResponse(413, "payload_too_large", "The message is too long.");
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return errorResponse(413, "payload_too_large", "The message is too long.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, "invalid_json", "The submitted form is invalid.");
  }

  if (!isRecord(payload)) {
    return errorResponse(400, "invalid_input", "Complete all fields and try again.");
  }

  const name = readField(payload.name, 100);
  const email = readField(payload.email, 254);
  const subject = readField(payload.subject, 160);
  const message = readField(payload.message, 5000);

  if (
    !name ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !subject ||
    !message
  ) {
    return errorResponse(400, "invalid_input", "Check the form fields and try again.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(
      503,
      "contact_not_configured",
      "Website message storage is not configured yet. Please email directly."
    );
  }

  let clientIp = request.headers.get("x-forwarded-for")?.trim();
  if (!clientIp && process.env.NODE_ENV !== "production") {
    clientIp = "127.0.0.1";
  }
  if (!clientIp) {
    return errorResponse(
      503,
      "client_ip_unavailable",
      "Website message storage is temporarily unavailable. Please email directly."
    );
  }

  const sourceHash = createHmac("sha256", serviceRoleKey).update(clientIp).digest("hex");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  try {
    const { error } = await supabase.rpc("submit_contact_message", {
      p_name: name,
      p_email: email,
      p_subject: subject,
      p_message: message,
      p_source_hash: sourceHash
    });

    if (error?.message.includes("contact_rate_limited")) {
      return errorResponse(
        429,
        "rate_limited",
        "Please wait before sending another message from this connection."
      );
    }

    if (error) {
      console.error("Contact message submission failed.", error.code);
      return errorResponse(500, "submission_failed", "Your message could not be sent. Please email directly.");
    }
  } catch {
    console.error("Contact message service is unavailable.");
    return errorResponse(503, "service_unavailable", "Your message could not be sent. Please email directly.");
  }

  return NextResponse.json({ ok: true });
}
