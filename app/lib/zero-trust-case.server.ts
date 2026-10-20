const API_BASE = "https://api.cloudflare.com/client/v4";

export type CollectionStatus = "collected" | "unavailable";

export interface CaseSection {
  key: string;
  label: string;
  status: CollectionStatus;
  facts: string[];
  note?: string;
}

export interface ZeroTrustSnapshot {
  collectedAt: string;
  sections: CaseSection[];
  architecture: string;
  limitations: string[];
}

interface ApiEnvelope {
  success?: boolean;
  result?: unknown;
  result_info?: {
    page?: number;
    per_page?: number;
    total_count?: number;
    total_pages?: number;
  };
}

interface ApiItem {
  [key: string]: unknown;
}

function asItems(result: unknown): ApiItem[] {
  return Array.isArray(result)
    ? result.filter((item): item is ApiItem => typeof item === "object" && item !== null)
    : [];
}

function stringValue(value: unknown, fallback = "不明"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function unavailable(key: string, label: string): CaseSection {
  return {
    key,
    label,
    status: "unavailable",
    facts: [],
    note: "権限不足、未契約、またはAPI未提供のため取得できませんでした。",
  };
}

async function fetchEnvelope(path: string, token: string): Promise<ApiEnvelope> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Cloudflare API returned ${response.status}`);

  const body = (await response.json()) as ApiEnvelope;
  if (body.success !== true || body.result === undefined) {
    throw new Error("Cloudflare API request failed");
  }
  return body;
}

async function fetchPagedItems(
  path: string,
  token: string,
  pageSize: number,
  maxPages = 10
): Promise<{ items: ApiItem[]; truncated: boolean }> {
  const items: ApiItem[] = [];
  let truncated = false;

  for (let page = 1; page <= maxPages; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetchEnvelope(`${path}${separator}page=${page}`, token);
    const pageItems = asItems(response.result);
    items.push(...pageItems);

    const totalPages = response.result_info?.total_pages;
    const totalCount = response.result_info?.total_count;
    const actualPageSize = response.result_info?.per_page ?? pageSize;
    if (
      (typeof totalPages === "number" && page >= totalPages) ||
      (typeof totalCount === "number" && items.length >= totalCount) ||
      pageItems.length < actualPageSize
    ) {
      return { items, truncated: false };
    }
    truncated = page === maxPages;
  }

  return { items, truncated };
}

function maskUserDefinedNames(value: string): string {
  return value.replace(
    /(^|[^A-Za-z0-9])(?:yoshikawa|vector)(?=$|[^A-Za-z0-9])/gi,
    "$1[USER_DEFINED_NAME]"
  );
}

function replaceMappedIds(
  values: string,
  names: Map<number, string>,
  unresolvedValue?: string
): string {
  return values.replace(
    /\b\d+\b/g,
    (value) => names.get(Number(value)) ?? unresolvedValue ?? value
  );
}

function redactExpression(
  expression: unknown,
  categories: Map<number, string>,
  applications = new Map<number, string>()
): string {
  if (typeof expression !== "string" || !expression.trim()) return "指定なし";
  const redacted = expression
    .replace(/(["']).*?\1/g, '"[VALUE]"')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[RESOURCE_ID]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g, "[IP_OR_CIDR]")
    .replace(
      /((?:category|categories)[^{}]{0,80}\{)([^}]+)(\})/gi,
      (_, prefix: string, values: string, suffix: string) =>
        `${prefix}${replaceMappedIds(values, categories)}${suffix}`
    )
    .replace(
      /((?:category|categories)[^=]{0,40}==\s*)(\d+)/gi,
      (_, prefix: string, value: string) => `${prefix}${categories.get(Number(value)) ?? value}`
    )
    .replace(
      /(app\.(?:ids|hosts_ids|supports_ids)\[\*\][^{}]{0,40}\{)([^}]+)(\})/gi,
      (_, prefix: string, values: string, suffix: string) =>
        `${prefix}${replaceMappedIds(values, applications, "[APPLICATION_ID]")}${suffix}`
    )
    .replace(
      /(app\.(?:ids|hosts_ids|supports_ids)\[\*\][^=]{0,40}==\s*)(\d+)/gi,
      (_, prefix: string, value: string) =>
        `${prefix}${applications.get(Number(value)) ?? "[APPLICATION_ID]"}`
    )
    .replace(/\s+/g, " ")
    .trim();
  return maskUserDefinedNames(redacted);
}

function gatewayLayer(filters: unknown): string {
  if (!Array.isArray(filters)) return "Gateway";
  return filters
    .map((filter) => {
      if (filter === "http") return "HTTP";
      if (filter === "dns") return "DNS";
      if (filter === "l4") return "Network";
      if (filter === "egress") return "Egress";
      return String(filter);
    })
    .join(" + ");
}

function gatewayAction(action: unknown): string {
  const value = stringValue(action);
  const labels: Record<string, string> = {
    allow: "許可",
    block: "ブロック",
    isolate: "ブラウザ隔離",
    do_not_isolate: "ブラウザ隔離を除外",
    do_not_inspect: "TLS復号を除外",
    do_not_scan: "AVスキャンを除外",
    noisolate: "ブラウザ隔離を除外",
    noscan: "AVスキャンを除外",
    off: "TLS復号・HTTP検査を除外（Do Not Inspect）",
    override: "上書き許可",
    egress: "指定した出口IPから送信",
  };
  return labels[value] ?? value;
}

function isDoNotInspectAction(action: unknown): boolean {
  return action === "off" || action === "do_not_inspect";
}

function isDoNotScanAction(action: unknown): boolean {
  return action === "noscan" || action === "do_not_scan";
}

function gatewayRuleSpecificity(
  rule: ApiItem,
  categories: Map<number, string>,
  applications: Map<number, string>
): number {
  const details = [
    stringValue(rule.name, ""),
    redactExpression(rule.traffic, categories, applications),
    stringValue(rule.identity, ""),
    stringValue(rule.device_posture, ""),
  ].join(" ");
  let score = 0;
  if (/malware|phishing|ransomware|command.?and.?control|cryptomining|security.?threat|ウイルス|フィッシング/i.test(details)) score += 20;
  if (/category|categories|indicator|risk|threat/i.test(details)) score += 8;
  if (typeof rule.device_posture === "string" && rule.device_posture) score += 4;
  if (typeof rule.identity === "string" && rule.identity) score += 3;
  if (/application|domain|host|url/i.test(stringValue(rule.traffic, ""))) score += 2;
  return score;
}

function selectRepresentativeRules(
  rules: ApiItem[],
  categories: Map<number, string>,
  applications: Map<number, string>
): ApiItem[] {
  const isTestRule = (rule: ApiItem) => {
    const name = stringValue(rule.name, "");
    return /test|poc|テスト|検証/i.test(name);
  };
  const eligibleRules = rules.filter((rule) => !isTestRule(rule));
  const ranked = [...eligibleRules].sort((a, b) => {
    const scoreDifference =
      gatewayRuleSpecificity(b, categories, applications) -
      gatewayRuleSpecificity(a, categories, applications);
    return scoreDifference || Number(a.precedence ?? 0) - Number(b.precedence ?? 0);
  });
  const usedRules = new Set<ApiItem>();

  const selectForLayer = (filter: "dns" | "l4" | "http"): ApiItem[] => {
    const candidates = ranked.filter((rule) =>
      !usedRules.has(rule) && Array.isArray(rule.filters) && rule.filters.includes(filter)
    );
    const selected: ApiItem[] = [];
    if (filter === "http") {
      const requiredRules = [
        candidates.find((rule) => isDoNotInspectAction(rule.action)),
        candidates.find((rule) => isDoNotScanAction(rule.action)),
      ].filter((rule): rule is ApiItem => !!rule);
      for (const rule of requiredRules) {
        if (!selected.includes(rule)) selected.push(rule);
      }
      const controls = candidates.filter(
        (rule) => !selected.includes(rule) &&
          !isDoNotInspectAction(rule.action) &&
          !isDoNotScanAction(rule.action)
      );
      controls.sort((a, b) => {
        const tenantDifference = Number(tenantControlPurpose(b) !== null) - Number(tenantControlPurpose(a) !== null);
        return tenantDifference ||
          gatewayRuleSpecificity(b, categories, applications) - gatewayRuleSpecificity(a, categories, applications);
      });
      selected.push(...controls.slice(0, 4));
      const result = selected
        .slice(0, 6)
        .sort((a, b) => Number(a.precedence ?? 0) - Number(b.precedence ?? 0));
      for (const rule of result) usedRules.add(rule);
      return result;
    }
    const seenActions = new Set(selected.map((rule) => stringValue(rule.action)));
    for (const rule of candidates) {
      if (selected.length >= 3) break;
      const action = stringValue(rule.action);
      if (!selected.includes(rule) && !seenActions.has(action)) {
        selected.push(rule);
        seenActions.add(action);
      }
    }
    for (const rule of candidates) {
      if (selected.length >= 3) break;
      if (!selected.includes(rule)) selected.push(rule);
    }
    const result = selected
      .slice(0, 3)
      .sort((a, b) => Number(a.precedence ?? 0) - Number(b.precedence ?? 0));
    for (const rule of result) usedRules.add(rule);
    return result;
  };

  const httpRules = selectForLayer("http");
  const dnsRules = selectForLayer("dns");
  const networkRules = selectForLayer("l4");
  return [...dnsRules, ...networkRules, ...httpRules];
}

function applicationNames(expression: unknown, applications: Map<number, string>): string[] {
  if (typeof expression !== "string") return [];
  const names = new Set<string>();
  const selectorPattern = /app\.(?:ids|hosts_ids|supports_ids)\[\*\][^{}]{0,40}\{([^}]+)\}/gi;
  for (const match of expression.matchAll(selectorPattern)) {
    for (const id of match[1].match(/\b\d+\b/g) ?? []) {
      const name = applications.get(Number(id));
      if (name) names.add(maskUserDefinedNames(name));
    }
  }
  const equalityPattern = /app\.(?:ids|hosts_ids|supports_ids)\[\*\][^=]{0,40}==\s*(\d+)/gi;
  for (const match of expression.matchAll(equalityPattern)) {
    const name = applications.get(Number(match[1]));
    if (name) names.add(maskUserDefinedNames(name));
  }
  const allNames = [...names].sort((a, b) => a.localeCompare(b));
  const priorities = [
    /microsoft|office|windows|azure|onedrive|sharepoint/i,
    /google|gmail|youtube/i,
    /apple|icloud/i,
    /amazon|aws/i,
    /slack|zoom|teams|webex|chatgpt|openai|claude|discord/i,
  ];
  const selected: string[] = [];
  for (const priority of priorities) {
    const name = allNames.find((candidate) => !selected.includes(candidate) && priority.test(candidate));
    if (name) selected.push(name);
  }
  for (const name of allNames) {
    if (selected.length === 5) break;
    if (!selected.includes(name)) selected.push(name);
  }
  return selected;
}

function tenantControlPurpose(rule: ApiItem): string | null {
  const settings = rule.rule_settings;
  const ruleSettings = settings && typeof settings === "object" ? settings as ApiItem : null;
  const headerNames = ruleSettings
    ? [ruleSettings.add_headers, ruleSettings.set_headers]
        .filter((headers): headers is ApiItem => typeof headers === "object" && headers !== null)
        .flatMap((headers) => Object.keys(headers))
        .map((header) => header.toLowerCase())
    : [];
  const tenantHeaders: Array<[RegExp, string]> = [
    [/^x-googapps-allowed-domains$/, "Google Workspace"],
    [/^(restrict-access-to-tenants|restrict-access-context|sec-restrict-tenant-access-policy)$/, "Microsoft 365"],
    [/^x-slack-allowed-workspaces/, "Slack"],
    [/^x-dropbox-allowed-team-ids$/, "Dropbox"],
    [/^chatgpt-allowed-workspace-id$/, "ChatGPT"],
    [/^anthropic-allowed-org-ids$/, "Claude"],
  ];
  for (const [pattern, application] of tenantHeaders) {
    if (headerNames.some((header) => pattern.test(header))) {
      return `${application}のテナント制御（組織で許可したテナント以外の利用を制限）`;
    }
  }
  const name = stringValue(rule.name, "");
  if (/google.*(?:制御|control)|(?:制御|control).*google/i.test(name)) {
    return "Google Workspaceのテナント制御（許可対象ユーザーと組織テナントを限定）";
  }
  return null;
}

async function collectGateway(account: string, token: string): Promise<CaseSection> {
  const label = "Gateway Policy";
  try {
    const [rulesResponse, categoriesResponse, applicationsResult] = await Promise.all([
      fetchEnvelope(`/accounts/${account}/gateway/rules`, token),
      fetchEnvelope(`/accounts/${account}/gateway/categories`, token),
      fetchPagedItems(`/accounts/${account}/gateway/app_types?per_page=1000`, token, 1000, 100)
        .catch(() => ({ items: [], truncated: false })),
    ]);
    const categoryMap = new Map<number, string>();
    for (const category of asItems(categoriesResponse.result)) {
      if (typeof category.id === "number" && typeof category.name === "string") {
        categoryMap.set(category.id, category.name);
      }
      if (Array.isArray(category.subcategories)) {
        for (const subcategory of asItems(category.subcategories)) {
          if (typeof subcategory.id === "number" && typeof subcategory.name === "string") {
            categoryMap.set(subcategory.id, subcategory.name);
          }
        }
      }
    }

    const applicationMap = new Map<number, string>();
    for (const application of applicationsResult.items) {
      if (
        typeof application.id === "number" &&
        typeof application.application_type_id === "number" &&
        typeof application.name === "string"
      ) {
        applicationMap.set(application.id, application.name);
      }
    }

    const enabledRules = asItems(rulesResponse.result)
      .filter((rule) => rule.enabled === true)
      .sort((a, b) => Number(a.precedence ?? 0) - Number(b.precedence ?? 0));
    const rules = selectRepresentativeRules(enabledRules, categoryMap, applicationMap);
    const facts = rules.map((rule, index) => {
      const policyName = anonymizeFreeText(stringValue(rule.name, `Policy ${index + 1}`));
      const action = stringValue(rule.action);
      const conditions = [
        ["対象通信", rule.traffic],
        ["対象ユーザー", rule.identity],
        ["要求する端末状態", rule.device_posture],
      ]
        .filter(([, value]) => typeof value === "string" && value.length > 0)
        .map(([name, value]) => `${name}: ${redactExpression(value, categoryMap, applicationMap)}`)
        .join(" / ");
      const apps = isDoNotInspectAction(action) || isDoNotScanAction(action)
        ? applicationNames(rule.traffic, applicationMap)
        : [];
      const purpose = tenantControlPurpose(rule);
      return [
        `代表ポリシー${index + 1}「${policyName}」: レイヤー=${gatewayLayer(rule.filters)}`,
        `アクション=${gatewayAction(rule.action)}`,
        conditions || "追加条件なし",
        apps.length > 0 ? `対象となる主要Application=${apps.join("、")}` : "",
        purpose ? `設計用途=${purpose}` : "",
      ].filter(Boolean).join(" / ");
    });

    return {
      key: "gateway",
      label,
      status: "collected",
      facts: facts.length > 0 ? facts : ["有効な代表ポリシーはありません。"],
      note: [
        enabledRules.length > rules.length
          ? "Test・検証用途を除外し、DNS・Networkは各最大3件、HTTPはDo Not Inspect・Do Not Scan各1件と制御系最大4件を抽出しました。"
          : "",
        applicationsResult.truncated
          ? "Gateway Application一覧は100ページで取得を打ち切り、未解決IDをマスキングしました。"
          : "",
      ].filter(Boolean).join(" ") || undefined,
    };
  } catch {
    return unavailable("gateway", label);
  }
}

function configuredEgressFamilies(rule: ApiItem): string[] {
  const settings = rule.rule_settings;
  const ruleSettings = settings && typeof settings === "object" ? settings as ApiItem : null;
  const egress = ruleSettings?.egress;
  const config = egress && typeof egress === "object" ? egress as ApiItem : null;
  if (!config) return [];
  const families: string[] = [];
  if (typeof config.ipv4 === "string" && config.ipv4) families.push("固定IPv4");
  if (typeof config.ipv4_fallback === "string" && config.ipv4_fallback) families.push("Fallback IPv4");
  if (typeof config.ipv6 === "string" && config.ipv6) families.push("固定IPv6");
  return families;
}

async function collectEgress(account: string, token: string): Promise<CaseSection> {
  const label = "Egress Policy";
  try {
    const response = await fetchEnvelope(`/accounts/${account}/gateway/rules`, token);
    const rules = asItems(response.result)
      .filter((rule) => rule.enabled === true)
      .filter((rule) => Array.isArray(rule.filters) && rule.filters.includes("egress"))
      .filter((rule) => configuredEgressFamilies(rule).length > 0)
      .filter((rule) => !/test|poc|テスト|検証/i.test(stringValue(rule.name, "")))
      .sort((a, b) => Number(a.precedence ?? 0) - Number(b.precedence ?? 0));
    const facts = rules.slice(0, 10).map((rule, index) => {
      const conditions = [
        ["対象通信", rule.traffic],
        ["対象ユーザー", rule.identity],
        ["要求する端末状態", rule.device_posture],
      ]
        .filter(([, value]) => typeof value === "string" && value.length > 0)
        .map(([name, value]) =>
          `${name}: ${redactExpression(value, new Map()).replace(/\b\d+\b/g, "[SELECTOR_ID]")}`
        )
        .join(" / ");
      const families = configuredEgressFamilies(rule);
      return [
        `Egressポリシー${index + 1}「${anonymizeFreeText(stringValue(rule.name, `Policy ${index + 1}`))}」`,
        `送信方式=${families.length > 0 ? "指定した出口IPから送信" : "Cloudflare Gatewayの共有出口から送信"}`,
        conditions || "追加条件なし",
        `出口IP設定=${families.join("、") || "明示設定なし"}`,
      ].join(" / ");
    });
    return {
      key: "egress",
      label,
      status: "collected",
      facts: [
        `有効なEgressポリシー総数: ${rules.length}`,
        ...facts,
      ],
      note: rules.length > 10
        ? "共有出口へ送信するデフォルトのEgress除外ポリシーを除き、固定出口IPを指定するポリシーを優先順位順に10件まで表示しています。出口IPアドレス自体は保存していません。"
        : "共有出口へ送信するデフォルトのEgress除外ポリシーは除外しています。出口IPアドレス自体は保存していません。",
    };
  } catch {
    return unavailable("egress", label);
  }
}

function destinationName(item: ApiItem, fallback: string): string {
  const comment = anonymizeFreeText(stringValue(item.comment, ""));
  return comment || fallback;
}

async function collectNetwork(account: string, token: string): Promise<CaseSection> {
  const label = "Network & Routes";
  try {
    const [tunnelResult, routeResult, hostnameOutcome] = await Promise.all([
      fetchPagedItems(`/accounts/${account}/cfd_tunnel?is_deleted=false&per_page=1000`, token, 1000),
      fetchPagedItems(`/accounts/${account}/teamnet/routes?is_deleted=false&per_page=1000`, token, 1000),
      fetchPagedItems(`/accounts/${account}/zerotrust/routes/hostname?is_deleted=false&per_page=1000`, token, 1000)
        .then((result) => ({ result, available: true }))
        .catch(() => ({ result: { items: [], truncated: false }, available: false })),
    ]);
    const hostnameResult = hostnameOutcome.result;
    const destinations = [
      ...routeResult.items.map((route, index) => destinationName(route, `Private network ${index + 1}`)),
      ...hostnameResult.items.map((route, index) => destinationName(route, `Private hostname ${index + 1}`)),
    ].filter((value, index, values) => values.indexOf(value) === index);
    const routeCount = routeResult.items.length + hostnameResult.items.length;
    const truncated = tunnelResult.truncated || routeResult.truncated || hostnameResult.truncated;

    return {
      key: "network",
      label,
      status: "collected",
      facts: [
        `Tunnel総数: ${tunnelResult.items.length}`,
        `Route総数: ${routeCount}`,
        `接続先リソース: ${destinations.slice(0, 10).join(" / ") || "設定なし"}`,
      ],
      note: [
        !hostnameOutcome.available ? "Hostname Routeは取得できず、Route総数に含まれていません。" : "",
        truncated ? "一部の一覧は10ページで集計を打ち切りました。" : "",
        destinations.length > 10 ? "接続先リソースは先頭10件を表示しています。" : "",
      ].filter(Boolean).join(" ") || undefined,
    };
  } catch {
    return unavailable("network", label);
  }
}

function profileGrouping(match: unknown, isDefault: boolean): string {
  if (isDefault) return "他のDevice Profileの適用条件に一致しない端末・ユーザー";
  if (typeof match !== "string" || !match.trim()) return "適用条件なし";
  const groups: string[] = [];
  if (/identity\.groups\./.test(match)) groups.push("IdPグループ");
  if (/identity\.email/.test(match)) groups.push("ユーザーまたはメール属性");
  if (/identity\.saml_attributes/.test(match)) groups.push("SAML属性");
  if (/identity\.service_token/.test(match)) groups.push("Service Token");
  if (/os\.name/.test(match)) groups.push("OS種別");
  if (/os\.version/.test(match)) groups.push("OSバージョン");
  if (/\bnetwork\b/.test(match)) groups.push("接続元ネットワーク");
  return groups.join(" + ") || "その他の端末条件";
}

function itemCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function splitTunnelCategories(value: unknown): string[] {
  const categories = new Set<string>();
  for (const item of asItems(value)) {
    const address = stringValue(item.address, "");
    const host = stringValue(item.host, "").toLowerCase();
    const description = stringValue(item.description, "").toLowerCase();
    const combined = `${host} ${description}`;
    if (/^(10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address)) {
      categories.add("プライベートネットワーク");
    } else if (/^(127\.|169\.254\.)/.test(address)) {
      categories.add("ローカル・リンクローカル通信");
    } else if (address) {
      categories.add("パブリックIP宛通信");
    }
    if (/microsoft|office|windows|azure|sharepoint|onedrive/.test(combined)) {
      categories.add("Microsoftクラウドサービス");
    } else if (/google|gmail|youtube/.test(combined)) {
      categories.add("Googleサービス");
    } else if (/apple|icloud/.test(combined)) {
      categories.add("Appleサービス");
    } else if (/amazon|aws/.test(combined)) {
      categories.add("AWS・Amazonサービス");
    } else if (/zoom|webex|teams|slack/.test(combined)) {
      categories.add("会議・コラボレーションサービス");
    } else if (host) {
      categories.add("組織固有またはその他のドメイン");
    }
  }
  return [...categories];
}

function profileManagedNetworkNames(match: unknown): Set<string> {
  if (typeof match !== "string" || !/\bnetwork\b/.test(match)) return new Set();
  const names = new Set<string>();
  for (const result of match.matchAll(/["']([^"']+)["']/g)) {
    names.add(result[1]);
  }
  return names;
}

function configuredFallbackDomainCount(value: unknown): number {
  return asItems(value).filter((domain) =>
    Array.isArray(domain.dns_server) &&
    domain.dns_server.some((server) => typeof server === "string" && server.trim().length > 0)
  ).length;
}

function profileSummary(
  profile: ApiItem,
  isDefault: boolean,
  index: number,
  managedNetworks: Array<{ name: string; label: string }>
): string {
  const name = isDefault
    ? "デフォルト"
    : anonymizeFreeText(stringValue(profile.name, `Profile ${index + 1}`));
  const settings: string[] = [
    `適用対象=${profileGrouping(profile.match, isDefault)}`,
    `状態=${profile.enabled === false ? "無効" : "有効"}`,
  ];
  const serviceMode = profile.service_mode_v2;
  if (serviceMode && typeof serviceMode === "object") {
    const mode = (serviceMode as ApiItem).mode;
    if (typeof mode === "string" && mode) settings.push(`接続モード=${mode}`);
    const port = (serviceMode as ApiItem).port;
    if (typeof port === "number") settings.push(`Local Proxy Port=${port}`);
  }
  if (typeof profile.allow_mode_switch === "boolean") {
    settings.push(`接続モード変更=${profile.allow_mode_switch ? "許可" : "禁止"}`);
  }
  if (typeof profile.switch_locked === "boolean") {
    settings.push(`利用者による切断=${profile.switch_locked ? "禁止" : "許可"}`);
  }
  if (typeof profile.allowed_to_leave === "boolean") {
    settings.push(`組織からの離脱=${profile.allowed_to_leave ? "許可" : "禁止"}`);
  }
  if (typeof profile.auto_connect === "number") {
    settings.push(`自動再接続=${profile.auto_connect}秒`);
  }
  if (typeof profile.captive_portal === "number") {
    settings.push(`Captive Portal検出=${profile.captive_portal}秒`);
  }
  if (typeof profile.tunnel_protocol === "string" && profile.tunnel_protocol) {
    settings.push(`Tunnel Protocol=${profile.tunnel_protocol}`);
  }
  const includes = itemCount(profile.include);
  const excludes = itemCount(profile.exclude);
  if (includes > 0) settings.push(`Split Tunnel Include=${includes}件`);
  if (excludes > 0) settings.push(`Split Tunnel Exclude=${excludes}件`);
  const includeCategories = splitTunnelCategories(profile.include);
  const excludeCategories = splitTunnelCategories(profile.exclude);
  if (includeCategories.length > 0) {
    settings.push(`Include宛先概要=${includeCategories.join("、")}`);
  }
  if (excludeCategories.length > 0) {
    settings.push(`Exclude宛先概要=${excludeCategories.join("、")}`);
  }
  if (typeof profile.match === "string") {
    const matchedNetworkNames = profileManagedNetworkNames(profile.match);
    const appliedNetworks = managedNetworks
      .filter((network) => matchedNetworkNames.has(network.name))
      .map((network) => network.label);
    if (appliedNetworks.length > 0) {
      settings.push(`Managed Network条件=${appliedNetworks.join("、")}`);
    }
  }
  const fallbackDomains = configuredFallbackDomainCount(profile.fallback_domains);
  if (Array.isArray(profile.fallback_domains)) {
    settings.push(`DNSサーバー指定済みCustom Local Domain Fallback=${fallbackDomains}件`);
  }
  const searchSuffixes = itemCount(profile.dns_search_suffixes);
  if (Array.isArray(profile.dns_search_suffixes)) settings.push(`DNS Search Suffix=${searchSuffixes}件`);
  if (typeof profile.disable_auto_fallback === "boolean") {
    settings.push(`未指定DNSへの自動Fallback=${profile.disable_auto_fallback ? "無効" : "有効"}`);
  }
  if (typeof profile.exclude_office_ips === "boolean") {
    settings.push(`Microsoft 365通信のSplit Tunnel除外=${profile.exclude_office_ips ? "有効" : "無効"}`);
  }
  if (typeof profile.uninstall_protection === "boolean") {
    settings.push(`アンインストール保護=${profile.uninstall_protection ? "有効" : "無効"}`);
  }
  if (typeof profile.precedence === "number") settings.push(`優先順位=${profile.precedence}`);
  return `WARP Device Profile「${name}」: ${settings.join(" / ")}`;
}

async function collectProfiles(account: string, token: string): Promise<CaseSection> {
  const label = "Device & Access Control";
  try {
    const [defaultResponse, customResponse, networksOutcome] = await Promise.all([
      fetchEnvelope(`/accounts/${account}/devices/policy`, token),
      fetchEnvelope(`/accounts/${account}/devices/policies?profile_type=warp`, token),
      fetchEnvelope(`/accounts/${account}/devices/networks`, token)
        .then((response) => ({ response, available: true }))
        .catch(() => ({ response: { result: [] } as ApiEnvelope, available: false })),
    ]);
    const defaultProfile = defaultResponse.result && typeof defaultResponse.result === "object"
      ? defaultResponse.result as ApiItem
      : null;
    const customProfiles = asItems(customResponse.result)
      .filter((profile) => profile.profile_type !== "browser_extension")
      .sort((a, b) => Number(a.precedence ?? 0) - Number(b.precedence ?? 0));
    const profiles = defaultProfile ? [defaultProfile, ...customProfiles] : customProfiles;
    const managedNetworks = asItems(networksOutcome.response.result)
      .map((network, index) => ({
        name: stringValue(network.name, ""),
        label: `Managed Network ${index + 1}`,
        type: stringValue(network.type, "方式不明"),
      }))
      .filter((network) => network.name);
    const profileFacts = profiles
      .slice(0, 10)
      .map((profile, index) => profileSummary(profile, profile === defaultProfile, index, managedNetworks));
    const managedNetworkFacts = managedNetworks.map((network) => {
      const appliedProfiles = profiles
        .map((profile, index) => ({ profile, label: profile === defaultProfile ? "デフォルトProfile" : `カスタムProfile ${index}` }))
        .filter(({ profile }) => profileManagedNetworkNames(profile.match).has(network.name))
        .map(({ label: profileLabel }) => profileLabel);
      return `${network.label}: 検出方式=${network.type} / 用途=管理下ネットワークを識別して端末設定を切り替える / Device Profile適用=${appliedProfiles.join("、") || "設定なし"}`;
    });
    return {
      key: "profiles",
      label,
      status: "collected",
      facts: [
        `WARP Device Profile総数: ${profiles.length}`,
        ...profileFacts,
        `Managed Network総数: ${managedNetworks.length}`,
        ...managedNetworkFacts,
      ],
      note: [
        profiles.length > 10 ? "Device Profileの詳細は優先順位順に10件まで表示しています。" : "",
        !networksOutcome.available ? "Managed Networkは権限不足またはAPIエラーにより取得できませんでした。" : "",
      ].filter(Boolean).join(" ") || undefined,
    };
  } catch {
    return unavailable("profiles", label);
  }
}

function identityProviderType(type: unknown): string {
  const value = stringValue(type, "方式不明");
  const labels: Record<string, string> = {
    azureAD: "Microsoft Entra ID",
    google: "Google Workspace",
    okta: "Okta",
    onetimepin: "One-time PIN",
    saml: "SAML",
    oidc: "OpenID Connect",
    github: "GitHub",
    linkedin: "LinkedIn",
  };
  return labels[value] ?? value;
}

async function collectIdentityProviders(account: string, token: string): Promise<CaseSection> {
  const label = "Identity Provider";
  try {
    const result = await fetchPagedItems(
      `/accounts/${account}/access/identity_providers?per_page=1000`,
      token,
      1000,
      10
    );
    const providers = result.items;
    const facts = providers.slice(0, 20).map((provider, index) => {
      const scim = provider.scim_config;
      const scimConfig = scim && typeof scim === "object" ? scim as ApiItem : null;
      const config = provider.config && typeof provider.config === "object" ? provider.config as ApiItem : null;
      const providerType = stringValue(provider.type, "");
      const providerName = providerType === "saml"
        ? anonymizeFreeText(stringValue(provider.name, `SAML IdP ${index + 1}`))
        : "";
      return [
        `IdP ${index + 1}`,
        `方式=${identityProviderType(providerType)}`,
        providerName ? `名称=${providerName}` : "",
        `SCIM=${scimConfig?.enabled === true ? "有効" : "無効または未設定"}`,
        `API編集=${provider.read_only === true ? "読み取り専用" : "編集可能"}`,
        `グループ連携=${config?.support_groups === true ? "対応" : "未確認"}`,
      ].join(" / ");
    });
    return {
      key: "identity",
      label,
      status: "collected",
      facts: [`IdP連携総数: ${providers.length}`, ...facts],
      note: providers.length > 20 ? "IdPの詳細は20件まで表示しています。接続先URL、Tenant ID、Client ID、証明書、Secretは保存していません。" : "接続先URL、Tenant ID、Client ID、証明書、Secretは保存していません。",
    };
  } catch {
    return unavailable("identity", label);
  }
}

function posturePlatforms(match: unknown): string[] {
  const platforms = new Set<string>();
  for (const item of asItems(match)) {
    if (typeof item.platform === "string" && item.platform) platforms.add(item.platform);
  }
  return [...platforms];
}

async function collectDevicePosture(account: string, token: string): Promise<CaseSection> {
  const label = "Device Posture";
  try {
    const [postureResponse, integrationsOutcome, gatewayResponse] = await Promise.all([
      fetchEnvelope(`/accounts/${account}/devices/posture`, token),
      fetchEnvelope(`/accounts/${account}/devices/posture/integration`, token)
        .then((response) => ({ response, available: true }))
        .catch(() => ({ response: { result: [] } as ApiEnvelope, available: false })),
      fetchEnvelope(`/accounts/${account}/gateway/rules`, token)
        .catch(() => ({ result: [] } as ApiEnvelope)),
    ]);
    const rules = asItems(postureResponse.result);
    const integrations = asItems(integrationsOutcome.response.result);
    const integrationTypes = new Map<string, string>();
    for (const integration of integrations) {
      const id = stringValue(integration.id, "");
      if (id) integrationTypes.set(id, stringValue(integration.type, "外部Provider"));
    }
    const detailedRules = rules.slice(0, 70);
    const postureFacts = detailedRules.map((rule, index) => {
      const input = rule.input && typeof rule.input === "object" ? rule.input as ApiItem : null;
      const integrationId = stringValue(input?.connection_id, "");
      const platforms = posturePlatforms(rule.match);
      const safeConditions: string[] = [];
      if (typeof input?.operator === "string") safeConditions.push(`判定=${input.operator}`);
      if (typeof input?.version === "string") safeConditions.push(`基準Version=${input.version}`);
      if (typeof input?.running === "boolean") safeConditions.push(`実行状態=${input.running ? "実行中を要求" : "停止を要求"}`);
      return [
        `Posture Check ${index + 1}`,
        `名称=${anonymizeFreeText(stringValue(rule.name, `Check ${index + 1}`))}`,
        `種別=${stringValue(rule.type, "不明")}`,
        `状態=${rule.enabled === false ? "無効" : "有効"}`,
        `対象OS=${platforms.join("、") || "共通"}`,
        typeof rule.expiration === "string" ? `再評価間隔=${rule.expiration}` : "",
        ...safeConditions,
        integrationId ? `Service Provider=${integrationTypes.get(integrationId) ?? "外部Provider連携"}` : "",
      ].filter(Boolean).join(" / ");
    });
    const gatewayUsage = asItems(gatewayResponse.result).filter(
      (rule) => rule.enabled === true && typeof rule.device_posture === "string" && rule.device_posture.trim()
    ).length;
    const providerFacts = integrations.slice(0, 20).map((integration, index) =>
      `Posture Provider ${index + 1}: 種別=${stringValue(integration.type, "不明")} / 同期間隔=${stringValue(integration.interval, "未指定")}`
    );
    return {
      key: "posture",
      label,
      status: "collected",
      facts: [
        `Device Posture Check総数: ${rules.length}`,
        `個別記載するPosture Check数: ${detailedRules.length}`,
        `有効なPosture Check: ${rules.filter((rule) => rule.enabled !== false).length}`,
        `Device Posture条件を利用するGatewayポリシー: ${gatewayUsage}`,
        ...postureFacts,
        `Posture Service Provider総数: ${integrations.length}`,
        ...providerFacts,
      ],
      note: [
        "ファイルパス、証明書情報、シリアル、組織固有ドメイン、Provider認証設定は保存していません。",
        rules.length > detailedRules.length ? "Posture Checkの個別情報は70件まで表示しています。" : "",
        integrations.length > 20 ? "Posture Service Providerの個別情報は20件まで表示しています。" : "",
        !integrationsOutcome.available ? "Posture Service Providerは権限不足またはAPIエラーにより取得できませんでした。" : "",
      ].filter(Boolean).join(" "),
    };
  } catch {
    return unavailable("posture", label);
  }
}

function enabledProfileNames(profiles: ApiItem[], type: string): string[] {
  return profiles
    .filter((profile) => profile.type === type)
    .filter((profile) => {
      const entries = [
        ...(Array.isArray(profile.entries) ? profile.entries : []),
        ...(Array.isArray(profile.shared_entries) ? profile.shared_entries : []),
      ];
      return asItems(entries).some((entry) => entry.enabled === true);
    })
    .map((profile) => anonymizeFreeText(stringValue(profile.name)))
    .filter(Boolean);
}

async function collectDlp(account: string, token: string): Promise<CaseSection> {
  const label = "DLP";
  try {
    const response = await fetchEnvelope(`/accounts/${account}/dlp/profiles`, token);
    const profiles = asItems(response.result);
    const predefined = enabledProfileNames(profiles, "predefined");
    const custom = enabledProfileNames(profiles, "custom");
    return {
      key: "dlp",
      label,
      status: "collected",
      facts: [
        `有効な定義済み検出Profile: ${predefined.join(" / ") || "該当なし"}`,
        `有効なカスタム検出Profile: ${custom.join(" / ") || "該当なし"}`,
      ],
    };
  } catch {
    return unavailable("dlp", label);
  }
}

async function collectCasb(account: string, token: string): Promise<CaseSection> {
  const label = "CASB";
  try {
    const result = await fetchPagedItems(
      `/accounts/${account}/one/integrations?page_size=100`,
      token,
      100
    );
    const integrations = result.items.map((integration) => {
      const name = anonymizeFreeText(stringValue(integration.name, "名称不明"));
      const application = integration.application;
      const app = application && typeof application === "object"
        ? anonymizeFreeText(stringValue(
            (application as ApiItem).display_name ??
              (application as ApiItem).name ??
              (application as ApiItem).slug ??
              (application as ApiItem).type,
            ""
          ))
        : "";
      return app ? `${name}（${app}）` : name;
    });
    return {
      key: "casb",
      label,
      status: "collected",
      facts: [`インテグレーション先: ${integrations.join(" / ") || "設定なし"}`],
      note: result.truncated ? "1,000件で集計を打ち切りました。" : undefined,
    };
  } catch {
    return unavailable("casb", label);
  }
}

function positiveCount(section: CaseSection | undefined, prefix: string): boolean {
  return !!section?.facts.some((fact) => new RegExp(`${prefix}:\\s*[1-9]\\d*`).test(fact));
}

function buildArchitecture(sections: CaseSection[]): string {
  const byKey = new Map(sections.map((section) => [section.key, section]));
  const lines = [
    "flowchart LR",
    '  User["利用者 / 端末"] --> Client["Cloudflare One Client"]',
    '  Client --> Edge["Cloudflare Zero Trust"]',
    '  User --> Endpoint["Cloudflare Endpoint指定<br/>DNS / Proxy / Browser"]',
    "  Endpoint --> Edge",
  ];
  if (byKey.get("gateway")?.status === "collected") {
    lines.push('  Edge --> Gateway["Gateway Policy"]', '  Gateway --> Internet["Internet / SaaS"]');
  }
  if (positiveCount(byKey.get("egress"), "有効なEgressポリシー総数")) {
    lines.push('  Gateway --> Egress["Egress Policy<br/>送信元IP制御"]', '  Egress --> Internet');
  }
  if (positiveCount(byKey.get("identity"), "IdP連携総数")) {
    lines.push('  IdP["Identity Provider"] --> Edge');
  }
  if (positiveCount(byKey.get("posture"), "有効なPosture Check")) {
    lines.push('  DeviceState["Device Posture"] --> Gateway');
  }
  if (positiveCount(byKey.get("network"), "Tunnel総数")) {
    lines.push('  Edge --> Tunnel["Cloudflare Tunnel"]');
    if (positiveCount(byKey.get("network"), "Route総数")) {
      lines.push('  Tunnel --> Private["接続先リソース"]');
    }
  }
  if (
    byKey.get("gateway")?.status === "collected" &&
    byKey.get("dlp")?.facts.some((fact) => !fact.endsWith("該当なし"))
  ) {
    lines.push('  Gateway -.-> DLP["DLP Inspection"]');
  }
  if (byKey.get("casb")?.facts.some((fact) => !fact.endsWith("設定なし"))) {
    lines.push('  Edge --> CASB["CASB Integrations"]');
  }
  return lines.join("\n");
}

export async function collectZeroTrustSnapshot(
  accountId: string,
  token: string
): Promise<ZeroTrustSnapshot> {
  const account = encodeURIComponent(accountId);
  const sections = await Promise.all([
    collectGateway(account, token),
    collectEgress(account, token),
    collectNetwork(account, token),
    collectProfiles(account, token),
    collectIdentityProviders(account, token),
    collectDevicePosture(account, token),
    collectDlp(account, token),
    collectCasb(account, token),
  ]);
  const limitations = [
    "取得内容は記事作成用の構成要約であり、すべての設定項目を網羅するものではありません。",
    "Gateway条件内のドメイン、IP/CIDR、ID、文字列値は匿名化しています。",
    "DLP Profile名、CASB Integration名、Network Routeのコメントは自動除去後の値です。公開前に必ず確認してください。",
    "権限不足または未契約の製品は「未取得」と表示されます。",
  ];
  for (const section of sections) {
    if (section.status === "collected" && section.note) {
      limitations.push(`${section.label}: ${section.note}`);
    }
  }

  return {
    collectedAt: new Date().toISOString(),
    sections,
    architecture: buildArchitecture(sections),
    limitations,
  };
}

export function anonymizeFreeText(value: string): string {
  return maskUserDefinedNames(value)
    .replace(/\b[A-Fa-f0-9]{32}\b/g, "[ACCOUNT_ID]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[RESOURCE_ID]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]")
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[URL]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?\b/g, "[IP_OR_CIDR]")
    .replace(/\b(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?:\/\d{1,3})?\b/gi, "[IP_OR_CIDR]")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "[PHONE]")
    .replace(/\b(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g, "[DOMAIN]")
    .trim();
}
