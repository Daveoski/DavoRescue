import { useAuth } from "@/domains/auth/store";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string | null,
  ) {
    super(message);
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

/** Same-origin call to the FastAPI service. In development Next proxies /api to uvicorn. */
export async function api<T>(path: string, { body, auth = true, headers, ...init }: Options = {}): Promise<T> {
  const token = auth ? useAuth.getState().token : null;
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("No connection. Check your data or call 112 directly.", 0);
  }

  if (res.status === 401 && token) useAuth.getState().signOut();

  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Something went wrong. Please try again.";
    throw new ApiError(detail, res.status, data?.field);
  }
  return data as T;
}
