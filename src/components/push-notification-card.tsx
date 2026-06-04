"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";

type PushState =
  | { status: "loading"; message?: string }
  | { status: "unsupported"; message: string }
  | { status: "ready"; permission: NotificationPermission; subscribed: boolean; message?: string }
  | { status: "error"; message: string };

export function PushNotificationCard() {
  const [state, setState] = useState<PushState>({ status: "loading" });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    loadPushState().then(setState).catch((error: Error) => setState({ status: "error", message: error.message }));
  }, []);

  async function enablePush() {
    setPending(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setState({ status: "ready", permission, subscribed: false, message: "浏览器通知权限未开启。" });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const keyResponse = await fetch("/api/push/vapid-key");
      const keyPayload = await keyResponse.json();

      if (!keyResponse.ok) {
        throw new Error(keyPayload.error ?? "无法读取推送配置。");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey)
      });
      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存推送订阅。");
      }

      setState({ status: "ready", permission: "granted", subscribed: true, message: "推送已开启。" });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "无法开启推送。" });
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    setPending(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }

      setState({ status: "ready", permission: Notification.permission, subscribed: false, message: "当前设备推送已关闭。" });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "无法关闭推送。" });
    } finally {
      setPending(false);
    }
  }

  const body = getBody(state);

  return (
    <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mist text-sage">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">当前设备推送</h2>
              <p className="mt-1 text-sm leading-6 text-ink/60">{body}</p>
            </div>
            {state.status === "ready" ? <StatusPill subscribed={state.subscribed} permission={state.permission} /> : null}
          </div>
          {state.status === "ready" && state.message ? <p className="mt-2 text-xs text-sage">{state.message}</p> : null}
          {state.status === "error" ? <p className="mt-2 text-xs text-coral">{state.message}</p> : null}
          {state.status === "ready" ? (
            <button
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={pending || state.permission === "denied"}
              onClick={state.subscribed ? disablePush : enablePush}
              type="button"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {state.subscribed ? "关闭这台设备的推送" : "开启这台设备的推送"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatusPill(props: { subscribed: boolean; permission: NotificationPermission }) {
  if (props.permission === "denied") {
    return <span className="shrink-0 rounded-full bg-coral/10 px-2.5 py-1 text-xs font-semibold text-coral">已拒绝</span>;
  }

  if (props.subscribed) {
    return <span className="shrink-0 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-semibold text-sage">已开启</span>;
  }

  return <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink/55">未开启</span>;
}

async function loadPushState(): Promise<PushState> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { status: "unsupported", message: "当前浏览器不支持 Web Push。" };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    status: "ready",
    permission: Notification.permission,
    subscribed: Boolean(subscription)
  };
}

function getBody(state: PushState) {
  if (state.status === "loading") {
    return "正在检查当前设备的推送状态。";
  }

  if (state.status === "unsupported") {
    return state.message;
  }

  if (state.status === "error") {
    return "推送状态暂时不可用。";
  }

  if (state.permission === "denied") {
    return "浏览器已拒绝通知权限。需要在浏览器或系统设置里重新允许。";
  }

  if (state.subscribed) {
    return "这台设备已能接收 Loo牙提醒。摘下牙套超过设定时间后，系统会发送戴回提醒。";
  }

  return "开启后，这台手机可以收到戴回牙套提醒。每台设备都需要单独开启一次。";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
