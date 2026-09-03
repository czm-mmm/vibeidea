# Changelog

本项目的主要变化记录在此。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 新增独立子项目 `projects/obsidian-study-companion`：Obsidian 个人学习插件源码、中文介绍、自拟示例和测试，支持聊天、分步练习与初版复习安排。
- 接入用户选定的 A1 选牌点击声和 B1 出牌纸牌声（Kenney CC0），支持音效开关、首次交互解锁、后台静音和离线缓存。

### Security

- 收紧部署权限，将 Actions 固定到提交 SHA，使用 Node.js 24 LTS 并在发布前执行依赖与安全产物检查。
- 增加 Cloudflare 安全响应头、跨托管 HTML 基础 CSP，以及完整资源 CSP 的观察模式。
- 本地预览默认仅监听回环地址，移除通用穿透域名白名单；增加 Dependabot 更新配置与安全维护说明。

### Changed

- 重做挖角后的插牌选择：牌面无重叠横向排列，插入按钮直接位于相邻牌之间，并显示两侧当前数字。
- README 截图改为高清全宽展示。

### 计划中

- 对局自动保存与恢复。
- 生涯战绩和难度胜率统计。
- 新手引导与对局回放。

## [0.1.0] - 2026-09-02

### Added

- 完整的 3–5 人单机游戏流程与多轮计分。
- 学徒、艺人、团长三档 AI。
- 响应式触控界面、规则页、设置页和 PWA 离线支持。
- 纯 TypeScript 规则引擎、Vitest 边界测试和多种子 AI 全局模拟。
- GitHub Pages 与 Cloudflare Pages 部署。

### Fixed

- 按原版卡牌双阅读区修正正反面数字和阅读方向。
- 修正开局整手旋转时的数字互换与左右牌序反转。
- 调整手牌间距和黑白数字圆点的视觉距离。

[Unreleased]: https://github.com/czm-mmm/vibeidea/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/czm-mmm/vibeidea/releases/tag/v0.1.0
