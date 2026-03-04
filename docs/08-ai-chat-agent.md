# 08 - AI チャットエージェント設計

> **実装状況:** チャット Q&A ウィジェットは実装済み（記事ページ内に `ChatWidget` コンポーネントとして組み込み）。API レイヤーは **Hono** フレームワークで実装し、`streamSSE` ヘルパーで SSE ストリーミング応答を実現。Workers AI (Llama 3.3 70B, temperature 0.3) で記事コンテキストベースの応答を生成。Llama Guard 3 8B によるコンテンツモデレーション、Vectorize RAG による関連コンテキスト取得も稼働中。Durable Objects / WebSocket / Turnstile / AI Gateway は未使用。

## 1. 概要

ブログ記事ページに埋め込まれた AI チャットウィジェット。読者がブログ記事の内容について質問し、AI がコンテキストを理解した上で回答する。

**主な機能:**
- 記事内容に基づいた Q&A（RAG ベース）
- リアルタイムストリーミング応答
- 匿名利用可能（Turnstile で保護）
- SE/Admin による人間の回答も可能
- 不適切発言の自動検出 & ブロック
- 全会話ログの管理者閲覧

---

## 2. アーキテクチャ

```
                    ┌──────────────────┐
                    │   ユーザー        │
                    │  (ブラウザ)       │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │    Turnstile     │  ← ボット検証（初回 + 定期）
                    │   Verification   │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │   WAF / Rate     │  ← L7 保護 + レート制限
                    │    Limiting      │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │   WebSocket      │
                    │   Connection     │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │       Durable Object        │
              │        (ChatRoom)           │
              │                             │
              │  ┌───────────────────────┐  │
              │  │  1. メッセージ受信     │  │
              │  │  2. コンテンツ検査     │──┼──→ Llama Guard (モデレーション)
              │  │  3. コンテキスト取得   │──┼──→ Vectorize (RAG 検索)
              │  │  4. AI 応答生成       │──┼──→ AI Gateway → Workers AI
              │  │  5. 応答ストリーム    │  │
              │  │  6. ログ保存          │──┼──→ Queues → D1
              │  └───────────────────────┘  │
              │                             │
              │  State: 会話履歴、Rate情報  │
              └─────────────────────────────┘
```

---

## 3. Durable Object: ChatRoom

### 3.1 クラス設計

```typescript
// workers/chat-worker.ts

interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'se' | 'admin' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    latencyMs?: number;
    sources?: string[];
    flagged?: boolean;
    flagReason?: string;
  };
}

interface ChatRoomState {
  postId: string;
  postTitle: string;
  postContent: string; // 最初にロードしてキャッシュ
  threadId: string;
  messages: ChatMessage[];
  messageCount: number;
  isBlocked: boolean;
  createdAt: string;
}

export class ChatRoom implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, { ip: string; userId?: string }> = new Map();
  private chatState: ChatRoomState | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket アップグレード
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    // REST API（SE/Admin からの回答投稿）
    if (url.pathname === "/admin-reply" && request.method === "POST") {
      return this.handleAdminReply(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const userId = request.headers.get("X-User-Id");

    this.state.acceptWebSocket(server);
    this.sessions.set(server, { ip, userId });

    // 初期化: 記事コンテキストをロード
    if (!this.chatState) {
      await this.initializeChatRoom(request);
    }

    // 既存メッセージを送信
    server.send(JSON.stringify({
      type: 'history',
      messages: this.chatState?.messages.slice(-20) || [] // 直近20件
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const session = this.sessions.get(ws);
    if (!session) return;

    try {
      const data = JSON.parse(message as string);

      switch (data.type) {
        case 'message':
          await this.handleUserMessage(ws, session, data);
          break;
        case 'turnstile_token':
          await this.verifyTurnstile(ws, session, data.token);
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'メッセージの処理中にエラーが発生しました'
      }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
  }

  private async handleUserMessage(
    ws: WebSocket,
    session: { ip: string; userId?: string },
    data: { content: string; turnstileToken?: string }
  ) {
    // --- STEP 1: レート制限チェック ---
    const rateLimitKey = `rate:${session.ip}`;
    const rateData = await this.state.storage.get<{ count: number; resetAt: number }>(rateLimitKey);
    
    if (rateData && rateData.count >= 10 && Date.now() < rateData.resetAt) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'メッセージの送信回数が制限に達しました。しばらくお待ちください。'
      }));
      return;
    }

    // レート更新
    const newCount = (rateData && Date.now() < rateData.resetAt) ? rateData.count + 1 : 1;
    await this.state.storage.put(rateLimitKey, {
      count: newCount,
      resetAt: rateData?.resetAt || Date.now() + 60000
    });

    // --- STEP 2: コンテンツモデレーション ---
    const moderationResult = await this.moderateContent(data.content);
    if (!moderationResult.safe) {
      // フラグ付きメッセージとして記録
      const flaggedMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: data.content,
        timestamp: new Date().toISOString(),
        metadata: { flagged: true, flagReason: moderationResult.reason }
      };
      
      await this.logMessage(flaggedMsg);

      ws.send(JSON.stringify({
        type: 'moderation_block',
        message: 'このメッセージは利用規約に反する可能性があるため送信できません。'
      }));
      return;
    }

    // --- STEP 3: ユーザーメッセージを保存 & ブロードキャスト ---
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: data.content,
      timestamp: new Date().toISOString()
    };
    
    this.chatState!.messages.push(userMsg);
    this.broadcastToAll({ type: 'message', message: userMsg });
    await this.logMessage(userMsg);

    // --- STEP 4: RAG コンテキスト取得 ---
    const relevantContext = await this.getRelevantContext(data.content);

    // --- STEP 5: AI 応答生成（ストリーミング） ---
    await this.generateAIResponse(ws, data.content, relevantContext);
  }

  private async moderateContent(content: string): Promise<{ safe: boolean; reason?: string }> {
    try {
      // Llama Guard でコンテンツ安全性を評価
      const result = await this.env.AI.run(
        "@cf/meta/llama-guard-3-8b",
        {
          messages: [
            { role: "user", content }
          ]
        }
      );

      const output = result.response.trim().toLowerCase();
      
      if (output.includes('unsafe')) {
        return { safe: false, reason: `Content flagged by Llama Guard: ${output}` };
      }

      // 追加チェック: 競合他社への誘導、スパムリンク等
      if (containsSpamPatterns(content)) {
        return { safe: false, reason: 'Spam pattern detected' };
      }

      return { safe: true };
    } catch (error) {
      // モデレーション失敗時は通過させる（フォールスネガティブ寄り）
      console.error('Moderation error:', error);
      return { safe: true };
    }
  }

  private async getRelevantContext(query: string): Promise<string> {
    // 1. クエリを Embedding に変換
    const embedding = await this.env.AI.run(
      "@cf/baai/bge-large-en-v1.5",
      { text: [query] }
    );

    // 2. Vectorize で類似チャンクを検索
    const results = await this.env.VECTORIZE_INDEX.query(
      embedding.data[0],
      {
        topK: 5,
        filter: { postId: this.chatState!.postId }, // 現在の記事に限定
        returnMetadata: true
      }
    );

    // 3. 関連コンテキストを構成
    const contextParts = results.matches.map(match => {
      return `[関連度: ${(match.score * 100).toFixed(0)}%]\n${match.metadata?.chunkText || ''}`;
    });

    return contextParts.join('\n\n---\n\n');
  }

  private async generateAIResponse(
    ws: WebSocket,
    userQuery: string,
    context: string
  ) {
    const startTime = Date.now();

    // 会話履歴（直近5往復）
    const recentHistory = this.chatState!.messages
      .slice(-10)
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
        content: m.content
      }));

    const systemPrompt = `あなたは Cloudflare の技術ブログ「${this.chatState!.postTitle}」に関する Q&A アシスタントです。

以下のルールに従ってください:
1. 記事の内容とコンテキストに基づいて正確に回答してください
2. 記事に書かれていない内容については「この記事では触れられていませんが、Cloudflare のドキュメント (https://developers.cloudflare.com/) をご確認ください」と案内してください
3. 日本語で丁寧に回答してください
4. 技術的に不正確な情報は提供しないでください
5. Cloudflare の競合製品との比較質問には中立的に対応してください
6. 回答は簡潔に、必要に応じてコード例を含めてください

記事コンテキスト:
${context}`;

    try {
      // AI Gateway 経由でストリーミング応答
      const stream = await this.env.AI.run(
        "@cf/meta/llama-3.1-70b-instruct",
        {
          messages: [
            { role: "system", content: systemPrompt },
            ...recentHistory,
            { role: "user", content: userQuery }
          ],
          max_tokens: 1024,
          temperature: 0.7,
          stream: true
        }
      );

      let fullResponse = '';
      let tokensUsed = 0;

      // ストリーミング送信
      ws.send(JSON.stringify({ type: 'ai_start' }));

      for await (const chunk of stream as AsyncIterable<{ response: string }>) {
        if (chunk.response) {
          fullResponse += chunk.response;
          tokensUsed++;
          ws.send(JSON.stringify({
            type: 'ai_chunk',
            content: chunk.response
          }));
        }
      }

      const latencyMs = Date.now() - startTime;

      ws.send(JSON.stringify({ type: 'ai_end' }));

      // AI メッセージを保存
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: fullResponse,
        timestamp: new Date().toISOString(),
        metadata: {
          model: '@cf/meta/llama-3.1-70b-instruct',
          tokensUsed,
          latencyMs,
          sources: [] // Vectorize の検索結果から postId を抽出
        }
      };

      this.chatState!.messages.push(aiMsg);
      await this.logMessage(aiMsg);

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '回答の生成中にエラーが発生しました。しばらくしてから再度お試しください。'
      }));
    }
  }

  private async logMessage(msg: ChatMessage) {
    // Queue 経由で D1 に非同期保存
    await this.env.CHAT_LOG_QUEUE.send({
      threadId: this.chatState!.threadId,
      postId: this.chatState!.postId,
      message: msg
    });
  }

  private broadcastToAll(data: object) {
    const json = JSON.stringify(data);
    for (const [ws] of this.sessions) {
      try { ws.send(json); } catch {}
    }
  }

  // ... initializeChatRoom, handleAdminReply 等
}

function containsSpamPatterns(content: string): boolean {
  const spamPatterns = [
    /https?:\/\/(?!developers\.cloudflare\.com|blog\.cloudflare\.com)[^\s]+/gi, // 外部リンク（Cloudflare以外）を多数含む
    /(.)\1{10,}/,  // 同一文字の極端な連続
    /buy|cheap|discount|casino|viagra/i,  // 典型的スパムワード
  ];
  
  const matchCount = spamPatterns.filter(p => p.test(content)).length;
  return matchCount >= 2; // 2つ以上マッチでスパム判定
}
```

---

## 4. Turnstile 統合

### 4.1 フロントエンド実装

```tsx
// app/components/ChatWidget.tsx
import { Turnstile } from '@marsidev/react-turnstile';

export function ChatWidget({ postId, postTitle }: { postId: string; postTitle: string }) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Turnstile 検証成功後に WebSocket 接続
  const handleTurnstileSuccess = useCallback((token: string) => {
    setTurnstileToken(token);
    
    const socket = new WebSocket(
      `wss://blog.cf-se.jp/api/v1/chat?postId=${postId}`
    );

    socket.onopen = () => {
      // Turnstile トークンを送信して認証
      socket.send(JSON.stringify({
        type: 'turnstile_token',
        token
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWSMessage(data);
    };

    setWs(socket);
  }, [postId]);

  const handleWSMessage = (data: any) => {
    switch (data.type) {
      case 'history':
        setMessages(data.messages);
        break;
      case 'message':
        setMessages(prev => [...prev, data.message]);
        break;
      case 'ai_start':
        setIsStreaming(true);
        setMessages(prev => [...prev, { id: 'streaming', role: 'ai', content: '', timestamp: '' }]);
        break;
      case 'ai_chunk':
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.id === 'streaming') {
            last.content += data.content;
          }
          return updated;
        });
        break;
      case 'ai_end':
        setIsStreaming(false);
        break;
      case 'moderation_block':
        // モデレーションブロック通知
        toast.error(data.message);
        break;
      case 'error':
        toast.error(data.message);
        break;
    }
  };

  const sendMessage = () => {
    if (!ws || !input.trim() || isStreaming) return;
    ws.send(JSON.stringify({ type: 'message', content: input.trim() }));
    setInput('');
  };

  return (
    <div className="border rounded-lg shadow-lg bg-white dark:bg-gray-900">
      {/* ヘッダー */}
      <div className="p-4 border-b bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
        <h3 className="font-bold">💬 この記事について質問する</h3>
        <p className="text-sm opacity-80">AI が記事の内容に基づいて回答します</p>
      </div>

      {/* メッセージエリア */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p>記事の内容について何でも質問してください</p>
            <div className="mt-4 space-y-2">
              <SuggestedQuestion text="この記事の要点を教えてください" onClick={sendSuggested} />
              <SuggestedQuestion text="実装で注意すべき点は？" onClick={sendSuggested} />
              <SuggestedQuestion text="関連する Cloudflare サービスは？" onClick={sendSuggested} />
            </div>
          </div>
        )}
        
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        
        {isStreaming && <TypingIndicator />}
      </div>

      {/* Turnstile（未検証時に表示） */}
      {!turnstileToken && (
        <div className="p-4 border-t flex justify-center">
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={handleTurnstileSuccess}
            options={{ theme: 'light', size: 'normal' }}
          />
        </div>
      )}

      {/* 入力エリア（検証済み時に表示） */}
      {turnstileToken && (
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="質問を入力..."
              disabled={isStreaming}
              className="flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              送信
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            AI による回答は参考情報です。正確な情報は
            <a href="https://developers.cloudflare.com/" className="text-orange-500 hover:underline">公式ドキュメント</a>
            をご確認ください。
          </p>
        </div>
      )}
    </div>
  );
}
```

### 4.2 Turnstile サーバーサイド検証

```typescript
// Durable Object 内での Turnstile 検証
private async verifyTurnstile(
  ws: WebSocket,
  session: { ip: string },
  token: string
): Promise<boolean> {
  const formData = new FormData();
  formData.append('secret', this.env.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  formData.append('remoteip', session.ip);

  const result = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: formData }
  );

  const outcome = await result.json<{ success: boolean; 'error-codes': string[] }>();

  if (!outcome.success) {
    ws.send(JSON.stringify({
      type: 'error',
      message: '認証に失敗しました。ページを再読み込みしてください。'
    }));
    ws.close(1008, 'Turnstile verification failed');
    return false;
  }

  return true;
}
```

---

## 5. AI Gateway 設定

### 5.1 ゲートウェイ構成

```
AI Gateway: cf-se-blog-ai
├── Provider: Workers AI
├── Rate Limiting:
│   ├── Per IP: 10 requests / 1 minute
│   ├── Per User: 20 requests / 1 minute
│   └── Global: 1000 requests / 1 minute
├── Caching:
│   ├── Enabled: true
│   ├── TTL: 3600 seconds
│   └── Cache key: model + messages hash
├── Logging:
│   ├── Log requests: true
│   ├── Log responses: true
│   └── Retention: 30 days
├── Fallback:
│   ├── Primary: @cf/meta/llama-3.1-70b-instruct
│   ├── Fallback 1: @cf/meta/llama-3.1-8b-instruct
│   └── Fallback 2: 静的エラーメッセージ
└── Cost Alerts:
    ├── Daily: $10 threshold → Alert
    └── Monthly: $100 threshold → Alert
```

### 5.2 AI Gateway 経由での呼び出し

```typescript
// AI Gateway を経由した Workers AI 呼び出し
async function callAIViaGateway(env: Env, model: string, messages: any[]) {
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}`;

  const response = await fetch(`${gatewayUrl}/workers-ai/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
      // カスタムヘッダーでユーザー識別（ログ用）
      'cf-aig-metadata': JSON.stringify({
        userId: 'anonymous',
        feature: 'chat',
        postId: 'xxx'
      })
    },
    body: JSON.stringify({ messages, max_tokens: 1024, temperature: 0.7 })
  });

  return response;
}
```

---

## 6. 多層防御設計

```
Layer 1: Cloudflare WAF
├── Managed Rules (OWASP)
├── Custom Rules (XSS, SQLi 対策)
└── Rate Limiting (IP ベース)

Layer 2: Turnstile
├── 初回接続時: Managed Challenge
├── 5分ごとの再検証: Invisible Challenge
└── 疑わしい行動時: Explicit Challenge

Layer 3: Durable Object Rate Limiting
├── IP あたり 10 msg/min
├── ユーザーあたり 20 msg/min
└── スレッドあたり 50 msg/hour

Layer 4: Content Moderation (Llama Guard)
├── ユーザー入力のリアルタイム検査
├── カテゴリ: hate, violence, sexual, dangerous
└── アクション: block + flag for admin review

Layer 5: AI Gateway
├── モデルレベルの Rate Limiting
├── コスト制限 (Budget Alerts)
└── 全リクエスト/レスポンスのログ

Layer 6: Application Logic
├── メッセージ長制限 (max 1000 文字)
├── スパムパターン検出
├── 外部リンクフィルタリング
└── 連続投稿検出
```

---

## 7. 管理者向け機能

### 7.1 SE による手動回答

SE/Admin は管理画面から直接スレッドに回答可能:

```typescript
// POST /api/v1/chat/:threadId/admin-reply
async function handleAdminReply(request: Request, env: Env, userId: string) {
  const { threadId, content } = await request.json();

  // Durable Object に転送
  const roomId = env.CHAT_ROOMS.idFromName(threadId);
  const room = env.CHAT_ROOMS.get(roomId);
  
  return room.fetch(new Request('https://dummy/admin-reply', {
    method: 'POST',
    body: JSON.stringify({ content, senderId: userId, role: 'se' })
  }));
}
```

### 7.2 フラグ管理

フラグされたメッセージの対応フロー:
1. AI が自動でフラグ付け → D1 に記録
2. 管理画面の「フラグ付き」セクションに表示
3. Admin/SE が確認し、以下のいずれかを実行:
   - **非表示にする**: メッセージを他ユーザーから非表示
   - **ユーザーを警告**: 注意メッセージを送信
   - **ユーザーをブロック**: IP + アカウントをブロック
   - **誤検知として解除**: フラグを解除

### 7.3 AI 応答品質モニタリング

管理画面で確認できる AI メトリクス:
- **応答レイテンシ**: P50, P95, P99
- **トークン使用量**: 日次・月次
- **コンテンツモデレーション発動率**
- **ユーザー満足度**: (今後実装) 回答へのサムズアップ/ダウン
- **フォールバック発動率**: プライマリモデル障害の頻度
