# TabulaBili-Loon（初见哔哩 · Loon 插件）

在 **Loon** 网络层复现 [TabulaBili-Plus](https://github.com/tjsky/TabulaBili) 的核心思路：  
清洗 **B 站 Web / App 首页推荐** 请求中的登录态，减弱基于账号的个性化推荐；  
视频播放、历史、点赞收藏等其它请求保持原样。

> 灵感 / 上游： [tjsky/TabulaBili](https://github.com/tjsky/TabulaBili)（MIT）· 原作者 [wangdaodaodao](https://github.com/wangdaodaodao)  
> **开发 / 其它 AI 接手：** [AGENTS.md](./AGENTS.md)
---

## 功能

| 模式 | 行为 |
|------|------|
| **refresh（探索，默认）** | 推荐请求只保留 `buvid`，并去掉 App `access_key` 后重签 |
| **pure（纯净）** | 推荐请求删除 Cookie + 去 `access_key` |
| **mixed（混合）** | 全局奇偶交替：清洗 / 原样 |
| **origin（个性）** | 不干预 |

**作用接口：**

| 端 | URL |
|----|-----|
| **App（主）** | `app.bilibili.com` / `app.biliapi.net` → `/x/v2/feed/index` |
| **Web** | `api.bilibili.com/x/web-interface(/wbi)/index/top/feed/rcmd` |

> 可莉 [Bilibili_remove_ads.lpx](https://kelee.one/Tool/Loon/Lpx/Bilibili_remove_ads.lpx) 主要是 **App 去广告（改响应体）**。  
> 本插件目标不同：**去个性化（改请求身份）**。接口/MitM 范围对齐 App 首页 feed。

**不做：**

- 去广告 / 精简「我的」页（请用可莉等插件）
- 页面 DOM / 自动点「换一换」
- gRPC 推荐流（新版 App 若全面 gRPC 需另做 proto）

### 风控探针（已内置）

被动解析推荐接口 **响应体**（不改内容）：

| 结果 | 行为 |
|------|------|
| `code=0` 且有条目 | 日志正常；默认不通知 |
| `code=-352` | 本次推荐被风控；可本地通知 |
| `code=0` 空列表 | 提示空推荐 |
| 其它 code | 提示业务异常 |

插件参数：

- **风控通知**（默认开）：异常通知，**同类 30 分钟最多 1 次**
- **风控调试日志**（默认关）：成功也写脚本日志

`-352` ≠ 账号全局封禁，也不等于「一定是海外 IP」。

日志搜：`[TabulaBili][risk]` / `风控探针` / `code=-352`。

---

## 安装

### 前置

1. Loon 已安装并信任 MitM 证书  
2. 建议 Loon ≥ 3.2.1 (733)（`[Argument]` UI）

### 方式 A：远程插件（推荐）

仓库已 **Public**。Loon → 配置 → 插件 → `+` → 粘贴：

```text
https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/TabulaBili.plugin
```

备用（jsDelivr）：

```text
https://cdn.jsdelivr.net/gh/beckyeeky/TabulaBili-Loon@main/TabulaBili.plugin
```

> 安装入口保留根目录便于发现；`plugin/TabulaBili.plugin` 在 2026-10-11 实际 GET 返回 200。目录名不会天然导致 404。

### 可选现代语法（Loon ≥ 3.5.1(998)）

旧入口继续兼容，现代入口为 `TabulaBili.tf.plugin`（`plugin/` 有同步副本）。两者**只能启用一个**。

合并后入口：
```text
https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/TabulaBili.tf.plugin
```

PR 未合并时，直接安装 main 既没有新插件也没有新脚本。请将本分支的 `TabulaBili.tf.plugin` 下载为本地文件，把其中全部 `/main/scripts/` 替换为 `/feat/loon-tf-modern-20261011/scripts/`，再导入 Loon；也可把 `main` 替换为本 PR 的完整 commit SHA 固定版本。**不能只改插件 URL，不改其内脚本 URL。**

现代入口仅将 Web `pure` 的删 Cookie/鉴权头迁移到官方 Rewrite V2；保留 WBI 查询参数。App 重签、指纹、mixed 状态和通知仍由 JS 处理。GET、精确路径和必要 Response URL Guard 限定范围，Web pure 与清洗脚本互斥。

官方 [Rewrite V2](https://nsloon.app/docs/Rewrite/rewrite_v2/) 使用 `request if ... then request.header.del(...)`；[Script V2](https://nsloon.app/docs/Script/script_v2/) 使用 `request/response if ... then script(URL, {${mode}}) with requires_body=...`。技能示例的 `http-request if` 不适用于此版本。

[LoonNews](https://t.me/s/LoonNews) 当前可见 TestFlight 3.5.3(1007)，新增 `include-tun` / `[IP Rewrite]` 是 IP 数据包路由/处理，不是 HTTP 去身份；不为追求新特性而添加无关规则。现代语法已在商店版 3.5.1(998) 支持。证书创建/安装可能需官方网页工具，已有信任证书不受影响。

### 2026-10-11 上游与关联项目核对

- **tjsky/TabulaBili** HEAD `e580595627e60210ba1dc39c743c16e54383de35`：v1.2.0 后仅 README/致谢/链接变化，没有新的去身份核心算法需要搬入。仍保留 refresh 默认、四模式和不签 Cookie 的 WBI 边界。
- **bili-webos** HEAD `e38ed9a83f12`（10-11）：近期修播放恢复、请求时限、关注按钮与 DASH/CDN 诊断；DiagPanel 仍对 WBI rcmd `-352` 做诊断。保留被动探针，不搬 DOM、播放器、主动登录/播放探测，也不把 `-352` 唯一归因海外 IP。
- **beckyeeky/bilibili-cleaner-loon** HEAD `aa6bbd4c278b`（08-01）：UID、竖屏、时长、分区过滤为响应内容筛选，仍不并入请求去身份插件；可另选安装。其首页响应脚本与本探针存在**同阶段竞争**。
- **可莉**：用此前实测 UA `Loon/1005 CFNetwork/3896.100.1.2.1 Darwin/27.0.0` 成功 GET 原站插件和两份实际引用脚本；插件日期 2026-10-02，已使用 Rewrite/Script V2（最低 998）。请求/响应脚本 SHA-256 分别 `1b7e1d51efd960b10a22ea322630e72ecee646f2fdaad8a097c9e530fde1a857`、`e4a8426cffbfca85c78286126a10813051a2d1aeed018119bbabe3db5da85728`，与 10-03 已取源码一致。首页现在是 Response JSON jq 过滤，官方文档说明 Response Body Rewrite 命中会禁用 Response Script，因此本探针可能不执行（不只是脚本排序问题）。其 `app.biliapi.net` REJECT 路由也需在 App 无命中时排查，不能照搬进本插件。
- **可莉空降/Chronos**：实际请求脚本向 bsbsb.top 发送 BV/CID 的 sponsor 查询，只选 skip 且 ≥8 秒片段，start+2 秒注入“空指部已就位”与结束时间；ViewProgress 响应脚本改 Chronos URL/MD5 并清 sign。实际模块识别文字与 @airborne，调用 seekTo，且提供约 5 秒撤销返回入口。**Loon 可以通过改响应让 App 加载模块实现跳转，但不是 Loon 直接控制播放器。** `kokoryh/chronos` HEAD `9526528ebc3c8fbf835da481884412b12c5129b9`（10-07）仅新增 `106d21a147f49e9d4ef86e2e8523474f.zip`；本次实际引用脚本映射仍是原通用/HD/inter 包，未引用新增包。保持去身份范围，不引入空降、第三方观看标识上传或播放器模块供应链。

### 本次核心修复与离线验证

- 精确推荐端点，避免 `feed/index/story`、相邻路径和 POST 被误重签；非推荐请求不推进 mixed 计数。
- 当前请求指纹优先，存储回退只取 buvid 字段；修复仅有 buvid4/buvid 的丢失及存储混入登录 Cookie 的风险。
- App 未知 appkey 不再套用其它客户端 secret；重签失败整体原样放行（因此该请求去身份未完成，可切 origin 对照）。MD5 对实际编码后、按 key 排序的 query 签名；移除重复编码代码。
- 修复异常交替绕过 30 分钟节流和 risk_debug 关闭时仍打印成功日志。

运行：`python3 -m unittest discover -s tests -v` 与 `node tests/test_scripts.js`。离线测试不能代替 Loon 导入、MitM 命中、服务端验签和实际推荐随机性验收；真机验收仍需执行下方使用步骤。

### 方式 B：本地安装（Private 推荐）

1. `git clone` 本仓库到可被 Loon 读取的位置（如 iCloud / 电脑同步目录）  
2. 将 `plugin/TabulaBili.plugin` 内两处 `script-path=` 改为本地路径或你的可访问 HTTPS  
3. 在 Loon 中以「文件 / URL」导入该 `.plugin`

本地示例（按你设备路径改）：

```text
script-path=tabulabili-rcmd.js
```

（若 Loon 要求完整路径，请写成 `file:///...` 或 App 内本地脚本路径。）

---

## 使用

1. 开启插件，MitM 包含 `api.bilibili.com`（插件已声明）  
2. 插件参数里选择 **推荐模式**（默认 `refresh`）  
3. **优先测 B 站 App**：下拉刷新首页推荐；也可 Safari 打开 bilibili.com  
4. Loon → 仪表盘 / 脚本日志：应看到 `TabulaBili App推荐清洗` 触发  
5. 进视频页确认仍可登录态播放  

**建议：** 优先 `refresh`。`pure` 可能触发固定缓存流。  
**与去广告/过滤插件：** 请求清洗与响应过滤分属阶段，但现代 Loon 同一响应只选第一条匹配 Script；可莉/cleaner 首页响应脚本可能使本探针不执行。优先保留过滤时可关闭本插件风控通知；需要诊断时暂关其它首页响应脚本。异常用 origin 和单插件对照，不承诺两种响应脚本同时运行。
**更新插件后请点「更新」** 再杀进程重开 B 站。

**重置设备指纹：** 在 Safari 清除 bilibili.com 站点数据，或删 Loon 脚本存储后重新打开 B 站（采集脚本会重写 `buvid`）。

---

## 目录

```text
TabulaBili-Loon/
├── AGENTS.md
├── TabulaBili.plugin            # 安装入口（根目录 raw）
├── plugin/TabulaBili.plugin
├── scripts/
│   ├── tabulabili-rcmd.js       # 推荐请求去身份
│   ├── tabulabili-capture.js    # buvid 指纹采集
│   └── tabulabili-risk.js       # 被动风控探针
├── LICENSE
└── README.md
```

---

## 原理（简述）

Chrome 扩展用 `declarativeNetRequest` 改推荐请求头；  
Loon 用 `http-request` 脚本改同一批接口的 `Cookie`：

- Wbi 签名校验的是 URL Query，**不签 Cookie** → 只改 Cookie 一般不会 `-403`  
- 范围仅限 rcmd feed，播放相关 API 不匹配 → 会员画质不受影响  

---

## 注意

- 仅覆盖 **走 Loon 代理且完成 MitM** 的流量（通常是 Safari Web）  
- 可能与其它 B 站去广告 / 响应体改写插件叠加，若异常可先关其它插件对比  
- B 站接口变更时需更新 URL 正则  
- 本插件按 MIT 提供，使用风险自担；不保证永久有效  

---

## 致谢

- [TabulaBili-Plus (tjsky)](https://github.com/tjsky/TabulaBili)  
- [TabulaBili 原作 (wangdaodaodao)](https://wangdaodao.me/2026/tabulabili/)  
- Loon 官方文档：Plugin / Script API  

## License

MIT — 见 [LICENSE](./LICENSE)
