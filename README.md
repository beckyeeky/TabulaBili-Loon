# TabulaBili-Loon（初见哔哩 · Loon 插件）

在 **Loon** 网络层复现 [TabulaBili-Plus](https://github.com/tjsky/TabulaBili) 的核心思路：  
只清洗 **B 站 Web 首页推荐接口** 的请求 `Cookie`，减弱基于账号登录态的个性化推荐；  
视频播放、历史、点赞收藏等其它请求保持原样。

> 灵感 / 上游： [tjsky/TabulaBili](https://github.com/tjsky/TabulaBili)（MIT）· 原作者 [wangdaodaodao](https://github.com/wangdaodaodao)

---

## 功能

| 模式 | 行为 |
|------|------|
| **refresh（探索，默认）** | 推荐请求只保留 `buvid3` / `buvid4` |
| **pure（纯净）** | 推荐请求删除全部 Cookie |
| **mixed（混合）** | 全局奇偶交替：清洗 / 原样 |
| **origin（个性）** | 不干预 |

**作用接口（Web）：**

- `api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd`
- `api.bilibili.com/x/web-interface/index/top/rcmd`（兼容）

**不做：**

- 页面 DOM / 自动点「换一换」（Loon 无 content script）
- B 站 App 原生 feed（接口不同，可后续加）

---

## 安装

### 前置

1. Loon 已安装并信任 MitM 证书  
2. 建议 Loon ≥ 3.2.1 (733)（`[Argument]` UI）

### 方式 A：远程插件（仓库需 **Public**，或你已把 raw 挂到可访问 CDN）

插件地址：

```text
https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/plugin/TabulaBili.plugin
```

Loon → 配置 → 插件 → `+` → 粘贴 URL → 保存并更新。

> ⚠️ **当前仓库为 Private 时**，Loon 无法直接拉取 GitHub raw。请用方式 B，或暂时改为 Public / 自建可访问 raw 源后改 `script-path`。

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
3. Safari 打开 [www.bilibili.com](https://www.bilibili.com) 首页，多刷新 / 点「换一换」观察推荐是否变「大盘」  
4. 进视频页确认画质 / 登录态正常  

**建议：** 优先用 `refresh`。`pure` 可能触发 B 站匿名固定缓存流（同内容重复）。

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
