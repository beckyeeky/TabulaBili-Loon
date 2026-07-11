/**
 * TabulaBili-Loon — 推荐流去身份化（Web + App）
 *
 * Web: api.bilibili.com/.../index/top/feed/rcmd → 清洗 Cookie
 * App: app.bilibili.com|app.biliapi.net /x/v2/feed/index → 清洗 Cookie/鉴权头 + 去掉 access_key 并重签
 *
 * 模式: pure | refresh | mixed | origin
 * 参考可莉插件 MitM/App 接口范围；逻辑灵感来自 tjsky/TabulaBili (MIT)
 */

const STORE_MODE = "tabulabili_mode";
const STORE_FP = "tabulabili_fingerprint";
const STORE_MIXED = "tabulabili_mixed_counter";
const VALID_MODES = new Set(["pure", "refresh", "mixed", "origin"]);

// 公开已知的 App appkey → secret（用于去掉 access_key 后重算 sign）
const APP_SECRETS = {
  "1d8b6e7d45233436": "560c52ccd288fed045859ed18bffd973",
  "27eb53fc9058f8c3": "c2ed53a74eeefe3cf99fbd01d8c9c375",
  "4409e2ce8ffd12b8": "59b43e04ad6965f34319062b478f83dd",
  "37207f2beaebf8d7": "e988e794d4d4b6dd43bc0e89d6e90c43",
  "bb3101000e232e27": "36efcfed79309338ced0380abd824ac1",
  "ae57252b0c09105d": "c75875c596a69eb55bd92668b260c7ac",
  "7d089525d3611b1c": "acd495b248ec528c2eed1e862d393126",
};

// ---------- tiny MD5 (public domain style) ----------
function md5(string) {
  function safeAdd(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function bitRotateLeft(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function md5cmn(q, a, b, x, s, t) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a, b, c, d, x, s, t) {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a, b, c, d, x, s, t) {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function binlMD5(x, len) {
    x[len >> 5] |= 0x80 << len % 32;
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    let i, olda, oldb, oldc, oldd;
    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;
    for (i = 0; i < x.length; i += 16) {
      olda = a;
      oldb = b;
      oldc = c;
      oldd = d;
      a = md5ff(a, b, c, d, x[i], 7, -680876936);
      d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
      b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);
      a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = md5gg(b, c, d, a, x[i], 20, -373897302);
      a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);
      a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
      d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = md5hh(d, a, b, c, x[i], 11, -358537222);
      c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);
      a = md5ii(a, b, c, d, x[i], 6, -198630844);
      d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);
      a = safeAdd(a, olda);
      b = safeAdd(b, oldb);
      c = safeAdd(c, oldc);
      d = safeAdd(d, oldd);
    }
    return [a, b, c, d];
  }
  function binl2rstr(input) {
    let i;
    let output = "";
    for (i = 0; i < input.length * 32; i += 8) {
      output += String.fromCharCode((input[i >> 5] >>> i % 32) & 0xff);
    }
    return output;
  }
  function rstr2binl(input) {
    const output = [];
    output[(input.length >> 2) - 1] = undefined;
    for (let i = 0; i < output.length; i += 1) output[i] = 0;
    for (let i = 0; i < input.length * 8; i += 8) {
      output[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << i % 32;
    }
    return output;
  }
  function rstrMD5(s) {
    return binl2rstr(binlMD5(rstr2binl(s), s.length * 8));
  }
  function rstr2hex(input) {
    const hexTab = "0123456789abcdef";
    let output = "";
    for (let i = 0; i < input.length; i += 1) {
      const x = input.charCodeAt(i);
      output += hexTab.charAt((x >>> 4) & 0x0f) + hexTab.charAt(x & 0x0f);
    }
    return output;
  }
  function str2rstrUTF8(input) {
    return unescape(encodeURIComponent(input));
  }
  return rstr2hex(rstrMD5(str2rstrUTF8(string)));
}

// ---------- helpers ----------
function readMode() {
  try {
    if (typeof $argument !== "undefined" && $argument != null) {
      if (typeof $argument === "object" && $argument.mode) {
        const m = String($argument.mode).trim().toLowerCase();
        if (VALID_MODES.has(m)) return m;
      }
      if (typeof $argument === "string" && $argument) {
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
    console.log(`[TabulaBili] arg: ${e}`);
  }
  const stored = ($persistentStore.read(STORE_MODE) || "").trim().toLowerCase();
  if (VALID_MODES.has(stored)) return stored;
  return "refresh";
}

function findHeaderKey(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers || {}).find((k) => k.toLowerCase() === lower);
}

function getHeader(headers, name) {
  const k = findHeaderKey(headers, name);
  return k ? headers[k] : "";
}

function deleteHeader(headers, name) {
  Object.keys(headers || {}).forEach((k) => {
    if (k.toLowerCase() === name.toLowerCase()) delete headers[k];
  });
}

function setHeader(headers, name, value) {
  deleteHeader(headers, name);
  if (value !== null && value !== undefined && value !== "") {
    headers[name] = value;
  }
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

function shouldScrub(mode) {
  if (mode === "origin") return false;
  if (mode === "pure" || mode === "refresh") return true;
  if (mode === "mixed") {
    let n = parseInt($persistentStore.read(STORE_MIXED) || "0", 10);
    if (Number.isNaN(n) || n < 0) n = 0;
    n += 1;
    $persistentStore.write(String(n), STORE_MIXED);
    return n % 2 === 1;
  }
  return false;
}

function isAppFeed(url) {
  return /https:\/\/(?:app\.bilibili\.com|app\.biliapi\.net)\/x\/v2\/feed\/index/i.test(url);
}

function isWebRcmd(url) {
  return /https:\/\/api\.bilibili\.com\/x\/web-interface(?:\/wbi)?\/index\/top\/(?:feed\/)?rcmd/i.test(
    url
  );
}

/** 去掉账号 Cookie，按模式保留/丢弃 buvid */
function scrubCookie(headers, mode) {
  const raw = getHeader(headers, "Cookie");
  if (mode === "pure") {
    deleteHeader(headers, "Cookie");
    return;
  }
  const fp = resolveFingerprint(raw);
  if (fp) setHeader(headers, "Cookie", fp);
  else deleteHeader(headers, "Cookie");
}

/** App 额外鉴权头 */
function scrubAuthHeaders(headers) {
  [
    "Authorization",
    "authorization",
    "x-bili-mid",
    "x-bili-aurora-eid",
    "x-bili-gaia-vtoken",
    "x-bili-ticket",
    "bili-ticket",
  ].forEach((h) => deleteHeader(headers, h));
}

/**
 * 解析 query、去掉登录态相关参数并重签
 * App 签名: 参数按 key 字典序拼接 key=value&... + secret → md5
 */
function deauthAndResignUrl(url) {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) return url;
  const base = url.slice(0, qIndex);
  const query = url.slice(qIndex + 1);
  const params = {};
  query.split("&").forEach((pair) => {
    if (!pair) return;
    const eq = pair.indexOf("=");
    let k, v;
    if (eq < 0) {
      k = pair;
      v = "";
    } else {
      k = pair.slice(0, eq);
      v = pair.slice(eq + 1);
    }
    try {
      k = decodeURIComponent(k);
    } catch (e) {}
    // 保留原始 value 编码状态：App 签名通常对「解码后的值」或「原串」有约定；
    // 社区脚本普遍：searchParams 级（解码）再 encode 拼接。这里用 decode 后重装。
    try {
      v = decodeURIComponent(v.replace(/\+/g, " "));
    } catch (e) {}
    params[k] = v;
  });

  const DROP = new Set([
    "access_key",
    "access_token",
    "session_key",
    "sign",
  ]);
  Object.keys(params).forEach((k) => {
    if (DROP.has(k.toLowerCase()) || DROP.has(k)) delete params[k];
  });
  // 兼容大小写 key
  Object.keys(params).forEach((k) => {
    if (k.toLowerCase() === "access_key" || k.toLowerCase() === "sign") delete params[k];
  });

  const appkey = params.appkey || params.appKey || "";
  const secret = APP_SECRETS[appkey] || APP_SECRETS["1d8b6e7d45233436"];

  const keys = Object.keys(params).sort();
  const sorted = keys.map((k) => `${k}=${params[k]}`).join("&");
  const sign = md5(sorted + secret);
  params.sign = sign;

  const keys2 = Object.keys(params).sort();
  // 输出：对 value 做 encodeURIComponent（与多数 B 站脚本一致）
  const newQuery = keys2
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&")
    .replace(/%20/g, "+");

  // 注意：部分客户端对编码敏感。若异常可回退不编码 key。
  // 更稳妥：key 不编码、value 保持尽量原样。这里用常见写法：key 原样 + value encode
  const newQuery2 = keys2.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&");

  return `${base}?${newQuery2}`;
}

(function main() {
  const url = $request.url || "";
  const mode = readMode();
  $persistentStore.write(mode, STORE_MODE);

  if (!shouldScrub(mode)) {
    console.log(`[TabulaBili] pass mode=${mode}`);
    $done({});
    return;
  }

  const headers = Object.assign({}, $request.headers || {});
  const app = isAppFeed(url);
  const web = isWebRcmd(url);

  if (!app && !web) {
    // 被其它匹配误伤时放行
    $done({});
    return;
  }

  scrubCookie(headers, mode);
  scrubAuthHeaders(headers);

  const out = { headers };
  if (app) {
    // App：去 access_key + 重签，否则只去 Cookie 仍可能带登录
    try {
      out.url = deauthAndResignUrl(url);
      console.log(`[TabulaBili] app feed mode=${mode} resigned`);
    } catch (e) {
      console.log(`[TabulaBili] resign fail: ${e}`);
    }
  } else {
    console.log(`[TabulaBili] web rcmd mode=${mode} cookie scrubbed`);
  }

  $done(out);
})();
