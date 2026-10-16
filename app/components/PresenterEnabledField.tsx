/** Opt-in checkbox for presentation mode, shared by the new / edit forms. */
export function PresenterEnabledField({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="presenterEnabled"
          value="1"
          defaultChecked={defaultChecked}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          <span className="block text-sm font-medium text-gray-800">プレゼンテーション機能を使う</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            発表モード（QR でスマホをリモコンに）、スピーカービュー、スピーカーノートを有効にします。
            OFF にすると、接続中のリモコンも再読み込み時に切断されます。
          </span>
        </span>
      </label>
    </div>
  );
}

export function parsePresenterEnabled(v: FormDataEntryValue | null): boolean {
  return v === "1" || v === "on" || v === "true";
}
