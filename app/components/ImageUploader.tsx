import { useState, useRef } from "react";

interface ImageUploaderProps {
  onInsert: (markdown: string) => void;
}

export function ImageUploader({ onInsert }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as { url?: string; error?: string };

      if (!res.ok || data.error) {
        setError(data.error || "アップロードに失敗しました");
        return;
      }

      if (data.url) {
        const alt = file.name.replace(/\.[^.]+$/, "");
        onInsert(`\n![${alt}](${data.url})\n`);
      }
    } catch {
      setError("アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
        {uploading ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            アップロード中...
          </span>
        ) : (
          "📷 画像を挿入"
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
          onChange={handleUpload}
          disabled={uploading}
          className="sr-only"
        />
      </label>
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
}
