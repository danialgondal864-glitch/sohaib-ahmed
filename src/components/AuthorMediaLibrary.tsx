"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteAuthorMedia } from "@/app/author/actions";
import { createClient } from "@/lib/supabase/client";
import { AUTHOR_MEDIA_BUCKET } from "@/lib/author-media";

type AuthorMediaFile = {
  name: string;
  createdAt: string | null;
};

export default function AuthorMediaLibrary({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [files, setFiles] = useState<AuthorMediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.storage
        .from(AUTHOR_MEDIA_BUCKET)
        .list(userId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) {
        setFiles([]);
        setErrorMessage(`Unable to load your uploaded media: ${error.message}`);
        return;
      }

      setFiles(data
        .filter((file) => file.id !== null)
        .map((file) => ({
          name: `${userId}/${file.name}`,
          createdAt: file.created_at
        })));
    } catch (error) {
      setFiles([]);
      setErrorMessage(
        error instanceof Error
          ? `Unable to load your uploaded media: ${error.message}`
          : "Unable to load your uploaded media because of an unexpected error."
      );
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  return (
    <section className="section-inner" id="media">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR ASSETS</p>
          <h2>Uploaded media</h2>
        </div>
        <button className="button button-ghost" type="button" onClick={() => void loadFiles()} disabled={isLoading}>
          Refresh
        </button>
      </div>
      <p className="muted">
        You can delete your own cover images only when no publication uses them. Files attached to content are protected.
      </p>
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
      {isLoading ? (
        <p className="muted" role="status">Loading uploaded media...</p>
      ) : files.length > 0 ? (
        <ul className="admin-media-list">
          {files.map((file) => (
            <li className="admin-media-item" key={file.name}>
              <div>
                <strong>{file.name.split("/").pop()}</strong>
                {file.createdAt && (
                  <time className="fine-print" dateTime={file.createdAt}>
                    Uploaded {new Date(file.createdAt).toLocaleDateString()}
                  </time>
                )}
              </div>
              <form
                action={deleteAuthorMedia}
                onSubmit={(event) => {
                  if (!window.confirm(`Permanently delete ${file.name}?`)) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="path" value={file.name} />
                <button className="button button-ghost" type="submit">
                  Delete unused file
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-research">
          <h3>No uploaded media yet.</h3>
          <p>Cover images you upload while creating publications will appear here.</p>
        </div>
      )}
      {!isLoading && files.length === 100 && (
        <p className="fine-print">Showing the 100 newest files in your media folder.</p>
      )}
    </section>
  );
}
