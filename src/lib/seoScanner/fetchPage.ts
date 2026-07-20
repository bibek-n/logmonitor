const FETCH_TIMEOUT_MS = 15000;

export interface FetchedPage {
  html: string;
  headers: Record<string, string>;
  finalUrl: string;
  status: number;
}

export async function fetchPage(url: string): Promise<FetchedPage> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const html = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  return { html, headers, finalUrl: res.url, status: res.status };
}
