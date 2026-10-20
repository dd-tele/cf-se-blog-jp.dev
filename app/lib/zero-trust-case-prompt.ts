import type { ZeroTrustSnapshot } from "./zero-trust-case.server";

export interface CaseContext {
  customerAlias: string;
  contractSeats: string;
  contractedBandwidth: string;
  licenseTypes: string;
  background: string;
  challenges: string;
  pocOnboardingChallenges: string;
  outcomes: string;
  futurePlans: string;
  seNotes: string;
}

export function buildCaseTitle(caseContext: CaseContext): string {
  const customerAlias = caseContext.customerAlias.replace(/[\r\n#]+/g, " ").trim() || "顧客組織";
  return `【導入アーキテクチャ】Cloudflare Zero Trust：${customerAlias}`;
}

function profileSetting(fact: string, name: string): string | null {
  const value = fact.match(new RegExp(`${name}=([^/]+)`))?.[1]?.trim();
  return value || null;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "即時";
  if (seconds % 3600 === 0) return `${seconds / 3600}時間`;
  if (seconds % 60 === 0) return `${seconds / 60}分`;
  return `${seconds}秒`;
}

function profileControlLabel(facts: string[], fallback: string): string {
  const modes = [...new Set(facts.map((fact) => profileSetting(fact, "接続モード")).filter(Boolean))];
  const protocols = [...new Set(facts.map((fact) => profileSetting(fact, "Tunnel Protocol")).filter(Boolean))];
  const modeSwitch = facts.some((fact) => fact.includes("接続モード変更=禁止"))
    ? "接続モード変更: 禁止"
    : null;
  const disconnect = facts.some((fact) => fact.includes("利用者による切断=禁止"))
    ? "利用者による切断: 禁止"
    : null;
  const reconnectSeconds = facts
    .map((fact) => Number(profileSetting(fact, "自動再接続")?.replace("秒", "")))
    .filter((value) => Number.isFinite(value));
  const reconnect = reconnectSeconds.length > 0
    ? Math.min(...reconnectSeconds) === 0 && Math.max(...reconnectSeconds) === 0
      ? "即時自動接続"
      : `自動再接続: ${Math.min(...reconnectSeconds) === Math.max(...reconnectSeconds)
        ? formatDuration(Math.min(...reconnectSeconds))
        : `${formatDuration(Math.min(...reconnectSeconds))}〜${formatDuration(Math.max(...reconnectSeconds))}`}`
    : null;
  return [
    modes.length > 0 || protocols.length > 0
      ? [...modes.map((value) => value!.toUpperCase()), ...protocols.map((value) => value!.toUpperCase())].join(" / ")
      : fallback,
    modeSwitch,
    disconnect,
    reconnect,
  ].filter(Boolean).join("<br/>");
}

export function buildDeviceAccessDiagram(snapshot: ZeroTrustSnapshot): string {
  const profileSection = snapshot.sections.find((section) => section.key === "profiles");
  const profileFacts = profileSection?.facts.filter((fact) => fact.startsWith("WARP Device Profile")) ?? [];
  const defaultFacts = profileFacts.filter((fact) => fact.startsWith("WARP Device Profile「デフォルト」"));
  const customFacts = profileFacts.filter((fact) => !fact.startsWith("WARP Device Profile「デフォルト」"));
  const conditionLabels: string[] = [];
  if (customFacts.some((fact) => fact.includes("ユーザーまたはメール属性"))) conditionLabels.push("ユーザー・メール属性に一致");
  if (customFacts.some((fact) => fact.includes("IdPグループ"))) conditionLabels.push("IdP Groupに一致");
  if (customFacts.some((fact) => fact.includes("Managed Network条件=") || fact.includes("接続元ネットワーク"))) conditionLabels.push("Managed Networkに一致");
  if (customFacts.some((fact) => fact.includes("OS種別") || fact.includes("OSバージョン"))) conditionLabels.push("端末OS条件に一致");
  if (customFacts.some((fact) => fact.includes("SAML属性"))) conditionLabels.push("SAML属性に一致");
  if (conditionLabels.length === 0 && customFacts.length > 0) conditionLabels.push("優先Profile条件に一致");
  const customProfileLabel = conditionLabels.length === 1 && conditionLabels[0] === "ユーザー・メール属性に一致"
    ? "一時例外Profile群"
    : "条件別Profile群";

  const lines = [
    "flowchart TB",
    '  Device["利用者 / 端末"] --> Match{"Profile適用条件"}',
    "",
    ...conditionLabels.map((label) => `  Match -->|"${label}"| Exception["${customProfileLabel}"]`),
    '  Match -->|"他の条件に一致しない"| Default["デフォルトProfile"]',
    "",
    `  Exception --> ExceptionControl["${profileControlLabel(customFacts, "Profile固有の接続・端末制御")}"]`,
    `  Default --> DefaultControl["${profileControlLabel(defaultFacts, "デフォルトの接続・端末制御")}"]`,
    "",
    '  ExceptionControl --> Edge["Cloudflare Zero Trust"]',
    "  DefaultControl --> Edge",
    "",
    "  classDef active fill:#E8F5E9,stroke:#2E7D32,color:#1B5E20",
    "  classDef condition fill:#FFF3E0,stroke:#EF6C00,color:#E65100",
    "  class Default,Exception,DefaultControl,ExceptionControl,Edge active",
    "  class Match condition",
  ];
  return lines.join("\n");
}

export function buildCasePrompt(snapshot: ZeroTrustSnapshot, caseContext: CaseContext): string {
  const deviceAccessDiagram = buildDeviceAccessDiagram(snapshot);
  return `以下の匿名化済み情報から、Cloudflare Zero Trust導入事例の技術ブログ記事を日本語のMarkdownで作成してください。

## 厳守事項
- 1行目は記事メタデータへ使用する「# ${buildCaseTitle(caseContext)}」と完全に一致させ、本文には同じタイトルを再掲しない。タイトルは「導入ソリューション + 顧客エイリアス」の形式から変更しない。
- 「本記事は下書き」「公開前に顧客確認」「技術レビューが必要」などの注意書きを本文に含めない。
- 記事を最後まで書き切り、最終行に完成確認用の「<!-- ARTICLE_COMPLETE -->」を必ず出力する。
- 入力情報の種別を本文のラベルとして列挙せず、自然な技術記事として構成する。
- 「SE入力」「API取得事実」「AI考察」「情報の区分」という見出しや表現を本文に出さない。
- API、データ収集、読み取り、確認という行為には触れず、SE自身が設計内容を説明する文章にする。
- 「確認できました」「確認できます」「見て取れます」「考えられます」「推測されます」「示唆されます」「うかがえます」を使用しない。
- 「具体的には、以下のようなポリシー構成が確認できました」のような、情報源を客観視する導入文を使用しない。
- 数値や構成に関する断定は、提供された構成情報だけを根拠にする。
- 契約シート数、契約帯域、ライセンス種類は提供された項目だけを契約概要として記載し、空欄の項目は見出しや「不明」「未提供」などの注記を含めて表示しない。
- 導入背景、設計意図、成果は提供された文脈の範囲で断定形を使い、入力にない理由や効果は追加しない。
- 顧客名、ドメイン、IP/CIDR、メール、IDを生成・復元しない。提供されていないリソース名を創作しない。
- 未取得の製品は本文から省き、未導入とは断定しない。
- 全体アーキテクチャのMermaid構成図は提供された図だけを使用し、架空の構成要素を足さない。Device & Access Controlの図に限り、提供されたDevice Profileの適用条件と設定から別のMermaid図を作成してよい。
- Gatewayはポリシー名、脅威カテゴリを含む対象通信、対象ユーザー、端末状態、アクションを省略せず、各ポリシーが何を防止・許可するのかを個別に説明する。
- HTTP Policyは提供されている場合に限りDo Not Inspectを最大1件、Do Not Scanを最大1件、それ以外の制御系を最大4件の順で、提供された代表ポリシーを省略せず説明する。未提供のポリシーは創作しない。
- Gatewayの設定全体を網羅した一覧とは表現せず、DNS・Network・HTTPから選んだ代表的なポリシーとして紹介する。
- 「DNS制御は特定ドメインへのアクセスを制御する」のような製品一般論へ言い換えず、MalwareやPhishingなど入力に含まれる具体的なカテゴリと処理を明記する。
- Do Not InspectとDo Not Scanでは、提供された「対象となる主要Application」を具体例として記載する。
- 「設計用途=テナント制御」と記載されたAllowポリシーは、単なるドメイン許可ではなく、組織で許可したSaaSテナントだけを利用させる制御として説明する。
- Device Profileは提供された項目について、Profileごとの適用対象、接続モード、切断・離脱制御、自動再接続、Tunnel Protocol、Split Tunnel、DNS関連設定とProfile間の使い分けを説明する。
- Device & Access Controlは表や長い箇条書きにせず、見出しを必ず「## Device & Access Control」とし、短い設計概要に続けて下記の指定Mermaid図を一字一句改変せず挿入する。図の前後で同じ内容を繰り返さない。
- Device & Access ControlのMermaid図にはSplit Tunnelの件数や宛先を含めない。Managed Network、IdP Group、ユーザー・メール属性などの分岐は、収集情報に実際に存在する条件だけを記載し、未設定の分岐を設計例として追加しない。
- Egress Policyは固定出口IPが設定されたポリシーだけを対象とし、どの通信を特定の送信元IPから外部へ出す設計なのかを説明する。共有出口へ送信するデフォルトのEgress除外ポリシーには触れない。
- Managed Networkが設定されている場合は、管理下ネットワークを識別する用途と、どのDevice Profileの適用条件に利用しているかを説明する。
- Split TunnelはDevice & Access Controlから分離し、独立した「Split Tunnelの代表設計」セクションで説明する。標準Profile、一時例外Profile、グループ・端末用途別Profileなど、収集情報から読み取れる代表パターンにまとめ、それぞれがどのDevice Profile区分に紐づく設定かを明記する。
- Split Tunnelは件数だけでなく、Include・Excludeごとの匿名化済み宛先カテゴリと、その通信をCloudflare経由または直接接続にする設計を説明する。Includeは1件以上のInclude設定が提供された場合だけ「Cloudflare経由」として記載し、Excludeは1件以上のExclude設定が提供された場合だけ「直接接続」として記載する。0件または提供されていない方式は見出し、説明、設定なしという注記を含めて一切表示しない。具体的なProfile名、地域名、メール条件、ホスト名、IPアドレス、社内システム名は記載しない。
- Identity Providerは提供された連携方式、SCIM、グループ連携対応の設定状況に基づいて役割を説明し、SAML方式では提供されたIdP名称を明記する。未提供の固有名、Tenant情報、利用目的は推測しない。
- Device PostureはCheck種別、対象OS、有効状態、Gateway Policyでの利用状況を説明する。
- Device Posture Checkは同じ種別でも統合せず、「個別記載するPosture Check数」と同数の項目を名称付きで個別に列挙する。提供されたCheckを省略しない。
- Device PostureでService Providerを利用している場合は、Provider種別と連携用途を説明する。認証情報や組織固有設定は推測しない。
- デフォルトDevice Profileは全端末向けではなく、優先順位の高い他のProfile条件に一致しなかった端末・ユーザーへ適用されるフォールバックとして説明する。
- Local Domain Fallbackの件数は、カスタム登録されDNSサーバーが指定された設定だけを表す。
- [USER_DEFINED_NAME]はユーザー特定につながる名称を除去したプレースホルダーであり、推測や復元をしない。
- Networkは規模と接続先を設計意図とともに説明する。
- DLPとCASBは提供されたProfile名・Integration先を具体例として自然に織り込む。
- 集計値の箇条書きだけで終わらせず、それぞれが課題解決にどう寄与する構成かを技術的に説明する。
- PoCとオンボーディング中の課題が提供されている場合は、導入前の課題と混同せず、検証・展開時に直面した課題と対応上の学びとして独立して説明する。入力が空の場合はこの項目を作らない。

## 匿名化済みの構成情報
${JSON.stringify(snapshot, null, 2)}

## 匿名化済みの導入文脈
${JSON.stringify(caseContext, null, 2)}

## Device & Access Control指定図
\`\`\`mermaid
${deviceAccessDiagram}
\`\`\`

## 推奨構成
導入背景、契約概要、導入前の課題、PoCとオンボーディング中の課題、設計方針、アーキテクチャ、製品別の実装、導入効果、運用上の学び、今後の取り組みと課題`;
}
