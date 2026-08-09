const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function parseApplicationUrl(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is not configured`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an origin without credentials, query parameters, or a fragment`);
  }
  if (url.pathname !== "/") {
    throw new Error(`${name} must not include a path`);
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error(`${name} must use HTTPS outside localhost`);
  }

  return url.origin;
}

export function getPublicAppUrl() {
  return parseApplicationUrl("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
}

export function getServerAppUrl() {
  const publicUrl = getPublicAppUrl();
  const serverUrl = parseApplicationUrl("APP_URL", process.env.APP_URL);
  if (serverUrl !== publicUrl) {
    throw new Error("APP_URL and NEXT_PUBLIC_APP_URL must use the same origin");
  }
  return publicUrl;
}

export function buildAppUrl(path: string, origin = getPublicAppUrl()) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Application URL paths must be root-relative");
  }
  const url = new URL(path, `${origin}/`);
  if (url.origin !== origin) throw new Error("Application URL must remain on the configured origin");
  return url.toString();
}
