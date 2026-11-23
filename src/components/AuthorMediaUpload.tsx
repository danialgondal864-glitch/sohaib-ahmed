"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { AUTHOR_MEDIA_BUCKET } from "@/lib/author-media";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export default function AuthorMediaUpload({
  userId,
  initialPath
}: {
  userId: string;
  initialPath?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [path, setPath] = useState(initialPath ?? "");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!initialPath) {
      return;
    }

    const pathToPreview = initialPath;
    let active = true;
    async function loadPreview() {
      try {
        const { data, error } = await supabase.storage
          .from(AUTHOR_MEDIA_BUCKET)
          .createSignedUrl(pathToPreview, 60);
        if (!active) {
          return;
        }
        if (error) {
          setErrorMessage(`Unable to preview the attached cover image: ${error.message}`);
          return;
        }
        setPreviewUrl(data.signedUrl);
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? `Unable to preview the attached cover image: ${error.message}`
              : "Unable to preview the attached cover image."
          );
        }
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [initialPath, supabase]);

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setErrorMessage("");
    setStatusMessage("");

    if (!file) {
      return;
    }

    const extension = FILE_TYPES[file.type];
    if (!extension) {
      setErrorMessage("Choose a JPEG, PNG, WebP, GIF, or AVIF image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("Cover images must be 5 MB or smaller.");
      return;
    }

    setIsUploading(true);
    const objectPath = `${userId}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error } = await supabase.storage.from(AUTHOR_MEDIA_BUCKET).upload(objectPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });
      if (error) {
        setErrorMessage(`Unable to upload cover image: ${error.message}`);
        return;
      }

      setPath(objectPath);
      setStatusMessage(`Uploaded ${file.name}.`);
      const { data, error: signingError } = await supabase.storage
        .from(AUTHOR_MEDIA_BUCKET)
        .createSignedUrl(objectPath, 60);
      if (signingError) {
        setPreviewUrl("");
        setErrorMessage(`The image uploaded, but its preview could not be created: ${signingError.message}`);
        return;
      }
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `Unable to upload cover image: ${error.message}`
          : "Unable to upload cover image because of an unexpected error."
      );
    } finally {
      setIsUploading(false);
    }
  }

  function detachUpload() {
    setPath("");
    setPreviewUrl("");
    setErrorMessage("");
    setStatusMessage("Uploaded cover image detached from this form. The stored file was not deleted.");
  }

  return (
    <div className="author-media-upload">
      <input type="hidden" name="cover_image_path" value={path} />
      <input type="hidden" name="cover_image_uploading" value={isUploading ? "true" : "false"} />
      <label>
        Upload a private cover image (JPEG, PNG, WebP, GIF, or AVIF; maximum 5 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          onChange={uploadFile}
          disabled={isUploading}
        />
      </label>
      {previewUrl && (
        <Image
          className="author-media-preview"
          src={previewUrl}
          alt="Uploaded cover preview"
          width={720}
          height={440}
          loading="lazy"
          unoptimized
        />
      )}
      {path && (
        <p className="fine-print" role="status">
          A private uploaded image is attached. It becomes readable to visitors only while its publication is public.
        </p>
      )}
      {path && (
        <button className="button button-ghost" type="button" onClick={detachUpload} disabled={isUploading}>
          Detach uploaded cover
        </button>
      )}
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}
      {statusMessage && <p className="success" role="status">{statusMessage}</p>}
      {isUploading && <p className="muted" role="status">Uploading cover image...</p>}
    </div>
  );
}
