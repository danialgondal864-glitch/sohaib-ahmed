"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_BUCKET = "portfolio-public-media";
const PRIVATE_BUCKET = "portfolio-private-media";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

type MediaBucket = typeof PUBLIC_BUCKET | typeof PRIVATE_BUCKET;

type MediaFile = {
  name: string;
  id: string | null;
  createdAt: string | null;
};

const bucketLabels: Record<MediaBucket, string> = {
  [PUBLIC_BUCKET]: "Public website images",
  [PRIVATE_BUCKET]: "Private admin files"
};

export default function MediaLibrary() {
  const supabase = useMemo(() => createClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [bucket, setBucket] = useState<MediaBucket>(PUBLIC_BUCKET);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [privateLinks, setPrivateLinks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) {
        setFiles([]);
        setErrorMessage(`Unable to load ${bucketLabels[bucket].toLowerCase()}: ${error.message}`);
      } else {
        setFiles(data.map((file) => ({
          name: file.name,
          id: file.id,
          createdAt: file.created_at
        })));
      }
    } catch (error) {
      setFiles([]);
      setErrorMessage(
        error instanceof Error
          ? `Unable to load media: ${error.message}`
          : "Unable to load media because of an unexpected error."
      );
    } finally {
      setIsLoading(false);
    }
  }, [bucket, supabase]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrorMessage("");
    setStatusMessage("");
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setErrorMessage("Choose an image to upload.");
      return;
    }
    const extension = FILE_TYPES[file.type];
    if (!extension) {
      setErrorMessage("Choose a JPEG, PNG, WebP, GIF, or AVIF image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("Images must be 5 MB or smaller.");
      return;
    }

    setIsUploading(true);
    const path = `${crypto.randomUUID()}.${extension}`;
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });
      if (error) {
        setErrorMessage(`Unable to upload image: ${error.message}`);
        return;
      }
      form.reset();
      setStatusMessage(`Uploaded ${file.name}.`);
      await loadFiles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Unable to upload image: ${error.message}`
          : "Unable to upload image because of an unexpected error."
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteFile(file: MediaFile) {
    if (!window.confirm(`Permanently delete ${file.name}?`)) {
      return;
    }
    setBusyFile(file.name);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const { error } = await supabase.storage.from(bucket).remove([file.name]);
      if (error) {
        setErrorMessage(`Unable to delete image: ${error.message}`);
        return;
      }
      setPrivateLinks((current) => {
        const next = { ...current };
        delete next[file.name];
        return next;
      });
      setStatusMessage(`Deleted ${file.name}.`);
      await loadFiles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Unable to delete image: ${error.message}`
          : "Unable to delete image because of an unexpected error."
      );
    } finally {
      setBusyFile(null);
    }
  }

  async function createPrivateLink(file: MediaFile) {
    setBusyFile(file.name);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.storage
        .from(PRIVATE_BUCKET)
        .createSignedUrl(file.name, 60);
      if (error) {
        setErrorMessage(`Unable to create a private download link: ${error.message}`);
        return;
      }
      setPrivateLinks((current) => ({ ...current, [file.name]: data.signedUrl }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Unable to create a private download link: ${error.message}`
          : "Unable to create a private download link because of an unexpected error."
      );
    } finally {
      setBusyFile(null);
    }
  }

  function changeBucket(value: string) {
    if (value !== PUBLIC_BUCKET && value !== PRIVATE_BUCKET) {
      return;
    }
    setBucket(value);
    setFiles([]);
    setPrivateLinks({});
    setStatusMessage("");
  }

  return (
    <div className="panel">
      <div className="admin-media-toolbar">
        <label>
          Media location
          <select
            value={bucket}
            onChange={(event) => changeBucket(event.target.value)}
            disabled={isLoading || isUploading || busyFile !== null}
          >
            <option value={PUBLIC_BUCKET}>Public website images</option>
            <option value={PRIVATE_BUCKET}>Private admin files</option>
          </select>
        </label>
        <button className="button button-ghost" type="button" onClick={() => void loadFiles()} disabled={isLoading}>
          Refresh
        </button>
      </div>
      <p className="fine-print">
        Public images can be opened by anyone with their URL. Private files are restricted to administrators;
        temporary download links expire after one minute.
      </p>
      <form className="admin-media-upload" onSubmit={uploadFile}>
        <label>
          Image (JPEG, PNG, WebP, GIF, or AVIF; maximum 5 MB)
          <input
            ref={fileInput}
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            required
            disabled={isUploading}
          />
        </label>
        <button className="button" type="submit" disabled={isUploading}>
          {isUploading ? "Uploading..." : "Upload image"}
        </button>
      </form>
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
      {statusMessage && <p className="success" role="status">{statusMessage}</p>}
      {isLoading ? (
        <p className="muted" role="status">Loading media...</p>
      ) : files.length > 0 ? (
        <>
          <ul className="admin-media-list">
            {files.map((file) => {
              const publicUrl = bucket === PUBLIC_BUCKET
                ? supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(file.name).data.publicUrl
                : null;
              const privateUrl = privateLinks[file.name];
              return (
                <li className="admin-media-item" key={file.id ?? file.name}>
                  <div>
                    <strong>{file.name}</strong>
                    {file.createdAt && (
                      <time className="fine-print" dateTime={file.createdAt}>
                        Uploaded {new Date(file.createdAt).toLocaleDateString()}
                      </time>
                    )}
                  </div>
                  <div className="admin-media-actions">
                    {publicUrl ? (
                      <a className="button button-ghost" href={publicUrl} target="_blank" rel="noreferrer">
                        Open public image
                      </a>
                    ) : privateUrl ? (
                      <a className="button button-ghost" href={privateUrl} target="_blank" rel="noreferrer">
                        Open private image
                      </a>
                    ) : (
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => void createPrivateLink(file)}
                        disabled={busyFile === file.name}
                      >
                        Create temporary link
                      </button>
                    )}
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => void deleteFile(file)}
                      disabled={busyFile === file.name}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="fine-print">Showing up to 100 newest images in {bucketLabels[bucket].toLowerCase()}.</p>
        </>
      ) : (
        <div className="empty-research">
          <h3>No images in this location yet.</h3>
          <p>Upload an image above to add it to the selected media library.</p>
        </div>
      )}
    </div>
  );
}
