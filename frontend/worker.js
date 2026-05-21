const DEFAULT_BACKEND = "";
const STATIC_EXTENSIONS = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".avif",
  ".woff",
  ".woff2",
];

function isApiRequest(pathname = "") {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isFrameRequest(pathname = "") {
  return pathname.startsWith("/frames/");
}

function getBackendOrigin(env = {}) {
  return (
    String(env.BACKEND_ORIGIN || env.RENDER_ORIGIN || env.VERCEL_ORIGIN || DEFAULT_BACKEND).trim()
  );
}

function buildProxyUrl(requestUrl, backendOrigin) {
  const incomingUrl = new URL(requestUrl);
  const targetBaseUrl = new URL(backendOrigin.endsWith("/") ? backendOrigin : `${backendOrigin}/`);
  targetBaseUrl.pathname = incomingUrl.pathname;
  targetBaseUrl.search = incomingUrl.search;
  return targetBaseUrl.toString();
}

function buildProxyRequest(request, targetUrl) {
  const incomingUrl = new URL(request.url);
  const headers = new Headers(request.headers);

  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  return new Request(targetUrl, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });
}

function withCacheControl(response, value) {
  const next = new Response(response.body, response);
  next.headers.set("Cache-Control", value);
  return next;
}

function applyStaticCacheHeaders(request, response) {
  if (!response || !["GET", "HEAD"].includes(request.method)) {
    return response;
  }

  const pathname = new URL(request.url).pathname.toLowerCase();

  if (pathname === "/human-check.html" || pathname === "/blocked-ip.html") {
    return withCacheControl(response, "no-store");
  }

  if (STATIC_EXTENSIONS.some((extension) => pathname.endsWith(extension))) {
    return withCacheControl(
      response,
      "public, max-age=3600, stale-while-revalidate=86400"
    );
  }

  if (pathname.endsWith(".html") || !pathname.includes(".")) {
    return withCacheControl(
      response,
      "public, max-age=300, stale-while-revalidate=3600"
    );
  }

  return response;
}

async function serveStaticAsset(request, env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return new Response("Static assets binding is not configured", { status: 500 });
  }

  const response = await env.ASSETS.fetch(request);
  return applyStaticCacheHeaders(request, response);
}

async function proxyToBackend(request, env) {
  const backendOrigin = getBackendOrigin(env);
  if (!backendOrigin) {
    return new Response("BACKEND_ORIGIN is not configured", { status: 500 });
  }

  const pathname = new URL(request.url).pathname;
  const targetUrl = buildProxyUrl(request.url, backendOrigin);
  const proxyRequest = buildProxyRequest(request, targetUrl);
  const cf =
    request.method === "GET" && isFrameRequest(pathname)
      ? { cacheEverything: true }
      : undefined;

  return fetch(proxyRequest, { cf });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (isApiRequest(pathname) || isFrameRequest(pathname)) {
      return proxyToBackend(request, env);
    }

    return serveStaticAsset(request, env);
  },
};
