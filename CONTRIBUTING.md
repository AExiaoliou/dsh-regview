# Contributing

感谢你对 dsh-regview 的兴趣！Bug 修复、文档改进、测试和新功能都欢迎贡献。

## 开始开发

```sh
pnpm install
pnpm check
```

请在提交前运行 `pnpm check`。它会执行类型检查、测试、构建和构建产物契约校验。

## 提交变更

- 一个提交聚焦一个问题，并说明用户可见的影响。
- 新行为应包含相应测试；文档、脚本和类型变更也请同步更新。
- 不要提交 `node_modules/`、`lib/` 或本地 profile 配置。
- Pull request 请说明变更内容、验证方式，以及任何兼容性影响。

## 报告问题

请优先使用 GitHub Issues，并附上 DeepSeek Harness 版本、Node.js/pnpm 版本、复现步骤和相关日志。请移除令牌、个人数据和本地路径中的敏感信息。
