import webPush from "web-push";

import type { PushSubscriptionRecord } from "@/lib/types";

let configured = false;

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export function getVapidPublicKey() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.");
  }

  return publicKey;
}

export async function sendPush(subscription: PushSubscriptionRecord, payload: PushPayload) {
  configureWebPush();

  return webPush.sendNotification({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  }, JSON.stringify(payload));
}

function configureWebPush() {
  if (configured) {
    return;
  }

  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:jkliu97@gmail.com";

  if (!privateKey) {
    throw new Error("VAPID_PRIVATE_KEY is not configured.");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}
