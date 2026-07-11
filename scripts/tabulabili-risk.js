/**
 * TabulaBili-Loon — 推荐接口风控探针（被动 http-response）
 *
 * 不改 body；解析业务码，节流通知。
 * 灵感：bili-webos DiagPanel 的 rcmd/-352 探针（只观测，不归因唯一原因）。
 *
 * Argument:
 *   risk_notify = true|false  是否推送通知（默认 true）
 *   risk_debug  = true|false  成功也打日志（默认 false）
 *
 * Store:
 *   tabulabili_risk_last_notify  上次通知时间戳(ms)
 *   tabulabili_risk_last_code    上次业务码
 */

const STORE_LAST_TS = "tabulabili_risk_last_notify";
const STORE_LAST_CODE = "tabulabili_risk_last_code";
const THROTTLE_MS = 30 * 60 * 1000; // 同类异常 30 分钟最多弹 1 次

function argFlag(name, defaultValue) {
  try {
    if (typeof $argument === "undefined" || $argument == null) return defaultValue;
    if (typeof $argument === "object" && $argument[name] != null) {
      const v = $argument[name];
      if (typeof v === "boolean") return v;
      const s = String(v).trim().toLowerCase();
      if (s === "true" || s === "1" || s === "on" || s === "yes") return true;
      if (s === "false" || s === "0" || s === "off" || s === "no") return false;
      return defaultValue;
    }
    if (typeof $argument === "string" && $argument) {
      const re = new RegExp("(?:^|[?&])" + name + "=([^&]+)", "i");
      const m = $argument.match(re);
      if (m) {
        const s = decodeURIComponent(m[1]).trim().toLowerCase();
        if (s === "true" || s === "1" || s === "on") return true;
        if (s === "false" || s === "0" || s === "off") return false;
      }
    }
  } catch (e) {}
  return defaultValue;
}

function classifyUrl(url) {
  if (/\/x\/v2\/feed\/index/i.test(url)) return "app";
  if (/\/index\/top\/(?:feed\/)?rcmd/i.test(url)) return "web";
  return "unknown";
}

function countItems(data, side) {
  if (!data || typeof data !== "object") return 0;
  // Web rcmd: data.item
  if (Array.isArray(data.item)) return data.item.length;
  // App feed: data.items
  if (Array.isArray(data.items)) return data.items.length;
  return 0;
}

function parseBody(body) {
  if (body == null) return null;
  if (typeof body === "object") return body;
  if (typeof body === "string") {
    const t = body.trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function shouldNotify(kind, code) {
  // 成功不通知（除非以后加 debug 通知，目前只日志）
  if (kind === "ok") return false;
  const now = Date.now();
  const lastTs = parseInt($persistentStore.read(STORE_LAST_TS) || "0", 10) || 0;
  const lastCode = $persistentStore.read(STORE_LAST_CODE) || "";
  const key = `${kind}:${code}`;
  if (lastCode === key && now - lastTs < THROTTLE_MS) {
    return false;
  }
  $persistentStore.write(String(now), STORE_LAST_TS);
  $persistentStore.write(key, STORE_LAST_CODE);
  return true;
}

function notify(title, subtitle, body) {
  try {
    $notification.post(title, subtitle, body);
  } catch (e) {
    console.log(`[TabulaBili][risk] notify fail: ${e}`);
  }
}

(function main() {
  const notifyOn = argFlag("risk_notify", true);
  const debug = argFlag("risk_debug", false);
  const url = ($request && $request.url) || ($response && $response.url) || "";
  const side = classifyUrl(url);

  let status = 0;
  try {
    status = ($response && ($response.status || $response.statusCode)) || 0;
  } catch (e) {}

  const rawBody =
    $response && ($response.body != null ? $response.body : $response.bodyBytes);
  // bodyBytes 多为二进制；推荐 JSON 一般是 string
  const json = parseBody(typeof rawBody === "string" ? rawBody : null);

  if (!json) {
    console.log(
      `[TabulaBili][risk] ${side} no-json status=${status} (skip; may be non-json/gzip issue)`
    );
    $done({});
    return;
  }

  const code = json.code;
  const n = countItems(json.data, side);
  const msg = (json.message != null ? String(json.message) : "").slice(0, 80);

  // 判定
  let kind = "other";
  let summary = "";

  if (code === 0 && n > 0) {
    kind = "ok";
    summary = `${side} 推荐正常 code=0 items=${n}`;
  } else if (code === -352) {
    kind = "risk352";
    summary = `${side} code=-352 本次推荐请求被风控`;
  } else if (code === 0 && n === 0) {
    kind = "empty";
    summary = `${side} code=0 但推荐为空 items=0`;
  } else {
    kind = "biz";
    summary = `${side} code=${code} items=${n}${msg ? " " + msg : ""}`;
  }

  console.log(`[TabulaBili][risk] ${summary}`);

  if (debug && kind === "ok") {
    // 仅日志，已 console.log
  }

  if (notifyOn && kind !== "ok") {
    if (shouldNotify(kind, code)) {
      if (kind === "risk352") {
        notify(
          "TabulaBili 风控探针",
          "推荐接口 code=-352",
          "本次请求被风控拒绝。可能与出口 IP、设备 Cookie、请求特征、签名或服务端策略有关（不代表账号全局封禁）。"
        );
      } else if (kind === "empty") {
        notify(
          "TabulaBili 风控探针",
          "推荐返回空列表",
          "code=0 但无条目，可能是匿名缓存流/策略降级，可试 refresh 或换网络。"
        );
      } else {
        notify(
          "TabulaBili 风控探针",
          `推荐异常 code=${code}`,
          `items=${n}${msg ? " · " + msg : ""} · 侧=${side}`
        );
      }
    } else {
      console.log(`[TabulaBili][risk] throttled notify kind=${kind} code=${code}`);
    }
  }

  // 绝不改响应
  $done({});
})();
