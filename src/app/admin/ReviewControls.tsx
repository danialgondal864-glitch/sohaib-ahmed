import { reviewContent } from "@/app/admin/review-actions";
import SchedulePublicationForm from "@/app/admin/SchedulePublicationForm";

type ReviewControlsProps = {
  id: string;
  status: string;
};

export default function ReviewControls({ id, status }: ReviewControlsProps) {
  return (
    <div className="review-controls">
      {status === "pending_review" && (
        <>
          <form action={reviewContent}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="approve" />
            <button className="button" type="submit">Approve</button>
          </form>
          <form action={reviewContent}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="request_changes" />
            <label>
              Feedback for author
              <textarea name="feedback" rows={3} maxLength={4000} required />
            </label>
            <button className="button button-ghost" type="submit">Request changes</button>
          </form>
          <form action={reviewContent}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="reject" />
            <label>
              Feedback for author
              <textarea name="feedback" rows={3} maxLength={4000} required />
            </label>
            <button className="button button-ghost" type="submit">Decline submission</button>
          </form>
        </>
      )}
      {(status === "draft" || status === "approved") && (
        <>
          <form action={reviewContent}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value="publish" />
            <button className="button" type="submit">Publish now</button>
          </form>
          <SchedulePublicationForm id={id} />
        </>
      )}
      {status === "published" && (
        <form action={reviewContent}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value="unpublish" />
          <button className="button button-ghost" type="submit">Unpublish</button>
        </form>
      )}
      {status === "archived" && (
        <form action={reviewContent}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value="restore" />
          <button className="button button-ghost" type="submit">Restore to draft</button>
        </form>
      )}
      {status !== "archived" && (
        <form action={reviewContent}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value="archive" />
          <button className="button button-ghost" type="submit">Archive</button>
        </form>
      )}
    </div>
  );
}
