import { reportContent } from "@/app/blogs/report-actions";

export default function ReportContentForm({ postId }: { postId: string }) {
  return (
    <form action={reportContent} className="content-report-form">
      <input type="hidden" name="post_id" value={postId} />
      <label>
        Report reason
        <select name="reason" required defaultValue="misinformation">
          <option value="misinformation">Potentially misleading information</option>
          <option value="spam">Spam or promotional abuse</option>
          <option value="copyright">Copyright concern</option>
          <option value="abuse">Harassment or harmful content</option>
          <option value="other">Other concern</option>
        </select>
      </label>
      <label>
        Details (optional)
        <textarea name="details" maxLength={2000} rows={3} />
      </label>
      <button className="button button-ghost" type="submit">Send report</button>
    </form>
  );
}
