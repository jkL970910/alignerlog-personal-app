"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Plus, X } from "lucide-react";

import { timeZoneHeaders } from "@/lib/client-time-zone";
import type { LooDentalMinisterChatMessage, LooDentalMinisterChatSession } from "@/lib/types";

type ChatMessage = {
  role: "user" | "minister";
  text: string;
};

type MinisterResponse = {
  answer: string;
  contextSummary: string;
  safetyNote: string;
  session: LooDentalMinisterChatSession;
  messages: LooDentalMinisterChatMessage[];
  error?: string;
};

const quickQuestions = [
  "我现在第几副，还剩几副？",
  "今天佩戴情况怎么样？",
  "如果牙套不贴合，我应该记录什么？"
];

export function LooDentalMinister() {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LooDentalMinisterChatSession[]>([]);
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "minister",
      text: "我是 Loo牙大臣。可以帮你解释当前计划、今日佩戴、异常记录和提醒设置；涉及疼痛、不贴合或是否换期，我会提醒你以牙医/正畸医生指导为准。"
    }
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    loadSessions().catch(() => undefined);
  }, [open]);

  async function loadSessions() {
    setLoadingHistory(true);

    try {
      const response = await fetch("/api/minister/sessions");
      const payload = await response.json() as { sessions?: LooDentalMinisterChatSession[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "无法读取历史对话。");
      }

      setSessions(payload.sessions ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadSession(sessionId: string) {
    setLoadingHistory(true);

    try {
      const response = await fetch(`/api/minister/sessions/${sessionId}`);
      const payload = await response.json() as {
        session?: LooDentalMinisterChatSession;
        messages?: LooDentalMinisterChatMessage[];
        error?: string;
      };

      if (!response.ok || !payload.session) {
        throw new Error(payload.error ?? "无法读取这段对话。");
      }

      setActiveSessionId(payload.session.id);
      setMessages((payload.messages ?? []).map((message) => ({
        role: message.role,
        text: message.content
      })));
      setContextSummary(payload.session.title);
      setHistoryOpen(false);
    } catch (error) {
      setMessages([{ role: "minister", text: error instanceof Error ? error.message : "无法读取这段对话。" }]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function startNewChat() {
    setActiveSessionId(null);
    setContextSummary(null);
    setHistoryOpen(false);
    setQuestion("");
    setMessages([{
      role: "minister",
      text: "已开始新对话。你可以继续问当前计划、今日佩戴、阶段照片或异常记录。"
    }]);
  }

  async function ask(nextQuestion?: string) {
    const text = (nextQuestion ?? question).trim();

    if (!text || pending) {
      return;
    }

    setPending(true);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text }]);

    try {
      const response = await fetch("/api/minister/chat", {
        method: "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ question: text, sessionId: activeSessionId })
      });
      const payload = await response.json() as MinisterResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Loo牙大臣暂时无法回答。");
      }

      setContextSummary(payload.contextSummary);
      setActiveSessionId(payload.session.id);
      setSessions((current) => [payload.session, ...current.filter((session) => session.id !== payload.session.id)].slice(0, 12));
      setMessages((current) => [...current, { role: "minister", text: payload.answer }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "minister",
        text: error instanceof Error ? error.message : "Loo牙大臣暂时无法回答。"
      }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        aria-label="打开 Loo牙大臣"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-soft"
        onClick={() => setOpen(true)}
        type="button"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/35 p-3 backdrop-blur-sm">
          <section className="mx-auto flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl border border-ink/10 bg-paper shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 p-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-sage">LOO牙大臣</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">佩戴计划问答</h2>
                <p className="mt-1 text-xs leading-5 text-ink/55">
                  {contextSummary ?? "基于你的计划、打卡和异常记录回答。"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/60"
                  onClick={() => setHistoryOpen((value) => !value)}
                  type="button"
                >
                  历史
                </button>
                <button
                  className="rounded-full border border-ink/10 p-2 text-ink/60"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {historyOpen ? (
              <div className="border-b border-ink/10 bg-white/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">历史对话</p>
                  <button
                    className="flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white"
                    onClick={startNewChat}
                    type="button"
                  >
                    <Plus className="h-3 w-3" />
                    新对话
                  </button>
                </div>
                {loadingHistory ? (
                  <p className="rounded-md bg-mist/60 p-3 text-sm text-ink/60">读取中...</p>
                ) : sessions.length ? (
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {sessions.map((session) => (
                      <button
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                          session.id === activeSessionId ? "border-ink bg-mist text-ink" : "border-ink/10 bg-white text-ink/65"
                        }`}
                        key={session.id}
                        onClick={() => loadSession(session.id)}
                        type="button"
                      >
                        <span className="block truncate font-semibold">{session.title}</span>
                        <span className="mt-0.5 block text-xs text-ink/45">{formatSessionTime(session.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md bg-mist/60 p-3 text-sm text-ink/60">还没有历史对话。</p>
                )}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <article
                  className={`rounded-xl p-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "ml-8 bg-ink text-white"
                      : "mr-8 border border-ink/10 bg-white text-ink/75"
                  }`}
                  key={`${message.role}-${index}`}
                >
                  {message.text}
                </article>
              ))}
              {pending ? (
                <div className="mr-8 flex items-center gap-2 rounded-xl border border-ink/10 bg-white p-3 text-sm text-ink/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在读取你的计划和打卡记录...
                </div>
              ) : null}
            </div>

            <div className="border-t border-ink/10 p-4">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {quickQuestions.map((item) => (
                  <button
                    className="shrink-0 rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink/65"
                    disabled={pending}
                    key={item}
                    onClick={() => ask(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  className="min-h-12 flex-1 resize-none rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sage"
                  maxLength={1200}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      ask();
                    }
                  }}
                  placeholder="问问当前计划、今日佩戴或异常记录..."
                  value={question}
                />
                <button
                  className="rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={pending || !question.trim()}
                  onClick={() => ask()}
                  type="button"
                >
                  发送
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-ink/45">
                不提供诊断或换牙套决策；疼痛、不贴合、损坏、丢失或是否换期，请以医生指导为准。
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
