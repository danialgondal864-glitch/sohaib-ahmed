import { updateContactMessage } from "@/app/admin/inbox-actions";
import DeleteContactMessageButton from "@/app/admin/DeleteContactMessageButton";

type ContactMessage = {
  id: string;
  is_read: boolean;
  archived_at: string | null;
  status: "new" | "in_progress" | "resolved";
};

const statusLabels = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved"
} as const;

export default function ContactMessageControls({
  message,
  archived
}: {
  message: ContactMessage;
  archived: boolean;
}) {
  return (
    <div className="admin-inbox-controls">
      <form action={updateContactMessage}>
        <input type="hidden" name="id" value={message.id} />
        <input type="hidden" name="operation" value={message.is_read ? "unread" : "read"} />
        <button className="button button-ghost" type="submit">
          Mark {message.is_read ? "unread" : "read"}
        </button>
      </form>
      <form action={updateContactMessage}>
        <input type="hidden" name="id" value={message.id} />
        <input type="hidden" name="operation" value="status" />
        <label>
          Status
          <select name="status" defaultValue={message.status}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
        <button className="button button-ghost" type="submit">Save status</button>
      </form>
      <form action={updateContactMessage}>
        <input type="hidden" name="id" value={message.id} />
        <input type="hidden" name="operation" value={archived ? "unarchive" : "archive"} />
        <button className="button button-ghost" type="submit">
          {archived ? "Restore to inbox" : "Archive"}
        </button>
      </form>
      {archived && <DeleteContactMessageButton id={message.id} />}
    </div>
  );
}
