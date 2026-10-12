# TabulaBili-Loon · 初见哔哩

减弱 B 站 App 和网页首页基于账号的个性化推荐，仅清洗推荐请求的登录信息。播放、历史、点赞和收藏等请求保持原样；不提供去广告或自动跳过功能。

## 安装

要求 **Loon TestFlight ≥ 3.5.3(1007)**，已安装并信任 MitM 证书。

[一键导入 Loon](loon://import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fbeckyeeky%2FTabulaBili-Loon%2Fmain%2FTabulaBili.plugin)

或在 Loon → 配置 → 插件中添加：

```text
https://raw.githubusercontent.com/beckyeeky/TabulaBili-Loon/main/TabulaBili.plugin
```

启用后，在 B 站首页下拉刷新即可。已安装的用户更新插件及脚本即可；各安装入口内容相同，**只启用一个**。

## 模式

在插件参数中选择，建议先用默认的 `refresh`。

| 模式 | 行为 |
|---|---|
| `refresh` 探索（默认） | 去除推荐请求的登录信息，保留设备标识 |
| `pure` 纯净 | 进一步删除推荐请求的 Cookie，可能出现重复的缓存推荐 |
| `mixed` 混合 | 清洗与原样请求交替，全局计数，不区分页面 |
| `origin` 原始 | 不清洗推荐请求 |

内置风控探针：推荐被风控、返回空列表或业务异常时通知，同类异常 30 分钟内最多通知一次。通知默认开启，调试日志默认关闭，可在插件参数中调整。

## 注意事项

- 仅处理成功完成 MitM 的 App HTTP 首页推荐及 Web 推荐接口，不覆盖 gRPC 推荐流，也不能修正网页首屏内容。
- App 的签名参数无法识别或重签失败时，保留原始请求；不能保证所有客户端都能完成去身份处理。
- 可与去广告插件配合使用，但其首页响应改写可能阻止本插件的风控探针运行。遇到异常，先单独启用本插件，并切换 `origin` 对照。
- 推荐异常不等于账号被封禁，也不能据此确定原因。
- 已通过离线回归测试，**尚未完成 Loon TF 真机及服务端验签验证**，不保证推荐效果。

## 项目资料

- [实现与维护说明](AGENTS.md)
- [上游审计与变更记录](docs/maintenance.md)
- [本地安装模板](plugin/TabulaBili.local.plugin)

基于 [tjsky/TabulaBili](https://github.com/tjsky/TabulaBili) 的思路，感谢原作者 [wangdaodaodao](https://github.com/wangdaodaodao) 及 Loon 社区。

[MIT License](LICENSE)
