import { useState } from "react";

/**
 * Optional speaker-notes file input (Markdown / JSON) for the slide upload and
 * edit forms. The form must use encType="multipart/form-data". Field name: notesFile.
 */
export function SpeakerNotesFileField({
  mode,
  existingCount = 0,
}: {
  mode: "new" | "edit";
  existingCount?: number;
}) {
  const [name, setName] = useState("");
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">スピーカーノート（任意）</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        Markdown（<code className="font-mono">.md</code>）または JSON（<code className="font-mono">.json</code>）。
        Markdown は「<code className="font-mono">## 1. 見出し</code>」から次の「<code className="font-mono">## 2.</code>」までがスライド 1 のノートです。
        ノートは発表者のスピーカービューにだけ表示され、公開スライドには含まれません。
        {mode === "new" && (
          <>
            {" "}ZIP の中に <code className="font-mono">speaker-notes.md</code>（または <code className="font-mono">notes.md</code> / <code className="font-mono">.json</code>）を
            入れても取り込まれます（ここで選んだファイルが優先）。
          </>
        )}
      </p>
      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 hover:border-brand-400">
        <span className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700">ファイルを選択</span>
        <span className="truncate text-sm text-gray-600">{name || "選択されていません"}</span>
        <input
          type="file"
          name="notesFile"
          accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
          className="hidden"
          onChange={(e) => setName(e.target.files?.[0]?.name ?? "")}
        />
      </label>
      {mode === "edit" && (
        <p className="mt-2 text-xs text-gray-500">
          {existingCount > 0 ? (
            <span className="text-amber-700">
              選択して保存すると、現在のノート（{existingCount} 枚）はすべてファイルの内容に置き換わります。
            </span>
          ) : (
            "選択して保存すると、ノートとして取り込まれます。"
          )}
          {" "}一部だけ反映したいときは「スピーカーノート」画面の「ファイルから取り込む」を使ってください。
        </p>
      )}
    </div>
  );
}
