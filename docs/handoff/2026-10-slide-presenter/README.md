# 引き継ぎ: スライド発表機能 + 認証の脆弱性修正（2026-10）

PoC トラッカーのワークスペースで進めていた cf-se-blog（Cloudflare Field Notes）関連の作業を、
ブログ作成側に引き継ぐための資料です。**本番反映まで完了済み**で、残りは任意のフォローアップです。

---

## 0. 新しいセッションに最初に貼るプロンプト

```text
cf-se-blog-platform（Cloudflare Field Notes、Remix v2 on Cloudflare Pages）の作業を引き継ぎます。
まず docs/handoff/2026-10-slide-presenter/README.md を読んで、現状と残タスクを把握してください。

前提:
- 本番は https://cf-se-blog-jp.dev（Pages プロジェクト cf-se-blog、アカウント a4ca1c82309af1a392f77e6e5db8fd68）
- origin/main は ab250a0 まで進んでいる。ローカル main には未コミットの作業（Zero Trust 事例）があるので、
  pull する前に README の「12. ローカル main の更新手順」に従うこと（stash → pull → stash pop）
- main に push すると GitHub Actions が本番デプロイと D1 マイグレーションを行う
- workers/slide-sync は CI ではデプロイされない（変更時は手動で wrangler deploy）
- シェルでは PATH=/usr/local/bin:$PATH と NODE_EXTRA_CA_CERTS=~/.cloudflared/cloudflare-ca.pem が必要

最初にやること: 現状確認（git status / git log / wrangler pages deployment list）だけを行い、
README の「10. 残タスク」から何を進めるかを私に確認してください。
```

---

## 1. 概要

| 項目 | 内容 |
|---|---|
| 新機能 | スライドの発表モード（会場 PC＝表示、スマホ / iPad＝リモコン兼スピーカービュー）、スピーカーノート、スライドのカテゴリ、デッキごとの発表機能 ON/OFF |
| 脆弱性修正 | 本番で admin セッションを偽造できた問題を3点修正（詳細は「7. 認証の修正」） |
| 本番 | `ab250a0`（デプロイ `89bc9497`）。CI 成功、本番で動作確認済み |
| ユーザー確認 | 本番の Access ログイン、プレビューでの発表機能は確認済み（「ひとまず良さそう」） |

コミット（すべて origin/main に入っている）:

| コミット | 内容 |
|---|---|
| `4fb92c8` | fix(auth): close session forgery and mock-login bypass |
| `91fa139` | fix(auth): tolerate team-domain formats, clearer verify errors, correct Access docs |
| `ab250a0` | feat(slides): presenter mode with phone remote, speaker notes and categories |

---

## 2. 現在の状態

### 本番・プレビュー

| 環境 | URL | 備考 |
|---|---|---|
| 本番 | https://cf-se-blog-jp.dev | `/portal/*`・`/admin/*` のみ Access（チーム `cf-se-jp`）。`/` と `/slides` は一般公開 |
| 本番（pages.dev） | https://cf-se-blog.pages.dev | **Access も WAF も通らない**（「10. 残タスク」参照） |
| プレビュー | https://feature-slide-presenter.cf-se-blog.pages.dev | `*.cf-se-blog.pages.dev` 全体が Pages の Access ポリシーで保護（AUD は本番と別） |
| slide-sync Worker | `cf-se-blog-slide-sync` | 公開ルートなし（`workers_dev=false`）。Pages から DO バインディングでのみ使う |

旧本番デプロイのハッシュ URL（例 `678aa6f2.cf-se-blog.pages.dev`、脆弱な旧コード）も、
プレビュー用の Access ポリシー（`*.cf-se-blog.pages.dev`）で保護されていることを確認済み。

### ブランチ・作業フォルダ（worktree）

| パス | ブランチ | 状態 |
|---|---|---|
| `~/CascadeProjects/cf-se-blog-platform` | `main`（`b6af95d`） | **origin より3コミット遅れ**。未コミットの作業（Zero Trust 事例）あり |
| `~/CascadeProjects/cf-se-blog-authfix` | `fix/auth-hardening`（`91fa139`） | main に取り込み済み。削除してよい |
| `~/CascadeProjects/cf-se-blog-presenter` | `feature/slide-presenter`（`ab250a0`） | main に取り込み済み。削除してよい（ローカル D1 にテスト用スライドが入っている） |

---

## 3. 発表機能のしくみ

```
会場 PC  /slides/<slug>/present  ──┐                 ┌── スマホ /slides/<slug>/remote?r=<room>&k=<key>
 (要ログイン・発表権限)            │  WebSocket       │   (ログイン不要。QR で受け取ったワンタイムキー)
                                    ▼                  ▼
        Pages Functions  /present-ws/<room>  →  Durable Object PresentRoom（Worker: cf-se-blog-slide-sync）
                                    （functions/[[path]].ts で Remix より前に中継）
```

- **ルーム**: 発表を開くたびに作成。roomId は 24 文字、キーは 256bit。DO にはキーの SHA-256 だけを保存し、12 時間後に alarm で失効。
  WebSocket Hibernation を使い、メッセージは `cmd`（next/prev/goto 等）、`state`、`peers`、`ping`。
- **デッキ操作**: `app/lib/deck-control.ts`。reveal.js があれば API で操作し、無ければキー入力で操作。
  プレビュー用のサムネイルは `makeStatic()` で固定表示にする。reveal 5 は幅 435px 未満で自動的にスクロール表示に
  切り替わり、表示中のページ番号がずれるため、`scrollActivationWidth: 1` で無効化している
  （`null` だと既に有効になったスクロール表示を解除しない）。
- **スピーカービュー**（`app/components/SpeakerConsole.tsx`）: 現在・次のプレビュー、ノート（簡易 Markdown）、
  タイマー、スワイプ、Wake Lock、ジャンプ。iPad では次のスライドも表示。
- **限定公開・下書きのデッキ**: スマホにはログインセッションが無いため、リモコンのページで HMAC 署名付き Cookie
  `__present_grant` を発行する（Path=`/slides/<slug>/`、HttpOnly、ルームの有効期限まで）。デッキ配信側
  （`slides.$slug_.a.$.tsx`）がこれを受け付ける。`SESSION_SECRET` が無いデプロイ環境では発行しない（安全側に倒す）。
  プレビュー用 iframe は `?embed=1` を付けて閲覧数に数えない。制限付きデッキは `Cache-Control: private`。
- **発表機能の ON/OFF**（`slides.presenter_enabled`、既定 OFF）: OFF のときは発表、スピーカービュー、
  リモコンが 403 になり、詳細ページのボタンも出さない。接続中のリモコンも、再読み込みした時点で切断される。
  ノート編集だけは OFF でも使える（ON にする前に準備できるように）。
- **発表権限**（`canPresentSlide`）: 発表機能が ON で、admin / se / 作成者のいずれか。

---

## 4. 追加・変更したファイル

| 種別 | パス |
|---|---|
| Worker | `workers/slide-sync/wrangler.toml`、`workers/slide-sync/src/index.ts` |
| 設定 | `wrangler.toml`（DO バインディング `PRESENT_ROOM`、`script_name = "cf-se-blog-slide-sync"`）、`env.d.ts`、`load-context.ts`、`package.json`（`uqr`：QR 生成） |
| 中継 | `functions/[[path]].ts`（`/present-ws/<room>` → DO） |
| ライブラリ | `app/lib/present.server.ts`、`app/lib/present-socket.ts`、`app/lib/deck-control.ts`、`app/lib/slide-notes.server.ts`、`app/lib/slide-categories.ts`、`app/lib/slides.server.ts` |
| 画面 | `app/routes/slides.$slug_.present.tsx`、`slides.$slug_.remote.tsx`、`slides.$slug_.speaker.tsx`、`portal.slides.$id.notes.tsx` |
| 既存画面の変更 | `slides.$slug.tsx`（ボタン、カテゴリ、OFF 時の案内）、`slides._index.tsx`（カテゴリタブ `?c=`）、`slides.$slug_.a.$.tsx`（grant Cookie、`embed=1`）、`portal.slides._index.tsx`（発表機能スイッチ、発表・ノートのリンク）、`portal.slides.new.tsx` / `portal.slides.$id.edit.tsx`（カテゴリ、発表機能チェックボックス） |
| 部品 | `app/components/SpeakerConsole.tsx`、`app/components/PresenterEnabledField.tsx` |
| スキーマ | `app/db/schema.ts`（`slides.category`、`slides.presenter_enabled`、`slideNotes`） |
| 認証修正 | `app/lib/auth.server.ts`、`app/lib/access.server.ts`、`app/root.tsx`、`app/routes/auth.login.tsx`、`docs/DEPLOY.md`、`docs/02-cloudflare-services-map.md` |

---

## 5. D1 マイグレーション（本番 `cf-se-blog-db` に適用済み）

| ファイル | 内容 |
|---|---|
| `0021_*`, `0022_*` | ローカル main の**未コミット作業**（Zero Trust 事例）のもの。リモートには適用済みだが、リポジトリにはまだ無い |
| `0023_slide_presenter.sql` | `slides.category`（既定 `event`）、`slide_notes(slide_id, idx, body)` |
| `0024_slide_presenter_flag.sql` | `slides.presenter_enabled INTEGER NOT NULL DEFAULT 0` |

プレビュー環境も本番と同じ D1 / R2 を使う。プレビューでのテスト用アップロードは「下書き」か「限定公開」で行うこと。

---

## 6. シークレット・Access 設定

| 項目 | 本番 | プレビュー |
|---|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | `cf-se-jp`（旧値 `cf-se-blog-jp` は存在しないチーム。今回修正） | `cf-se-jp` |
| `CF_ACCESS_AUD` | `3a00eb8ffa28bcbba4d18968f91992c53e48fc582e7b645355ac68b065f42fc8`（`/portal`・`/admin` 共通） | `16cefef5603f21c0f0f8558b498361e52697538c200b0f11b07da3d7f6e7d9fe`（`*.cf-se-blog.pages.dev`） |
| `SESSION_SECRET` | 64 文字のランダム値（今回新規。値はどこにも保存していない） | 別のランダム値 |
| その他（ADMIN_EMAILS、TURNSTILE、CF_API_TOKEN など） | 従来どおり | **未設定**。AI やメールなど一部の機能はプレビューでは動かない可能性あり |

- `CF_ACCESS_TEAM_DOMAIN` は `cf-se-jp`、`cf-se-jp.cloudflareaccess.com`、`https://…` のどの形でも動く（`normalizeTeamName`）。
- `CF_ACCESS_AUD` はカンマ区切りで複数指定できる。
- `SESSION_SECRET` を作り直すと既存のセッションはすべて無効になる（Access のユーザーは自動で再ログインされる）。
  32 文字未満、または未設定だとログインできなくなる（公開ページは表示される）。
- Pages のシークレットの変更は、次のデプロイから反映される。

---

## 7. 認証の修正（`4fb92c8`、`91fa139`）

Access で保護しているのは `/portal`・`/admin` だけだが、アプリのコードは「サイト全体が Access の内側にある」前提で
書かれていた。そのため次の3つの穴があった（ローカルの本番相当構成で、攻撃が成立することを確認済み）。

1. **開発用ログインの POST が本番でも動いた**: `POST /auth/login` に `userId=dev-admin-001` を送るだけで admin セッションが発行された。
   → localhost かつ Access 未設定のとき以外は 404。開発用ログイン画面も localhost でしか出さない。
2. **署名を検証できない JWT を信用していた**（`root.tsx` の自動ログイン、`auth.login.tsx`、`requireUser`）:
   Access を通らない `/` などでは `CF_Authorization` Cookie を偽造できる。
   → 署名検証に成功した JWT だけを使う。`decodeAccessJWTUnsafe` は、ログアウト方向の判定（メールの不一致検知など）にしか使わない。
3. **セッションの署名鍵が公開されていた**: `SESSION_SECRET` が未設定で、公開リポジトリに載っている固定値
   `__dev_session_secret_change_in_prod__` で署名していた。
   → デプロイ環境で正しい `SESSION_SECRET` が無い場合、読み込みはプロセスごとのランダム鍵で行い、セッションの発行（ログイン）は拒否する。

ほかの変更: `requireUser` / `requireRole` の `env` を必須にした。有効期限（`exp`）の無い JWT は拒否する。
公開鍵の取得に失敗したときは、取得先 URL と「CF_ACCESS_TEAM_DOMAIN を確認」をログに出す。

**修正後に判明したこと**: 本番の `CF_ACCESS_TEAM_DOMAIN` が存在しないチーム名のままで、署名検証はずっと失敗していた。
それを「検証せずに読む」処理が隠していた。修正のデプロイ直後にログインできなくなり、値を `cf-se-jp` に直して解消した。

本番で再テスト済み: 開発用ログインの POST は 404、偽造したセッションでの API は 401、偽造 JWT ではセッションが発行されない。

---

## 8. 運用手順

- **スライドを発表に使う**: スライド管理で「発表機能」を ON → 「ノート」でスピーカーノートを入力（デッキ内の
  `<aside class="notes">` を取り込むこともできる）→ 詳細ページの「発表する」→ QR をスマホで読み取る。
  発表する側は、先に `/portal` から Access でログインしておく。
- **slide-sync Worker の変更**（CI ではデプロイされない。Pages より先に出す）:
  ```bash
  npx wrangler deploy --config workers/slide-sync/wrangler.toml
  ```
- **本番デプロイ**: main に push すると GitHub Actions（`.github/workflows/deploy.yml`）が npm ci、build、
  FK 修正、`d1 migrations apply --remote`、`pages deploy` の順に実行する。

---

## 9. ローカル開発・テスト

```bash
export PATH=/usr/local/bin:$PATH NODE_EXTRA_CA_CERTS=~/.cloudflared/cloudflare-ca.pem
npx wrangler d1 migrations apply cf-se-blog-db --local
npx wrangler dev --config workers/slide-sync/wrangler.toml --port 8790 &   # DO（PresentRoom）
npm run build && npx wrangler pages dev ./build/client --port 8788 &       # アプリ
```

- Access 未設定の localhost では開発用ログインが使える（`dev-admin-001` / `dev-se-001` / `dev-user-001`）。
- ローカル D1 の `users` に `password_hash` 列が無い場合がある（過去にマイグレーション外でテーブルを作り直した影響）。
  その場合は `ALTER TABLE users ADD COLUMN password_hash TEXT` をローカルにだけ実行する。

`tests/` のスクリプト（Playwright 1.48 が必要。`npm i -D playwright` など）:

| スクリプト | 内容 |
|---|---|
| `e2e-presenter-toggle.mjs` | 発表機能の ON/OFF（OFF で 403 → ON で発表・リモコン → OFF でリモコン切断 → 編集画面での保存） |
| `e2e-upload-notes-limited.mjs` | ZIP アップロード（`fixtures/poc-deck.zip`）、ノート 20 件の保存、限定公開デッキを未ログインの iPad リモコンで表示、匿名アクセスは 403 |
| `e2e-present-basic.mjs` | 発表とリモコンの同期、ジャンプ、不正キーは 403。**事前に** `UPDATE slides SET presenter_enabled=1 WHERE slug='cloudflare-agents'` をローカル D1 で実行 |
| `check-phone-preview-index.mjs` | 途中から参加したスマホのプレビューが正しいページを表示するか（スクロール表示の回帰テスト） |
| `auth-attack-local.mjs` | 認証の攻撃パターン（開発用ログインの POST、偽造 JWT、開発用鍵で偽造したセッション）をローカルの複数構成に対して実行 |
| `auth-attack-prod.mjs` | 同じ攻撃パターンを本番に対して実行（偽造した入力を送るだけで、正規のセッションは作らない） |

既知の問題（ローカルのみ）: `wrangler pages dev`（wrangler 3）で ZIP をアップロードした直後、JS チャンクの読み込みが 404 になり、
詳細ページへ移動せずアップロード画面に戻る。アップロード自体は成功している。プレビューでは報告なし。

---

## 10. 残タスク（任意）

0. ~~**スピーカーノートの一括取り込み**~~ → **本番反映済み**（2026-10-17、`38de927`、デプロイ `55526a76`）。worktree `~/CascadeProjects/cf-se-blog-notes-import`
   （ブランチ `feature/speaker-notes-import`、main に取り込み済み。削除してよい）。ノート編集画面の「ファイルから取り込む」で
   `.md` / `.json` を読み込み、確認ダイアログ（枚数・デッキとの不一致警告・「すべて置き換える」/「空欄だけに入れる」）を経て編集欄に反映、
   「保存」で既存の action に送る。パーサは `app/lib/slide-notes-import.ts`（ブラウザで実行。上限定数もここに移動）。
   PoC トラッカーの `speaker-notes.md` / `.json` で 20 枚の取り込みと保存をローカル E2E で確認済み。
   ※ README 記載の `tests/` と `tests/fixtures/` はリポジトリに存在しなかった。原本は `~/CascadeProjects/poc-tracker/slides/`。
   追加（`1e5372f`、デプロイ `6ca78ae9`）: スライド ZIP 内の `speaker-notes.md` / `notes.md` / `*.json`（ファイル名で判定、
   Markdown 優先）をアップロード時にノートとして取り込み、R2 の公開アセットからは除外する（以前は R2 に保存され
   `/slides/<slug>/a/` で配信されていた）。アップロード画面と編集画面に「スピーカーノート（任意）」のファイル欄を追加
   （アップロード時は ZIP 内より優先、編集画面ではノート全体を置き換え）。読めないノートファイルはエラーにして保存しない。
1. **`cf-se-blog.pages.dev` を Bulk Redirect（301）で `https://cf-se-blog-jp.dev` に転送**（推奨）。
   このホストは WAF も Access も通らない（`/portal`・`/admin` も保護されない）。認証の修正でログインはできなくなったが、
   WAF を迂回できる入口が残っている。手順は https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/ 。
   **「Include subdomains」はオフ**にする（オンにするとプレビューやハッシュ URL もすべて転送される）。
2. 不要になった worktree の削除（「11. 片付け」）。
3. プレビューで確認用にアップロードしたスライドがあれば、本番 D1 から削除する（スライド管理から）。
4. 資料の更新: `/about` やチェンジログに発表機能を追記するか検討。`docs/` の他の資料にも、実装と合っていない記述が残っている可能性がある
   （今回は `DEPLOY.md` と `02-cloudflare-services-map.md` の Access まわりだけ修正済み）。
5. wrangler が v3 で古い（`npm install --save-dev wrangler@4` を推奨と警告が出る）。

---

## 11. 片付け

```bash
# ローカルの開発サーバー（起動していれば）
pkill -f "pages dev ./build/client"; pkill -f "slide-sync/wrangler.toml"

# worktree（どちらも main に取り込み済み）
cd ~/CascadeProjects/cf-se-blog-platform
git worktree remove ../cf-se-blog-authfix
git worktree remove --force ../cf-se-blog-presenter   # ローカル D1 のテストデータも消える
git branch -d fix/auth-hardening feature/slide-presenter
```

---

## 12. ローカル main の更新手順（未コミットの作業がある場合）

未コミットの作業と、取り込むコミットが4つのファイルで重なっている:
`app/db/schema.ts`、`env.d.ts`、`load-context.ts`、`wrangler.toml`。

```bash
cd ~/CascadeProjects/cf-se-blog-platform
git stash push -u -m "wip: zero-trust case"   # 未追跡ファイル（0021/0022 など）も含める
git pull --ff-only
git stash pop
```

どのファイルもお互いに行を足しているだけなので、競合が出ても両方の行を残せば解決する。
マイグレーション番号は、未コミット作業が 0021・0022、今回が 0023・0024 で重ならない。
（この README 自体も未追跡ファイルなので、stash に含まれる。pop で戻る）

---

## 13. 関連（PoC トラッカー側に残すもの）

PoC トラッカーの登壇用デッキは PoC トラッカーのリポジトリに置いてある:
`~/CascadeProjects/poc-tracker/slides/`（`poc-tracker-deck.html`、`speaker-notes.md`、`speaker-notes.json`、`img/`）。
`tests/fixtures/` にはその写しを置いてある（`poc-deck.zip` はデッキを ZIP にしたもの、`poc-notes.json` はノートの配列だけを抜き出したもの）。

---

## 14. スピーカーノートの一括取り込み形式（ブログ側で対応予定の機能向け）

PoC トラッカー側で、次の2つの形式でノートを用意してある（`tests/fixtures/speaker-notes.md` / `speaker-notes.json`）。
ノートは公開されるデッキ HTML（`<aside class="notes">`）には入れない方針なので、デッキとは別ファイルで取り込めるようにしたい。

**Markdown（`speaker-notes.md`、人が編集する正本）**

```markdown
# タイトル（取り込み対象外）

<!-- コメントは取り込み対象外 -->

## 1. 表紙
目安 30 秒

- 箇条書き、**太字**、空行で段落（SpeakerConsole の簡易 Markdown と同じ）

## 2. サマリー
...
```

- 「`## <番号>. <見出し>`」から次の「`## <番号>.`」の直前までが、そのスライドのノート本文。
- 番号は 1 始まりで、デッキのスライド順（縦スライドも読み順。`slide_notes.idx` = 番号 − 1）。見出しは確認用で、取り込みには使わない。
- 最初の `## <番号>.` より前の行と、HTML コメントは無視する。

**JSON（`speaker-notes.json`、Markdown から `node notes-to-json.mjs` で生成）**

```json
{ "version": 1, "deck": "speaker-notes", "slideCount": 20, "notes": ["スライド1のノート", "..."] }
```

- `notes` は 0 始まりの配列。既存のノート保存処理（`portal.slides.$id.notes.tsx` の action、フォーム項目 `notes` に JSON 配列）にそのまま渡せる。
- 素の配列（`["...", "..."]`）も受け付けると扱いやすい。

取り込み時に確認したいこと: ノートの枚数とデッキの枚数（`slides.slide_count`）の一致（違う場合は警告）、
上書きの確認、1 枚 8,000 文字・500 枚の上限（`MAX_NOTE_CHARS` / `MAX_NOTE_SLIDES`）。
