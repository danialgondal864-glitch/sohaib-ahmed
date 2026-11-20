import { updateContentReport } from "@/app/admin/report-actions";

type ReportControlsProps = {
  id: string;
  status: string;
  adminNotes: string | null;
};

export default function ReportControls({ id, status, adminNotes }: ReportControlsProps) {
  return (
    <form action={updateContentReport} className="content-report-controls">
      <input type="hidden" name="id" value={id} />
      <label>
        Report status
        <select name="status" defaultValue={status}>
          <option value="new">New</option>
          <option value="in_review">In review</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </label>
      <label>
        Administrator notes
        <textarea name="admin_notes" defaultValue={adminNotes ?? ""} maxLength={2000} rows={3} />
      </label>
      <button className="button button-ghost" type="submit">Save report status</button>
    </form>
  );
}
