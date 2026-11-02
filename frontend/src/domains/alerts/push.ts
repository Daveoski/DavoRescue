import { api } from "@/shared/lib/api-client";

export type PushState = "enabled" | "disabled" | "denied" | "unsupported" | "unavailable";

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "enabled" : "disabled";
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const { enabled, public_key } = await api<{ enabled: boolean; public_key: string | null }>("/api/alerts/push-key", {
    auth: false,
  });
  if (!enabled || !public_key) return "unavailable";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(public_key) }));
  const json = sub.toJSON();
  await api("/api/alerts/subscriptions", { method: "POST", body: { endpoint: json.endpoint, keys: json.keys } });
  return "enabled";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api(`/api/alerts/subscriptions?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "disabled";
}
