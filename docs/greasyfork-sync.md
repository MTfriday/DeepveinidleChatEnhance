# 发布到 Greasy Fork（webhook 自动同步）

Greasy Fork 没有写入型 API，官方支持的自动发布方式是「外部代码同步 + 仓库 webhook」：Greasy Fork 订阅 GitHub 的 push 事件，收到通知后自己拉取 raw 文件，`@version` 变大就发布新版本。

推送到 `main` 且改动了 `dvi-chat-plus.user.js` 时，`.github/workflows/publish.yml` 会：

1. 跑 `node --check` 和 `npm run check`；
2. 与上一次推送相比 `@version` 没变时，自动 patch 递增并回推 `main`（版本变低则直接报错）；
3. 打 `vX.Y.Z` 标签并创建 GitHub Release。

Greasy Fork 收到两次 push（原提交、CI 升版提交）后，会拒绝版本未变的那次、接受升版的那次。

## 一次性设置

以下几步需要仓库所有者登录 Greasy Fork 手动完成。

### 1. 手动发布一次

打开 <https://greasyfork.org/scripts/new>，把 `dvi-chat-plus.user.js` 的内容贴进去发布。Greasy Fork 不允许跳过首次手动发布。

### 2. 设置外部代码同步

在脚本页进入 *Admin → Sync*（或「更新代码 → 同步」），同步源填本仓库的 raw 地址，格式必须完全一致：

```text
https://raw.githubusercontent.com/MTfriday/DeepveinidleChatEnhance/main/dvi-chat-plus.user.js
```

### 3. 生成 webhook 地址

登录后打开 <https://greasyfork.org/users/webhook-info>，拿到 payload URL（形如 `https://greasyfork.org/users/<id>/webhook`）和 secret；没有 secret 就点 Generate。payload URL 视同机密，不要写进仓库或截图。

### 4. 在 GitHub 添加 webhook

仓库 *Settings → Webhooks → Add webhook*：

- Payload URL：第 3 步的地址
- Content type：`application/json`
- Secret：第 3 步的 secret
- 事件：只勾 **Just the push event**
- Active：勾上

添加后 GitHub 会立即发一次 ping，Recent Deliveries 里应是 2xx。

## 发布流程

1. 改脚本，按需在 `CHANGELOG.md` 顶部补条目（CI 只能升版本号，写不了有意义的更新说明）。
2. 想要 minor / major 版本就手动 `npm run bump -- minor`，patch 交给 CI。
3. 提交并推送到 `main`。
4. 看 Actions 的 *Publish userscript* 是否通过，再确认 Greasy Fork 的同步历史里出现了新版本。

也可以在 Actions 页面手动 *Run workflow*：手动触发会跳过版本比较，直接升 patch 并发布，适合首次验证或补发。

## 注意事项

- `@version` 必须严格变大，Greasy Fork 才会接受同步；版本相同的请手动改代码里的 `SCRIPT_VERSION` 之外的逻辑再推。
- Greasy Fork 只处理「本次提交修改过」的文件，第一次把脚本加进仓库的那次提交不会触发同步。
- Greasy Fork 会忽略脚本里的 `@downloadURL` / `@updateURL`，自己提供更新地址。
- 体积上限 2 MB；当前脚本约 50 KB。
- 只有 `main` 分支的 raw 地址会被同步，其他分支不会发布。
- 如果 `main` 开了分支保护，CI 回推版本号的步骤会失败，需要允许 GitHub Actions 推送或改用 PR 流程。
- webhook 返回 403 说明仓库里的 secret 和 Greasy Fork 上的不一致，重新生成并同步两边。
