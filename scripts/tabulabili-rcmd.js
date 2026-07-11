/**
 * TabulaBili-Loon — 首页推荐接口 Cookie 清洗
 * 匹配: api.bilibili.com ... /index/top/feed/rcmd
 *
 * 模式 (plugin Argument `mode` 或 $persistentStore `tabulabili_mode`):
 *   pure    — 删除 Cookie，后端视为匿名访客
 *   refresh — 仅保留 buvid3/buvid4（探索模式，推荐默认）
 *   mixed   — 奇数次清洗 / 偶数次原样（全局计数）
 *   origin  — 不干预
 *
 * 灵感来自 tjsky/TabulaBili (MIT)，网络层复现核心逻辑。
 */

const STORE_MODE = "tabulabili_mode";
const STORE_FP = "tabulabili_fingerprint";
const STORE_MIXED = "tabulabili_mixed_counter";

const VALID_MODES = new Set(["pure", "refresh", "mixed", "origin"]);

function readMode() {
  // 插件 [Argument] 注入优先
  try {
    if (typeof $argument !== "undefined" && $argument != null) {
      if (typeof $argument === "object" && $argument.mode) {
        const m = String($argument.mode).trim().toLowerCase();
        if (VALID_MODES.has(m)) return m;
      }
      if (typeof $argument === "string" && $argument) {
        // "mode=refresh" 或 纯值 "refresh"
        const qs = $argument.match(/(?:^|[?&])mode=([^&]+)/i);
        if (qs) {
          const m = decodeURIComponent(qs[1]).trim().toLowerCase();
          if (VALID_MODES.has(m)) return m;
        }
        const bare = $argument.trim().toLowerCase();
        if (VALID_MODES.has(bare)) return bare;
      }
    }
  } catch (e) {
    console.log(`[TabulaBili] parse $argument: ${e}`);
  }
  const stored = ($persistentStore.read(STORE_MODE) || "").trim().toLowerCase();
  if (VALID_MODES.has(stored)) return stored;
  return "refresh";
}

function findHeaderKey(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers || {}).find((k) => k.toLowerCase() === lower);
}

function getCookieRaw(headers) {
  const key = findHeaderKey(headers, "Cookie");
  return key ? headers[key] : "";
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

function resolveFingerprint(currentCookie) {
  const stored = ($persistentStore.read(STORE_FP) || "").trim();
  if (stored && /buvid3=/i.test(stored)) return stored;
  const fromReq = extractBuvidFingerprint(currentCookie);
  if (fromReq) {
    $persistentStore.write(fromReq, STORE_FP);
    return fromReq;
  }
  return "";
}

function setCookieHeader(headers, value) {
  const key = findHeaderKey(headers, "Cookie") || "Cookie";
  // 部分环境同时存在 Cookie / cookie，统一清理后写入
  Object.keys(headers).forEach((k) => {
    if (k.toLowerCase() === "cookie") delete headers[k];
  });
  if (value === null || value === undefined || value === "") {
    return;
  }
  headers[key] = value;
}

function shouldScrub(mode) {
  if (mode === "origin") return false;
  if (mode === "pure" || mode === "refresh") return true;
  if (mode === "mixed") {
    let n = parseInt($persistentStore.read(STORE_MIXED) || "0", 10);
    if (Number.isNaN(n) || n < 0) n = 0;
    n += 1;
    $persistentStore.write(String(n), STORE_MIXED);
    // 奇数次清洗，偶数次放行
    return n % 2 === 1;
  }
  return false;
}

function scrubStyle(mode) {
  // pure 全删；refresh/mixed 只留 buvid
  return mode === "pure" ? "remove" : "buvid";
}

(function main() {
  const mode = readMode();
  $persistentStore.write(mode, STORE_MODE);

  if (!shouldScrub(mode)) {
    console.log(`[TabulaBili] pass-through mode=${mode}`);
    $done({});
    return;
  }

  const headers = Object.assign({}, $request.headers || {});
  const rawCookie = getCookieRaw(headers);
  const style = scrubStyle(mode);

  if (style === "remove") {
    setCookieHeader(headers, "");
    console.log(`[TabulaBili] pure: Cookie removed`);
  } else {
    const fp = resolveFingerprint(rawCookie);
    if (fp) {
      setCookieHeader(headers, fp);
      console.log(`[TabulaBili] ${mode}: Cookie -> buvid only`);
    } else {
      // 无指纹时降级为全删，避免带上 SESSDATA
      setCookieHeader(headers, "");
      console.log(`[TabulaBili] ${mode}: no buvid, fallback remove Cookie`);
    }
  }

  $done({ headers });
})();
