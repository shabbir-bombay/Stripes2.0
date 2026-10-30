import type { ApiError } from "@/lib/types";

/**
 * Calls an endpoint and returns its JSON (undefined for 204).
 * Throws an Error whose message is safe to show: the server's ApiError, or a connection problem.
 *
 *   const ride = await api<Ride>("/api/rides", "POST", request);
 */
export async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach Stripes. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const json: T | ApiError = await response.json().catch(() => ({ error: "Something went wrong. Try again." }));
  if (!response.ok) throw new Error((json as ApiError).error);
  return json as T;
}
