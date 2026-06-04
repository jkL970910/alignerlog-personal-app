"use client";

import { FormEvent, use, useState } from "react";
import Link from "next/link";
import { Loader2, LockKeyhole } from "lucide-react";

export function LoginForm({
  nextPathPromise
}: {
  nextPathPromise?: Promise<{ next?: string }>;
}) {
  const searchParams = nextPathPromise ? use(nextPathPromise) : undefined;
  const nextPath = searchParams?.next?.startsWith("/") ? searchParams.next : "/today";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法登录。");
      }

      window.location.assign(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法登录。");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <form className="w-full max-w-sm rounded-md border border-ink/10 bg-white p-5 shadow-soft" onSubmit={submit}>
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-mist text-sage">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-ink">Loo牙管理器</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          登录你的私人佩戴宝库，继续记录牙套计划和每日打卡。
        </p>

        <label className="mt-6 block text-sm font-medium text-ink/70" htmlFor="password">
          邮箱
          <input
            autoComplete="email"
            autoFocus
            className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-ink/70" htmlFor="password">
          密码
          <input
            autoComplete="current-password"
            className="mt-2 min-h-12 w-full rounded-md border border-ink/10 bg-paper px-3 text-ink outline-none focus:border-mint"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-md border border-coral/20 bg-coral/10 p-3 text-sm text-coral">{error}</p>
        ) : null}

        <button
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink px-5 text-base font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
          登录
        </button>

        <p className="mt-4 text-center text-sm text-ink/60">
          还没有账户？{" "}
          <Link className="font-semibold text-ink" href={`/register?next=${encodeURIComponent(nextPath)}`}>
            注册
          </Link>
        </p>
      </form>
    </main>
  );
}
