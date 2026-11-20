"use client";

import { updateContactMessage } from "@/app/admin/inbox-actions";

export default function DeleteContactMessageButton({ id }: { id: string }) {
  return (
    <form
      action={updateContactMessage}
      onSubmit={(event) => {
        if (!window.confirm("Permanently delete this archived contact message?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value="delete" />
      <button className="button button-ghost" type="submit">Delete permanently</button>
    </form>
  );
}
