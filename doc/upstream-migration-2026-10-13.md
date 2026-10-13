# 上游迁移记录（2026-10-13）

迁移分支：`codex/upstream-migration-2026-10-13`。
原分支 `server-pro` 保持在 `bbbf27c00e3154262f117cfa8cb0f9bf5697a5e7`，没有改写或推送。
原始分叉点：`c7d8dcf22aca25dd8d6ffe67b636991e9ffe87ac`。
本次固定的上游基线：`b2075687812cfd492ae382513c61d6f921c938c5`，来源为 https://github.com/ayaka-notes/ayakaleaf-pro 的 `server-pro`。
按用户最后指示，不再继续追踪上游更新。

## 按功能排列的提交

| 提交 | 功能 | 迁移处理 |
| --- | --- | --- |
| `5acc4cfd11` | 中文本地化 | 保留英文含义未变的 295 个旧中文词条，并补回 users 标签；同时更新基础语言文件和 v6.3.0 构建补丁。保留上游异步语言初始化，补全挪威语 nb 映射和管理员翻译就绪依赖。 |
| `504b4beaa6` | 中文邮件 | 将 204 处仍适用的旧中文邮件字符串迁入新版布局，保留上游新增模板、链接、转义和页脚回调；同步测试断言。 |
| `3d04c4b5d5` | 日期显示 | 迁移数字日期、24 小时制及原有 UTC+8 显示，保留最新 Git token 的 createdAt 字段和主题弹窗；付款帮助函数继续遵守上游 UTC 语义。 |
| `f35c9aac2c` | 站点定制 | 保留 CptKK 页脚和内部网站注册提示，使用最新页面布局。 |
| `f764ea6e58` | 密码重置响应 | 主邮箱、辅助邮箱、未知邮箱统一返回 200 和相同消息；保留非法邮箱、SSO 限制、请求校验及系统错误处理。 |
| `050579b8b8` | 浏览器兼容跳转 | 支持的浏览器自动离开旧警告页；处理路径大小写、末尾斜杠和循环跳转；保留上游严格参数校验。 |
| `dc31a8cebc` | 本地镜像构建 | 将旧脚本适配到 Node 24 / Yarn 4、版本语言补丁及最新 added 翻译合并；修复日志变量、缺失参数和失败后仍报成功等问题；支持镜像仓库与平台环境变量。 |
| `f02b50fffe` | GitHub Actions 镜像构建 | 保留手动触发与个人 cpt-kk 镜像仓库，使用 GITHUB_TOKEN、精确清理包名；沿用上游新版 Actions 和多架构构建，发布工作流构建手动选择的提交。 |

除以上功能提交外，本文件作为独立文档提交保存。

## 未直接照搬的旧内容

- 363 个旧增补中文词条中，64 个对应旧英文 key 已被上游移除，4 个英文含义已改变，采用上游新版处理；其余 295 个保留旧中文表述。另补回当前管理员界面仍使用的 users 标签。
- 不恢复旧版冗长 Moment 语言加载分支、不复活已被删除的邮件模板和侧栏署名区域。
- 默认语言配置在原历史中已被用户撤回，本次不恢复。
- 旧 npm / package-lock 构建方式、旧 Actions 版本和自动查找旧 release 分支的逻辑均被新版兼容实现替代。
- 非字符串 fromURL 在严格校验模式下继续按上游返回校验错误，而不是套用旧逻辑静默重定向。

## 验证范围

- 定向测试共 175 项通过：邮件 123、密码重置 28、浏览器中间件 20、付款日期 4。采用临时最小依赖环境及上游 Vitest 4.1.5，执行仓库真实测试和请求校验代码，没有修改项目依赖清单或锁文件。
- 本地构建模拟测试 7 项通过：`python tools/test_build_local.py`。测试不访问 Docker 服务、不联网、不发布镜像；附加翻译合并用真实 Node 执行。
- 改动中的 34 个 JS/TS/TSX 文件完成语法解析；3 个 Pug 模板编译通过；语言 JSON 的插值参数与构建补丁一致性检查通过。
- 两个工作流通过 YAML 解析和关键设置检查，16 个内嵌 shell 步骤通过 Bash 语法检查。
- 定向测试和语法检查完成后，上游曾新增 GitLab Sync。已重放全部功能提交并将其新增翻译合并步骤适配进本地构建提交，补测本地脚本通过。没有对新 GitLab Sync 进行集成验证。
- Docker 服务未启动，未运行真实镜像构建、完整 Yarn 安装/类型检查、Cypress/验收测试或远程 Actions。相关前端和验收断言已随功能更新，但未执行这些套件。
- 没有推送任何分支或镜像。

## 构建说明

发布工作流现在构建在 GitHub 手动选择的分支所对应的确切提交。`release-vX.Y.Z` 分支生成 `X.Y.Z` 版本；其他分支生成 `dev-<12位提交哈希>`，避免错误构建 fork 中滞后的 release 分支。

本地构建示例（Bash）：

```bash
bash build-local.sh --tag local-test
REGISTRY_IMAGE=ghcr.io/cpt-kk/overleaf-pro PLATFORM=linux/arm64 bash build-local.sh --tag local-test
```

不加 `--push` 不会发布。语言补丁准备始终执行；`--skip-translations` 仅跳过扫描提取。
清理镜像使用 `GITHUB_TOKEN` 时，仓库需要对相应 package 有 Admin 权限，见 [retention action v3.1.0 文档](https://github.com/snok/container-retention-policy/tree/v3.1.0#temporal-tokens)。上游提供的 webpack 开发镜像地址保持不变。

## 回退与备份

回退前先确认工作区干净。切回原分支即可恢复迁移前的代码：

```bash
git switch server-pro
```

独立回退分支也已保存：

```bash
git switch backup/pre-upstream-2026-10-13
```

返回迁移结果：

```bash
git switch codex/upstream-migration-2026-10-13
```

备份文件位于仓库外，不会被提交：

- `D:/Code_lab/overleaf-pro-pre-upstream-2026-10-13.bundle`：Git 全历史与原引用，已通过 `git bundle verify`。
- `D:/Code_lab/overleaf-pro-pre-upstream-2026-10-13-local.zip`：`.claude/`、`CLAUDE.md` 和 `.github/modernize/` 的本地归档，ZIP 完整性检查通过。ZIP 中 modernize 目录位于归档根目录，恢复时应放回 `.github/modernize/`。

若整个工作仓库丢失，可恢复到新目录：

```bash
git clone -b server-pro D:/Code_lab/overleaf-pro-pre-upstream-2026-10-13.bundle D:/Code_lab/overleaf-pro-restored
```

原分支与备份分支都保留在原提交上，不需要执行破坏性的 reset 或强制推送。
