/**
 * TabulaBili-Loon — 采集 buvid 指纹（不修改请求）
 * 匹配 app/api 通用流量，排除推荐 feed 本身，避免与清洗脚本双命中。
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
  // App 有时只有 Buvid header / buvid 单字段
  const m = cookieStr.match(/(?:^|;\s*)buvid=([^;]+)/i);
  if (!m3 && m && m[1]) parts.push(`buvid=${m[1].trim()}`);
  return parts.join("; ");
}

(function main() {
  try {
    const headers = $request.headers || {};
    const key = findHeaderKey(headers, "Cookie");
    let fp = key ? extractBuvidFingerprint(headers[key]) : "";
    // 部分 App 请求把设备 id 放在独立头
    if (!fp) {
      const buvidH =
        headers[findHeaderKey(headers, "Buvid") || ""] ||
        headers[findHeaderKey(headers, "buvid") || ""] ||
        "";
      if (buvidH) fp = `buvid3=${buvidH}`;
    }
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
    console.log(`[TabulaBili] capture: ${e}`);
  }
  $done({});
})();
