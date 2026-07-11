# TabulaBili-Loon（初见哔哩 · Loon 插件）

在 **Loon** 网络层复现 [TabulaBili-Plus](https://github.com/tjsky/TabulaBili) 的核心思路：  
只清洗 **B 站 Web 首页推荐接口** 的请求 `Cookie`，减弱基于账号登录态的个性化推荐；  
视频播放、历史、点赞收藏等其它请求保持原样。

> 灵感 / 上游： [tjsky/TabulaBili](https://github.com/tjsky/TabulaBili)（MIT）· 原作者 [wangdaodaodao](https://github.com/wangdaodaodao)

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

> 说明：GitHub raw 对路径 `plugin/*.plugin` 会 404，故安装入口放在仓库根目录 `TabulaBili.plugin`（与 `plugin/` 内内容同步）。脚本仍用 `scripts/*.js` raw，可正常拉取。

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
**与去广告插件：** 可和可莉同开；若异常先关其它 B 站插件对比。  
**更新插件后请点「更新」** 再杀进程重开 B 站。

**重置设备指纹：** 在 Safari 清除 bilibili.com 站点数据，或删 Loon 脚本存储后重新打开 B 站（采集脚本会重写 `buvid`）。

---

## 目录

```text
TabulaBili-Loon/
├── plugin/TabulaBili.plugin     # Loon 插件清单
├── scripts/
│   ├── tabulabili-rcmd.js       # 推荐接口 Cookie 清洗
│   └── tabulabili-capture.js    # buvid 指纹采集
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
