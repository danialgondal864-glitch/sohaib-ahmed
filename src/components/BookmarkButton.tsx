"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BookmarkButtonProps = {
  postId: string;
  userId: string;
};

const migrationMessage = "Publication bookmarks are not available yet. Please try again later.";

export default function BookmarkButton({ postId, userId }: BookmarkButtonProps) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBookmark() {
      try {
        const { data, error: queryError } = await createClient()
          .from("bookmarks")
          .select("post_id")
          .eq("user_id", userId)
          .eq("post_id", postId)
          .maybeSingle();

        if (!active) {
          return;
        }

        if (queryError) {
          setError(
            queryError.code === "PGRST205" || queryError.code === "42P01"
              ? migrationMessage
              : "Unable to check this bookmark. Please refresh and try again."
          );
        } else {
          setSaved(Boolean(data));
        }
      } catch {
        if (active) {
          setError(migrationMessage);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBookmark();
    return () => {
      active = false;
    };
  }, [postId, userId]);

  async function toggleBookmark() {
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const result = saved
        ? await supabase
            .from("bookmarks")
            .delete()
            .eq("user_id", userId)
            .eq("post_id", postId)
        : await supabase
            .from("bookmarks")
            .insert({ user_id: userId, post_id: postId });

      if (result.error) {
        setError("Unable to update this bookmark. Please try again.");
        return;
      }

      setSaved(!saved);
    } catch {
      setError("Unable to update this bookmark. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <p className="fine-print" role="status">{error}</p>;
  }

  if (loading) {
    return <button className="button button-ghost" type="button" disabled>Checking saved status…</button>;
  }

  return (
    <div className="bookmark-action">
      <button
        className="button button-ghost"
        type="button"
        onClick={toggleBookmark}
        disabled={busy}
        aria-pressed={saved}
      >
        {busy ? "Saving…" : saved ? "Remove bookmark" : "Save publication"}
      </button>
      <Link className="text-link" href="/dashboard#saved-articles">View saved publications</Link>
    </div>
  );
}
