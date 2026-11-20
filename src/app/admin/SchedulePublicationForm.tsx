"use client";

import { useEffect, useState } from "react";
import { reviewContent } from "@/app/admin/review-actions";

export default function SchedulePublicationForm({ id }: { id: string }) {
  const [offset, setOffset] = useState("0");

  useEffect(() => {
    setOffset(String(new Date().getTimezoneOffset()));
  }, []);

  return (
    <form action={reviewContent} className="review-schedule-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value="schedule" />
      <input type="hidden" name="timezone_offset_minutes" value={offset} />
      <label>
        Schedule publication (your local time)
        <input
          name="scheduled_at"
          type="datetime-local"
          required
          onChange={(event) => {
            const date = new Date(event.target.value);
            if (!Number.isNaN(date.getTime())) {
              setOffset(String(date.getTimezoneOffset()));
            }
          }}
        />
      </label>
      <p className="fine-print">
        This project uses a daily Hobby schedule. Publication may occur on the next daily run, up to about 24 hours later.
      </p>
      <button className="button button-ghost" type="submit">Schedule</button>
    </form>
  );
}
