# 安全维护

这是公开源码的纯前端单机游戏，不收集账号、支付或个人资料。不要把 API 密钥、数据库密码或部署令牌放进源码、`public/` 或 `VITE_*` 变量；前端构建内容对访问者公开。`.gitignore` 只能减少误提交，不能撤销已泄露的凭据。

## 已配置的防护

- GitHub 构建任务只有仓库只读权限；Pages 写权限与 OIDC 权限仅授予发布任务。仅 main 可以发布。
- Actions 固定到完整提交 SHA，检出后不保留 Git 凭据；构建使用 Node.js 24 LTS。
- CI 和发布前执行依赖审计、类型检查、测试、生产构建、安全产物检查。高危及严重依赖告警会阻止发布。
- Dependabot 每周为 npm 和 GitHub Actions 提交更新建议，不自动合并。
- 开发和预览默认只监听 `127.0.0.1`，不再允许整个穿透域名后缀。需要外部预览时，仅显式允许自己控制的准确域名，并增加访问控制。

## 两个托管平台的差异

安全策略统一维护在 `config/security.ts`，构建自动生成 `dist/_headers` 和 HTML 安全元信息，避免手工修改构建结果后丢失配置。

| 防护 | Cloudflare Pages | GitHub Pages |
| --- | --- | --- |
| 禁止 base 标签改变 URL 基准、插件对象和表单提交 | HTTP CSP + HTML meta | HTML meta |
| 防其他站点嵌入页面 | `frame-ancestors 'none'` 和 `X-Frame-Options: DENY` | 无法仅靠静态 HTML 配置，未实现同等防护 |
| 防 MIME 类型猜测、关闭摄像头/麦克风/定位等权限 | 自定义 HTTP 响应头 | 不读取 Cloudflare 的 `_headers`，本次不能配置同等响应头 |
| Referrer Policy | 响应头 + HTML meta | HTML meta |
| 完整同源资源 CSP | Report-Only 观察模式 | 未配置同等 Report-Only 响应头 |

完整资源 CSP 目前只观察、不拦截，不应宣称已经阻止外部脚本。没有配置远程报告收集服务，观察结果留在浏览器控制台。内联样式被允许，以兼容卡牌大小、插牌间距和动画；脚本策略不允许 `unsafe-inline` 或 `unsafe-eval`。

切换为强制策略前，在桌面和手机浏览器检查首页、选牌、挖角、插牌、回合结束、字体、PWA 安装与断网重载，并检查 CSP 违规。完成兼容性验证后，再将完整策略改为强制 CSP 并发布；不要为消除警告直接放开所有来源。

`_headers` 适用于 Cloudflare Pages 静态响应；如果以后增加 Functions 或 Worker，需要在其响应中另行配置。GitHub Pages 若要求同等级防护，需要支持自定义响应头的托管或代理方案，不使用不可靠的 JavaScript 防嵌入代码冒充等价保护。

## 验证和发布

使用 Node.js 24 LTS：

```bash
npm ci
npm run audit:security
npm run verify
```

`verify` 检查游戏规则、安全配置、构建产物、相对资源路径以及 PWA 入口缓存。它不是浏览器交互测试，也不能证明不存在所有漏洞。构建检查要求 Node.js 24 的原生 TypeScript 类型擦除能力。

Cloudflare 使用构建生成的 `dist/`，不能漏掉 `_headers`。现有 Windows 发布脚本会先验证再上传；GitHub Pages 在 main 的工作流验证成功后发布。若使用 Cloudflare Git 自动构建，还需将该项目的 Build command 设为 `npm run audit:security && npm run verify`，不能假设它会等待 GitHub CI。`.node-version` 为 GitHub Actions 和 Cloudflare 提供统一版本选择；Cloudflare 后台若另有 `NODE_VERSION`，需要检查是否覆盖文件配置。

发布后应直接检查线上响应头，而不是只看本地构建成功。已打开的旧 PWA 可能仍使用旧缓存，须完成更新并刷新后再复核。

## 仓库和账户设置（需要维护者确认）

- 为 GitHub 与 Cloudflare 开启双重验证或通行密钥，并安全保存恢复方式。
- 检查协作者、分支保护和部署环境审批；限制主分支强推与删除，将必要 CI 检查设为合并条件。
- 检查并撤销不用的令牌；剩余令牌限定资源、权限和有效期。不要在公开 Issue 中发送令牌。
- 确认仓库的依赖告警、密钥扫描与推送保护是否启用；仅提交配置文件不能替代这些账户/仓库设置。

这些账户设置不会由本次源码改动自动开启。

## 报告漏洞

请不要在公开 Issue 中发布可利用细节、个人数据或凭据。优先通过 GitHub 仓库维护者主页提供的联系方式私下报告，包含影响范围、复现步骤和建议修复方式。若仓库 Security 页提供私密漏洞报告入口，也可以使用该入口；若没有私密渠道，请先通过普通 Issue 请求维护者提供联系方式，不要附利用细节。密钥一旦泄露，应先撤销或轮换，再清理历史。普通功能缺陷和规则问题请直接提交 Issue。

参考：[GitHub Actions 安全指南](https://docs.github.com/en/actions/reference/security/secure-use)、[Cloudflare 响应头](https://developers.cloudflare.com/pages/configuration/headers/)、[CSP 观察模式](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only)。
