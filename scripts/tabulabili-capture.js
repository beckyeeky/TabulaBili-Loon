/**
 * TabulaBili-Loon — 从 B 站请求中采集 buvid3/buvid4 指纹
 * 仅在 Cookie 含 buvid 时更新 $persistentStore，不修改请求。
 */

const STORE_FP = "tabulabili_fingerprint";

function findHeaderKey(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers || {}).find((k) => k.toLowerCase() === lower);
}

function extractBuvidFingerprint(cookieStr) {
  if (!cookieStr || typeof cookieStr !== "string") return "";
  const parts = [];
  const m3 = cookieStr.match(/(?:^|;\s*)buvid3=([^;]+)/i);
  const m4 = cookieStr.match(/(?:^|;\s*)buvid4=([^;]+)/i);
  if (m3 && m3[1]) parts.push(`buvid3=${m3[1].trim()}`);
  if (m4 && m4[1]) parts.push(`buvid4=${m4[1].trim()}`);
  return parts.join("; ");
}

(function main() {
  try {
    const headers = $request.headers || {};
    const key = findHeaderKey(headers, "Cookie");
    if (!key) {
      $done({});
      return;
    }
    const fp = extractBuvidFingerprint(headers[key]);
    if (!fp) {
      $done({});
      return;
    }
    const prev = ($persistentStore.read(STORE_FP) || "").trim();
    if (prev !== fp) {
      $persistentStore.write(fp, STORE_FP);
      console.log("[TabulaBili] fingerprint updated");
    }
  } catch (e) {
    console.log(`[TabulaBili] capture error: ${e}`);
  }
  $done({});
})();
