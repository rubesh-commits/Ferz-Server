// Deployment targets. Override with VITE_HUB_URL / VITE_DRIVE_URL if needed.
const HUB_ENV = import.meta.env.VITE_HUB_URL;
const DRIVE_ENV = import.meta.env.VITE_DRIVE_URL;

const stripSlash = (value) => value.replace(/\/$/, "");

const isFerzDomain = (host) => host === "ferz.co.in" || host.endsWith(".ferz.co.in");

export const driveHost = (() => {
  if (DRIVE_ENV) {
    try { return new URL(DRIVE_ENV).hostname; } catch { /* fall through */ }
  }
  return "drive.ferz.co.in";
})();

export function hubUrl() {
  if (HUB_ENV) return stripSlash(HUB_ENV);
  if (isFerzDomain(window.location.hostname)) return "https://ferz.co.in";
  return window.location.origin;
}

export function driveUrl() {
  if (DRIVE_ENV) return stripSlash(DRIVE_ENV);
  if (isFerzDomain(window.location.hostname)) return "https://drive.ferz.co.in";
  return `${window.location.origin}/drive`;
}

export function isDriveApp() {
  if (import.meta.env.VITE_FORCE_APP === "drive") return true;
  if (window.location.pathname === "/drive" || window.location.pathname.startsWith("/drive/")) return true;
  return window.location.hostname === driveHost;
}

export function loginUrl() {
  const next = encodeURIComponent(window.location.href);
  return `${stripSlash(hubUrl())}/?next=${next}`;
}

export function safeNext(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname;
    const allowed = host === window.location.hostname ||
      host === "ferz.co.in" || host.endsWith(".ferz.co.in") || host === driveHost;
    return allowed ? url.href : null;
  } catch {
    return null;
  }
}
