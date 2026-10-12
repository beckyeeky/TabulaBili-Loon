# 上游审计与维护记录

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


更多实现细节见 [AGENTS.md](../AGENTS.md)。
