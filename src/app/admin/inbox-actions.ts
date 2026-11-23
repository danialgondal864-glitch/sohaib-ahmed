"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_STATUSES = ["new", "in_progress", "resolved"] as const;
type MessageStatus = (typeof MESSAGE_STATUSES)[number];
type MessageOperation = "read" | "unread" | "archive" | "unarchive" | "status" | "delete";

function isMessageStatus(value: string | null): value is MessageStatus {
  return MESSAGE_STATUSES.some((status) => status === value);
}

function isMessageOperation(value: string | null): value is MessageOperation {
  return value === "read" ||
    value === "unread" ||
    value === "archive" ||
    value === "unarchive" ||
    value === "status" ||
    value === "delete";
}

function getText(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

function invalidMessage(): never {
  redirect("/admin?status=message-invalid#contact-inbox");
}

function messageUpdateFailed(): never {
  redirect("/admin?status=message-failed#contact-inbox");
}

export async function updateContactMessage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = getText(formData, "id", 36);
  const operation = getText(formData, "operation", 16);
  if (
    !id ||
    !UUID_PATTERN.test(id) ||
    !isMessageOperation(operation)
  ) {
    invalidMessage();
  }

  if (operation === "delete") {
    const { data, error } = await supabase
      .from("contact_messages")
      .delete()
      .eq("id", id)
      .not("archived_at", "is", null)
      .select("id")
      .single();
    if (error || !data) {
      console.error("Unable to delete contact message.", error?.code ?? "not_found");
      messageUpdateFailed();
    }
  } else {
    const changes: {
      is_read?: boolean;
      archived_at?: string | null;
      status?: MessageStatus;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    switch (operation) {
      case "read":
        changes.is_read = true;
        break;
      case "unread":
        changes.is_read = false;
        break;
      case "archive":
        changes.archived_at = new Date().toISOString();
        break;
      case "unarchive":
        changes.archived_at = null;
        break;
      case "status": {
        const status = getText(formData, "status", 16);
        if (!isMessageStatus(status)) {
          invalidMessage();
        }
        changes.status = status;
        break;
      }
    }

    const { data, error } = await supabase
      .from("contact_messages")
      .update(changes)
      .eq("id", id)
      .select("id")
      .single();
    if (error || !data) {
      console.error("Unable to update contact message.", error?.code ?? "not_found");
      messageUpdateFailed();
    }
  }

  revalidatePath("/admin");
  redirect("/admin?status=message-updated#contact-inbox");
}
