# AGENTS.md — TabulaBili-Loon 接手说明

> 给后续 AI / 人类维护者：本文汇总本仓库从需求 → 可行性 → 实现 → 踩坑 → 验证的**全部关键决策**。  
> 先读本文再改代码；改完请同步更新本文件对应章节。

**仓库：** https://github.com/beckyeeky/TabulaBili-Loon（public）  
**本地（开发机）：** `/root/repos/TabulaBili-Loon`  
**Owner：** beckyeeky（Beck Chao）  
**文档语言：** 中文优先；代码注释中英均可  

---

## 1. 项目目标（一句话）

用 **Loon 插件** 复现 Chrome 扩展 [tjsky/TabulaBili](https://github.com/tjsky/TabulaBili)（初见哔哩）的核心体验：

- **登录态可用**（播放、互动、画质不刻意破坏）
- **首页推荐流尽量不基于账号个性化**（更接近匿名/大盘热门）
- **不是去广告**；去广告请用可莉等插件

---

## 2. 上游与许可

| 项 | 内容 |
|----|------|
| 上游概念 | Tabula Rasa → 首页推荐「失忆」 |
| 主要参考实现 | [tjsky/TabulaBili](https://github.com/tjsky/TabulaBili) v1.2.0（MIT） |
| 原作 | wangdaodaodao / TabulaBili |
| 本仓库许可 | MIT（见 `LICENSE`） |
| 要求 | 保留上游致谢；勿把本插件宣传成「可莉去广告」 |

上游 Chrome 技术栈摘要：

- MV3 + `declarativeNetRequest` 改 **请求 Cookie**
- 核心 Web 接口：`api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd`
- 模式：`pure` / `refresh`(探索) / `mixed` / `origin`
- `content-main.js` hook fetch：只为在不破坏 **Wbi 签名（签 Query，不签 Cookie）** 的前提下配合 DNR
- 纯净模式会自动点「换一换」修首屏 SSR——**Loon 无法做 DOM**

---

## 3. 为什么做 Loon 版（可行性结论）

### 3.1 可移植

| Chrome | Loon | 结论 |
|--------|------|------|
| DNR 删/改 Cookie | `http-request` + `$done({ headers })` | ✅ |
| 模式存储 | `$persistentStore` + 插件 `[Argument]` | ✅ |
| 探索模式 buvid | 从其它请求采集 Cookie 中 buvid | ✅ |
| 混合模式 | 全局计数器奇偶 | ✅（无 tab 隔离） |
| popup UI | Argument select | ⚠️ 够用 |
| content script / 点换一换 | 无 | ❌ 不做 |
| fetch/Wbi 时序 hook | 不需要（只改 Cookie） | N/A |

### 3.2 不可 1:1 移植

- 无浏览器 content script、无 MAIN world
- 无扩展 popup 美学面板
- Loon 作用域 = **走代理且 MitM 的流量**（App + Safari），不是「只嵌在 Chrome」

### 3.3 关键产品决策

- **默认模式：`refresh`（探索）**，不是 `pure`  
  - 原因：上游 FAQ 写明 pure 全删 Cookie → 易触发固定 CDN 缓存流
- **MVP 先做请求侧去身份**，不做响应体重排算法
- **App 比 Web 优先**（见 §5）

---

## 4. 仓库结构

```text
TabulaBili-Loon/
├── AGENTS.md                 # 本文：AI 接手必读
├── README.md                 # 用户安装/使用
├── LICENSE
├── TabulaBili.plugin         # 【安装入口】根目录 raw 可用
├── plugin/
│   ├── TabulaBili.plugin     # 与根目录同步的副本
│   ├── TabulaBili.local.plugin  # 本地 Script V2 路径模板
│   └── TabulaBili.conf       # 镜像（raw 兼容备用）
└── scripts/
    ├── tabulabili-rcmd.js    # 推荐请求清洗（Web+App）
    └── tabulabili-capture.js # buvid 指纹采集（不改请求）
```

### 4.1 安装 URL（给用户）

```text
https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/TabulaBili.plugin
```

备用 CDN：

```text
https://cdn.jsdelivr.net/gh/beckyeeky/TabulaBili-Loon@main/TabulaBili.plugin
```

### 4.2 GitHub raw 坑（必须记住）

| URL | raw.githubusercontent 结果 |
|-----|---------------------------|
| `/TabulaBili.plugin`（根目录） | ✅ 200 |
| `/plugin/TabulaBili.plugin` | ✅ **实测 GET 200（2026-10-11）** |
| `/plugin/TabulaBili.conf` | ✅ 200 |
| `/scripts/*.js` | ✅ 200 |
| jsDelivr 上 `plugin/*.plugin` | ✅ 200 |

**规范：** 对外安装入口永远用**根目录** `TabulaBili.plugin`；改插件时 **同步** `TabulaBili.plugin` 与 `plugin/TabulaBili.plugin`。

私有仓库时 Loon 拉不到 raw → 已改为 public。

---

## 5. 为什么第一版「感觉无效」（事故复盘）

### 5.1 对照可莉插件

用户指定参考：  
https://kelee.one/Tool/Loon/Lpx/Bilibili_remove_ads.lpx  

（服务器 Cloudflare 可能拦爬虫；镜像见社区 fork，如 axtyet/Luminous 下 KeLee 的 `Bilibili_remove_ads.plugin`）

| | 可莉去广告 | 本仓库 v1（无效版） | 本仓库当前 |
|--|------------|---------------------|------------|
| 主场景 | **B 站 App** | 几乎只有 **Web** | **App + Web** |
| 主接口 | `app.bilibili.com/x/v2/feed/index` | 仅 `api.../wbi/.../rcmd` | 两者都有 |
| 手段 | **http-response** 改 JSON/proto | 只洗 Web Cookie | **http-request** 去身份 |
| MitM | app + api + grpc + … | 仅 api.bilibili.com | app + app.biliapi.net + api |
| 目标 | 去广告/精简 UI | 去个性化 | 去个性化 |

**结论：** Loon 用户主要在 **App** 测；v1 只匹配 Web rcmd → 日志无命中 → 「无效」。

### 5.2 App 登录态不只在 Cookie

App 首页 feed 常见：

- Query：`access_key`、`appkey`、`ts`、`sign`、…
- Header：`Cookie`（含 SESSDATA 等）、`Authorization`、`x-bili-mid`、…

**只删 Cookie 不够**；必须处理 **`access_key`**。  
去掉 query 参数后通常要 **重算 `sign`**，否则签名失败。

签名约定（社区脚本通用）：

1. 去掉 `sign`（以及要删除的 `access_key`）
2. 剩余参数按 **key 字典序** 拼 `k=v&k2=v2`
3. 末尾接 **app secret**
4. **MD5** 小写 hex → 新 `sign`

`scripts/tabulabili-rcmd.js` 内嵌轻量 MD5 + 若干公开 appkey→secret 表（`APP_SECRETS`）。  
**secret 会过时 / 因包名不同而变** → 若 resign 后请求失败，优先扩展/更新 appkey 表。

### 5.3 与「去广告」目标不要混

- 可莉：改 **响应体**，滤 `ad_info`、banner 等  
- 本插件：改 **请求身份**，让服务端下发「更不个性化」的列表  
- 可同开；冲突时先关其它 B 站脚本对比

---

## 6. 当前行为规格

### 6.1 模式（Argument `mode` / store `tabulabili_mode`）

| mode | 行为 |
|------|------|
| `refresh`（默认） | Cookie 仅留 buvid；App 去 access_key + 重签；删鉴权类头 |
| `pure` | Cookie 全删；App 同样去 access_key + 重签 |
| `mixed` | 全局计数器 `$persistentStore tabulabili_mixed_counter`：奇数清洗、偶数放行 |
| `origin` | `$done({})` 不改 |

读取顺序：`$argument.mode` → `$persistentStore` → 默认 `refresh`。

### 6.2 URL 匹配（插件内正则）

**清洗（`tabulabili-rcmd.js`）：**

```text
# App
^https:\/\/(?:app\.bilibili\.com|app\.biliapi\.net)\/x\/v2\/feed\/index

# Web
^https:\/\/api\.bilibili\.com\/x\/web-interface(?:\/wbi)?\/index\/top\/(?:feed\/)?rcmd
```

**采集（`tabulabili-capture.js`）——排除上述路径，避免双脚本抢 `$done`：**

```text
^https:\/\/(?:app\.bilibili\.com|app\.biliapi\.net|api\.bilibili\.com)\/(?!x\/v2\/feed\/index|x\/web-interface(?:\/wbi)?\/index\/top\/(?:feed\/)?rcmd)
```

**重要：** 同一 URL 不要挂两个会 `$done` 改写的脚本；采集脚本必须 **排除** feed/rcmd。

### 6.3 MitM hostname

```text
app.bilibili.com, app.biliapi.net, api.bilibili.com
```

未声明 / 用户未开 MitM / 证书不信任 → 脚本永不触发。

### 6.4 清洗细节（rcmd 脚本）

对命中请求：

1. `scrubCookie`：pure 删 Cookie；否则写成 `buvid3=...; buvid4=...`（来自 store 或当前 Cookie）
2. `scrubAuthHeaders`：删 `Authorization`、`x-bili-mid`、`x-bili-aurora-eid`、`x-bili-gaia-vtoken`、`x-bili-ticket` 等
3. App：`deauthAndResignUrl` 去 `access_key`/`access_token`/`session_key`/`sign` 后重签
4. `$done({ headers, url? })`

指纹 store key：`tabulabili_fingerprint`。

### 6.5 明确不做

- DOM / 自动点「换一换」
- 响应体去广告 / 精简「我的」
- gRPC/protobuf 推荐流（见 §8）
- tab 级 mixed 隔离（Chrome 有 tabId；Loon 用全局计数）

### 6.6 风控探针（`tabulabili-risk.js`，已实现）

**动机：** 去身份后用户需要知道推荐接口是否被 `-352` / 空列表 / 业务错误；对齐 bili-webos DiagPanel 的 rcmd 探针思路，但只做被动观测。

| 项 | 规格 |
|----|------|
| 类型 | `http-response`，`requires-body=true` |
| 匹配 | 与清洗相同的 App `feed/index` + Web `.../rcmd` |
| 改写 | **不改** body/headers，一律 `$done({})` |
| 成功 | `code===0` 且 items/item 长度 > 0 → 只日志 |
| 风控 | `code===-352` → 日志 + 可选通知 |
| 空列表 | `code===0 && n===0` → 日志 + 可选通知 |
| 其它 | 保留 code/items → 日志 + 可选通知 |
| Argument | `risk_notify`（默认 true）、`risk_debug`（默认 false） |
| 节流 | store `tabulabili_risk_last_notify` + `tabulabili_risk_last_code`；同类 30min 最多 1 次通知 |
| 安全 | 通知/日志不输出 Cookie 明文 |

**不是：** 完整诊断链（nav/playurl/图片代理）、主动 WBI 自签请求、账号全局封禁判定。

**gzip/非 JSON：** 解析失败则 skip 并打 `no-json` 日志，不误报 -352。

---

## 7. 插件格式约定（仅 Loon TF 现代语法）

项目门槛为 TF 3.5.3(1007)，采用官方 Rewrite V2 + Script V2：

```text
#!name = xxx
#!desc = xxx
#!loon_version = 3.5.3(1007)

[Argument]
mode = select,"refresh","pure",...

[Rewrite]
request if ${mode} == "pure" && ${url} ~= /^https:\/\/api\.example\.com\// then request.header.del(["Cookie"])

[Script]
request if ${url} ~= /^https:\/\/api\.example\.com\// then script("https://example.com/script.js", {${mode}}) with tag="示例", timeout=10, requires_body=false

[MitM]
hostname = a, b, c
```

- 段名保持 `[MitM]`。
- 清洗/采集：`requires_body=false`；风控探针：`requires_body=true`。
- 远程脚本必须 public raw 可拉，指向 main；本地模板保留 `scripts/...`，由使用者调整可访问路径。
- 参数 `mode` 给 request 脚本；`risk_notify`/`risk_debug` 给 response 探针。
- 不保留旧 Script/Rewrite 语法入口或稳定版兼容负担；所有同内容入口勿重复启用。

---

## 8. 已知限制与后续工作

### 8.1 gRPC

新版 App 部分接口走 `grpc.biliapi.net` + protobuf。  
当前 **只覆盖 JSON REST** ` /x/v2/feed/index `。

若用户日志 **完全没有** `feed/index` / `TabulaBili App推荐清洗`，但 App 首页仍个性化：

1. 查最近请求是否出现 `grpc.biliapi.net` + pegasus/feed 类 path  
2. 若是 → 需要 binary-body / proto 方案（难度高，可莉 helper 是 response 向）  
3. 请求侧去身份在 gRPC 上要改 metadata/token，另开设计

### 8.2 重签失败

现象：feed 请求 4xx / 业务 code 非 0、首页空白。

排查：

- 日志是否有 `resign fail` 或只有 `resigned` 但服务端拒签
- 抓原请求 `appkey`，补 `APP_SECRETS`
- 临时：mode=`origin` 确认插件为根因
- 降级策略（未实现）：不去 access_key，仅洗 Cookie（弱效果）

### 8.3 首屏 / SSR（Web）

无「换一换」时，Web 首屏 HTML 可能仍个性化；后续 rcmd XHR 才变。  
验收应 **多刷新 / 多划**，不要只看首屏 1 秒。

### 8.4 与其它插件冲突

- 多个脚本改同一 URL 的 headers/url → 后写覆盖、行为未定义  
- 可莉改 response，本插件改 request，一般可并存；异常时二分

### 8.5 可能的增强

- [x] 风控探针：被动 response + 节流通知 + Argument 开关（`tabulabili-risk.js`）
- [ ] 探针记录 HTTP 状态 / message / 耗时到 store（仍不弹窗）
- [ ] `-352` 时自动提示切换 refresh / 不清自动改 mode
- [ ] 热门接口替换模式（改 URL 到 popular，需验 App 响应 schema）  
- [ ] gRPC feed 支持  
- [ ] 更完整的 iOS appkey 表自动维护  
- [ ] BoxJs / 持久化面板  
- [ ] Surge / Quantumult X 模块移植（API 略有差异）

---

## 9. 如何验证「成功」（给用户/AI 联调）

### 9.1 搜什么

**脚本日志关键词（优先）：**

| 关键词 | 含义 |
|--------|------|
| `TabulaBili` | 总前缀 |
| `App推荐清洗` | 插件 tag：App 命中 |
| `Web推荐清洗` | Web 命中 |
| `app feed mode=` | 脚本 console：App 清洗执行 |
| `resigned` | access_key 已处理并重签 |
| `web rcmd mode=` | Web Cookie 已洗 |
| `fingerprint updated` | 指纹采集成功 |
| `pass mode=origin` | 模式关闭，未清洗 |
| `[TabulaBili][risk]` | 风控探针日志前缀 |
| `App风控探针` / `Web风控探针` | response 脚本 tag |
| `code=-352` | 本次推荐被风控 |
| `throttled notify` | 通知被 30min 节流 |

### 9.2 从哪个域名搜

| 场景 | 主机 | 路径 |
|------|------|------|
| App | **`app.bilibili.com`** 或 **`app.biliapi.net`** | **`/x/v2/feed/index`** |
| Web | **`api.bilibili.com`** | **`top/feed/rcmd`** 或 **`/wbi/index/top`** |

### 9.3 看请求还是响应体？

| 看什么 | 要否 | 说明 |
|--------|------|------|
| **请求头 Cookie** | ✅ | refresh 应近似仅 buvid；无 SESSDATA |
| **请求 URL** | ✅ App | 无 `access_key`；有新 `sign` |
| **响应体 code** | ✅ 风控 | 探针读 `code`/`item`；**不改** body |
| **脚本日志** | ✅ | 最省事 |

### 9.4 操作顺序

1. 插件更新 + 模式 `refresh` + MitM 开 + 证书信任  
2. **强杀 B 站 App** 再开  
3. 首页多下拉  
4. Loon 最近请求：找 `feed/index`  
5. 日志搜 `TabulaBili`  

有 `App推荐清洗` 或 `app feed mode=refresh resigned` → 请求侧成功。  
「推荐是否足够随机」是产品体感，受 B 站策略影响，需与日志分开评价。

---

## 10. 开发工作流

### 10.1 改代码检查清单

1. 改 `scripts/*.js` 后，确认所有远程入口的 **script("URL") 仍指向 main**，本地模板保留原路径用途
2. 改插件清单时同步全部五份远程入口；本地模板同步逻辑，仅说明和 script 路径不同
3. 新增 URL 匹配时：  
   - 清洗与采集 **互斥**  
   - MitM hostname 覆盖新主机  
4. 更新 `README.md` 用户可见变更  
5. **更新本文 AGENTS.md** 对应章节  
6. commit 信息说明「为何」而不只是「改了什么」  
7. push 后 `curl -sI` 验证 raw 入口 200

### 10.2 常用命令

```bash
cd /root/repos/TabulaBili-Loon
# 同步安装入口
cp plugin/TabulaBili.plugin TabulaBili.plugin

git add -A
git commit -m "fix: ..."
git push

curl -sI "https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/TabulaBili.plugin" | head -3
curl -sI "https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/scripts/tabulabili-rcmd.js" | head -3
```

### 10.3 不要做的事

- 根目录安装入口便于发现，`plugin/` 副本也可正常 raw GET；必须实测，不能把目录名当作 404 原因。
- 不要在采集脚本对 feed URL 再 `$done({headers})`  
- 不要默认改成 pure  
- 不要把去广告逻辑塞进本插件而不改产品定义  
- 不要假设 Loon 有 DOM/content script  
- 不要用私有 raw 给 Loon 拉脚本  

---

## 11. 关键代码入口图

```text
[Loon 加载 TabulaBili.plugin]
        │
        ├─ Argument.mode ──► 传入 script argument=[{mode}]
        │
        ├─ MitM(app*, api.bilibili.com)
        │
        ├─ 其它 app/api 请求 ──► tabulabili-capture.js
        │                         写 tabulabili_fingerprint
        │                         $done({})
        │
        ├─ feed/index 或 .../rcmd ──► tabulabili-rcmd.js (request)
│                                   scrub + resign
│                                   $done({ headers, url? })
│
└─ 同 URL 响应 ─────────────► tabulabili-risk.js (response)
                                    parse code / items
                                    throttle notify if -352/...
                                    $done({})  // 不改 body
```

---

## 12. 会话背景（人类偏好）

- 用户：**Beck Chao**（beckyeeky）  
- 沟通：中文、**简练直接**；讨厌冗长套话  
- 平台：Loon on iOS 为主；仓库在 GitHub  
- 相关对话脉络：  
  1. 基于 TabulaBili releases 做 Loon 可行性分析  
  2. 建私有仓 → 改 public  
  3. 用户反馈无效 → 对照可莉 lpx → 补 App feed + resign  
  4. 验证关键词 / 域名 / 请求 vs 响应说明  
  5. 要求生成本文件供其它 AI 接手  

---

## 13. 参考链接

| 资源 | URL |
|------|-----|
| 本仓库 | https://github.com/beckyeeky/TabulaBili-Loon |
| 安装插件 | https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/TabulaBili.plugin |
| 上游扩展 | https://github.com/tjsky/TabulaBili |
| 上游 releases | https://github.com/tjsky/TabulaBili/releases |
| 可莉参考（去广告，非同源目标） | https://kelee.one/Tool/Loon/Lpx/Bilibili_remove_ads.lpx |
| Loon 插件文档 | https://loon0x00.github.io/docs/Plugin/ |
| Loon Script API | https://loon0x00.github.io/docs/Script/script_api |
| 可莉资源索引 | https://github.com/luestr/ProxyResource |

---

## 14. 变更日志（仓库级决策）

| 时间线 | 决策/变更 |
|--------|-----------|
| 初始 | 可行性：Loon 可做请求侧 Cookie 清洗；DOM 不可移植 |
| v0 | 仅 Web rcmd + api MitM；private → public |
| raw 坑（历史误判，已更正） | 2026-10-11 实际 GET `plugin/TabulaBili.plugin` 为 200；目录名不导致 404 |
| 无效反馈 | 对齐可莉 App `feed/index`；去 access_key + MD5 重签；扩 MitM |
| 本文 | 固化全部考虑供 AI 接手 |
| 风控 | 参考 bili-webos `-352` 探针；落地被动 `tabulabili-risk.js` + 节流通知 |

---

## 15. 2026-10-11 现代入口与核心修复（优先于历史规格）

- main 默认入口 `TabulaBili.plugin` 仅支持 Loon TF ≥ 3.5.3(1007)，采用 Rewrite V2 + Script V2；不维护稳定版/旧语法实现。根目录与 plugin/ 的 `.plugin`、`.tf.plugin` 及 `.conf` 远程入口逐字同步，仅为兼容地址，勿重复启用。本地模板只有说明与脚本路径不同，保留 `scripts/...` 用途。
- 官方实页 Rewrite 是 `request if ... then request.header.del(...)`；Script 是 `request/response if ... then script("URL", {${mode}}) with requires_body=false`。Script V2 文档基线 983，Rewrite 基线 978，998 已正式支持。旧技能 `http-request if` 示例过时，不照抄。
- Web pure 使用 Rewrite，Web refresh/mixed 使用 Script，两者互斥；App 签名/指纹/计数与被动通知保留 JS。
- 清洗限 GET 与精确端点（末尾 `(?:\?|$)`），采集排除同一精确端点。播放/互动与 `feed/index/story` 不清洗；mixed 非推荐不计数。
- 指纹只取 buvid3/buvid4/buvid，当前请求优先，存储回退重新过滤；不要复用带账号 Cookie 的存储值。
- App 签名改为 MD5(按 key 排序的实际 percent-encoded query + secret)；未知 appkey/异常整体原样放行，不再假用默认密钥。此时清洗未完成，不宣称去身份成功。
- 风控异常按 kind:code 独立时间戳节流，交替异常不绕过；risk_debug=false 不打印正常结果。仅日志/通知，响应保持原样。
- 新 Script 同一请求/响应各最多选第一条命中；与可莉/cleaner 同阶段响应脚本会竞争，本探针可能不运行。旧 §8.4 的“后写覆盖”不作为现代匹配依据。
- 所有现有 PR 核心修复与默认入口升级直接发布 main；安装插件和脚本均使用 main，无需分支试用。将来若固定 commit 复现，插件 URL 和其内部全部远程脚本 URL 必须同时固定。
- 关联核对：TabulaBili HEAD e580595627e60210ba1dc39c743c16e54383de35，v1.2.0 后仅文档；bili-webos e38ed9a83f12 最近播放恢复/限时请求/DASH/CDN 与关注功能不移植，仅保留 rcmd 风控思路；cleaner aa6bbd4c278b 的 UID/竖屏/时长/分区是响应过滤，不合并产品职责。
- 可莉实际原站插件/两份引用脚本已用此前实测 UA 成功 GET，日期 10-02、最低 998；两脚本 SHA-256 与 10-03 保存记录一致（完整 hash 见 README）。首页现为 Response jq Body Rewrite，命中会禁用本 Response Script；其 app.biliapi.net REJECT 亦可能阻断清洗流量，不复制。空降使用 bsbsb sponsor 的 BV/CID 查询，skip≥8 秒/start+2 秒弹幕 + ViewProgress 替换 Chronos（清 sign） + 模块识别文字与 @airborne 后 seekTo/撤销返回。Loon 能通过响应让 App 加载模块实现跳转，不是直接操控播放器；不扩大本项目去身份职责。Chronos HEAD 9526528ebc3c8fbf835da481884412b12c5129b9（10-07）只新增 106d21a147f49e9d4ef86e2e8523474f.zip，现引用映射未指向它。
- LoonNews 最新可见 TF 3.5.3(1007) 的 include-tun/IP Rewrite 是 IP 层特性，不适用于推荐身份清洗；不添加无关配置。
- 回归：`python3 -m unittest discover -s tests -v`、`node tests/test_scripts.js`。新增清单结构、模式、指纹、MD5/编码重签、未知密钥、播放不改、通知开关/节流及单次 done 验证。非 Loon 解析器，不代替真机服务端验签；发布后的真机验收仍需依 §9 执行，不宣称已完成真机验证。

**维护约定：** 任何改变匹配 URL、模式语义、签名逻辑、MitM、安装路径的 PR/commit，必须改本文件 §4–§9 或 §15，避免下一位 AI 重复踩坑。
