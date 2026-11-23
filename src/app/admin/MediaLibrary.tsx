"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { AUTHOR_MEDIA_BUCKET } from "@/lib/author-media";

const PUBLIC_BUCKET = "portfolio-public-media";
const PRIVATE_BUCKET = "portfolio-private-media";
const CONTRIBUTOR_BUCKET = AUTHOR_MEDIA_BUCKET;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_TYPES: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

type MediaBucket = typeof PUBLIC_BUCKET | typeof PRIVATE_BUCKET | typeof CONTRIBUTOR_BUCKET;

type MediaFile = {
  name: string;
  id: string | null;
  createdAt: string | null;
};

const bucketLabels: Record<MediaBucket, string> = {
  [PUBLIC_BUCKET]: "Public website images",
  [PRIVATE_BUCKET]: "Private admin files",
  [CONTRIBUTOR_BUCKET]: "Contributor uploads"
};

export default function MediaLibrary({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [bucket, setBucket] = useState<MediaBucket>(PUBLIC_BUCKET);
  const [authorFolders, setAuthorFolders] = useState<string[]>([userId]);
  const [authorFolder, setAuthorFolder] = useState(userId);
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
      if (bucket === CONTRIBUTOR_BUCKET) {
        const { data: folderEntries, error: folderError } = await supabase.storage
          .from(bucket)
          .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
        if (folderError) {
          setFiles([]);
          setErrorMessage(`Unable to load contributor folders: ${folderError.message}`);
          return;
        }

        const folders = Array.from(new Set([
          userId,
          ...folderEntries
            .filter((entry) => entry.id === null && UUID_PATTERN.test(entry.name))
            .map((entry) => entry.name)
        ]));
        const selectedFolder = folders.includes(authorFolder) ? authorFolder : folders[0];
        setAuthorFolders(folders);
        setAuthorFolder(selectedFolder);

        const { data, error } = await supabase.storage
          .from(bucket)
          .list(selectedFolder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
        if (error) {
          setFiles([]);
          setErrorMessage(`Unable to load contributor media: ${error.message}`);
        } else {
          setFiles(data
            .filter((file) => file.id !== null)
            .map((file) => ({
              name: `${selectedFolder}/${file.name}`,
              id: file.id,
              createdAt: file.created_at
            })));
        }
        return;
      }

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
  }, [authorFolder, bucket, supabase, userId]);

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
    const filename = `${crypto.randomUUID()}.${extension}`;
    const path = bucket === CONTRIBUTOR_BUCKET ? `${authorFolder}/${filename}` : filename;
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
      if (bucket === CONTRIBUTOR_BUCKET) {
        const { data: references, error: referenceError } = await supabase.from("posts")
          .select("id")
          .eq("cover_image_path", file.name)
          .limit(1);
        if (referenceError) {
          setErrorMessage(`Unable to verify whether this cover is in use: ${referenceError.message}`);
          return;
        }
        if (references && references.length > 0) {
          setErrorMessage("This file is still referenced by a publication. Detach it before deleting the media.");
          return;
        }
      }

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
        .from(bucket)
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
    if (value !== PUBLIC_BUCKET && value !== PRIVATE_BUCKET && value !== CONTRIBUTOR_BUCKET) {
      return;
    }
    setBucket(value);
    if (value === CONTRIBUTOR_BUCKET) {
      setAuthorFolder(userId);
    }
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
            <option value={CONTRIBUTOR_BUCKET}>Contributor uploads</option>
          </select>
        </label>
        {bucket === CONTRIBUTOR_BUCKET && (
          <label>
            Contributor folder
            <select
              value={authorFolder}
              onChange={(event) => setAuthorFolder(event.target.value)}
              disabled={isLoading || isUploading || busyFile !== null}
            >
              {authorFolders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder === userId ? `${folder} (your account)` : folder}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="button button-ghost" type="button" onClick={() => void loadFiles()} disabled={isLoading}>
          Refresh
        </button>
      </div>
      <p className="fine-print">
        {bucket === CONTRIBUTOR_BUCKET
          ? "Contributor uploads are private. Authors and administrators can access them; files referenced by any publication cannot be deleted."
          : "Public images can be opened by anyone with their URL. Private files are restricted to administrators; temporary download links expire after one minute."}
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
          <p className="fine-print">
            Showing up to 100 newest images{bucket === CONTRIBUTOR_BUCKET ? ` in contributor folder ${authorFolder}` : ""}.
          </p>
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
