import { useState, useRef, useEffect, useCallback } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "ai" | "se" | "admin" | "system";
  content: string;
  createdAt: string;
}

interface Props {
  postId: string;
  postTitle: string;
}

export function ChatWidget({ postId, postTitle }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const loadMessages = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await fetch(`/api/v1/chat?postId=${encodeURIComponent(postId)}`);
      if (res.ok) {
        const data = (await res.json()) as { messages?: ChatMessage[] };
        setMessages(data.messages ?? []);
      }
    } catch {
      /* ignore initial load failure */
    }
    setLoaded(true);
  }, [postId, loaded]);

  useEffect(() => {
    if (isOpen) loadMessages();
  }, [isOpen, loadMessages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, message: text }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({ error: "エラーが発生しました" }))) as { error?: string };
        setError(errBody.error || `Error ${res.status}`);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("ストリームの取得に失敗しました");
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let lineBuf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        lineBuf += chunk;
        const parts = lineBuf.split("\n");
        lineBuf = parts.pop() || "";
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              accumulated += parsed.text;
              setStreamingContent(accumulated);
            }
          } catch {
            // Skip incomplete JSON
          }
        }
      }

      if (accumulated.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "ai",
            content: accumulated,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (e: any) {
      setError(e.message || "通信エラーが発生しました");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isComposingRef.current) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggested(q: string) {
    setInput(q);
  }

  const suggestions = [
    "この記事の要点を教えてください",
    "実装で注意すべき点は？",
    "関連する Cloudflare サービスは？",
  ];

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition-all hover:bg-brand-600 hover:shadow-xl"
        aria-label={isOpen ? "チャットを閉じる" : "チャットを開く"}
      >
        {isOpen ? (
          <CloseIcon />
        ) : (
          <ChatBubbleIcon />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-96">
          {/* Panel header */}
          <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 text-white">
            <h3 className="text-sm font-bold">この記事について質問する</h3>
            <p className="mt-0.5 text-[11px] text-white/80">
              AI が「{postTitle.slice(0, 30)}{postTitle.length > 30 ? "…" : ""}」の内容に基づいて回答します
            </p>
          </div>

          {/* Message area */}
          <div
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
            style={{ maxHeight: "22rem", minHeight: "14rem" }}
          >
            {/* Empty state with suggestions */}
            {messages.length === 0 && !isStreaming && (
              <div className="pt-4 text-center">
                <p className="text-xs text-gray-400">記事について何でも質問できます</p>
                <div className="mt-3 space-y-1.5">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggested(q)}
                      className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* Streaming content */}
            {isStreaming && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-800">
                  <span className="whitespace-pre-wrap">{streamingContent}</span>
                  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-brand-500" />
                </div>
              </div>
            )}

            {/* Typing dots */}
            {isStreaming && !streamingContent && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-gray-100 px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Error bar */}
          {error && (
            <div className="mx-3 mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] text-red-600">
              {error}
            </div>
          )}

          {/* Input area */}
          <div className="border-t px-3 py-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { setTimeout(() => { isComposingRef.current = false; }, 50); }}
                placeholder="質問を入力..."
                disabled={isStreaming}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                送信
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-tight text-gray-400">
              ※ 日本語入力時は Enter キーで誤送信される場合があります。メモ帳等で文章を作成し、コピー＆ペーストでご利用ください。
            </p>
            <p className="mt-1 text-[10px] leading-tight text-gray-400">
              AI の回答は参考情報です。正確な情報は{" "}
              <a
                href="https://developers.cloudflare.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-500 hover:underline"
              >
                公式ドキュメント
              </a>
              をご確認ください。AI で不十分な場合、適切なご質問に関しては管理者側から回答をさせていただくことができます。
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const isHuman = msg.role === "se" || msg.role === "admin";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? "bg-brand-500 text-white"
            : isHuman
              ? "border border-green-200 bg-green-50 text-gray-800"
              : "bg-gray-100 text-gray-800"
        }`}
      >
        {isHuman && (
          <div className="mb-0.5 text-[10px] font-semibold uppercase text-green-600">
            {msg.role === "se" ? "SE 回答" : "Admin 回答"}
          </div>
        )}
        <div className="whitespace-pre-wrap">{msg.content}</div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
      />
    </svg>
  );
}
