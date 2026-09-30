/**
 * Safe client-side API response parser for MiraTech Business Suite.
 * Prevents "Unexpected token '<', <!DOCTYPE..." JSON parse crashes when API routes return HTML error pages.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (isJson) {
      const data = await res.json().catch(() => null);
      if (res.ok) {
        return { ok: true, status: res.status, data: data || ({} as T) };
      }
      const errorMsg =
        data?.error || data?.message || `API request failed with HTTP ${res.status}`;
      return { ok: false, status: res.status, data: data || ({} as T), error: errorMsg };
    }

    // Response is non-JSON (e.g. HTML 404/500 document or plain text)
    const rawText = await res.text().catch(() => "");
    let friendlyError = `Server returned non-JSON response (HTTP ${res.status}).`;

    if (res.status === 404) {
      friendlyError = "Requested API endpoint was not found (HTTP 404).";
    } else if (res.status === 500) {
      friendlyError = "Server encountered an internal error (HTTP 500). Please check server configuration.";
    } else if (rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
      friendlyError = `Server returned an HTML document instead of JSON (HTTP ${res.status}).`;
    }

    return {
      ok: false,
      status: res.status,
      data: {} as T,
      error: friendlyError,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: err?.message || "Network communication error. Please verify connection.",
    };
  }
}
