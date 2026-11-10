# [DVI] 聊天增强

Deep Vein Idle 聊天栏的 Tampermonkey / Violentmonkey / ScriptCat 用户脚本

脚本本体为根目录的 `dvi-chat-plus.user.js`，运行于 `https://deepveinidle.com/`

读取页面 DOM，不接触账号与存档

## 功能

- 消息气泡化，正文单独成块
- 他人消息尾部 `+1`，点击复制正文到输入框
- `@` 按钮，点击在输入框头部补 `@名字`
- 链接渲染为按钮，点击弹确认窗后才打开
- 图片小图内联显示，超大图转按钮并支持全屏预览
- 表情按钮打开表情面板，点击插入原生表情字符
- 聊天翻离底部时显示回底按钮
- 输入框有草稿时显示一键清空按钮
- 适配游戏自动翻译的 `[原文]/[译文]` 与举报按钮

## 安装

1. 安装 Tampermonkey / Violentmonkey / ScriptCat 之一
2. greasyfork.org搜索 [DVI] 聊天增强 下载 / 直接从仓库下载源文件导入
3. 打开游戏页面，聊天栏出现圆角气泡与 `+1` 即生效

## 开发

需要 Node.js 18 以上。

```bash
node --check dvi-chat-plus.user.js   # 语法检查
npm run check                        # 发布前自检
npm run bump                         # 升 patch 版本
npm run bump -- minor                # 升 minor 版本
npm run bump -- major                # 升 major 版本
```

## 发布

推送到 `main` 且改动 `dvi-chat-plus.user.js` 时，Greasy Fork 通过仓库 webhook 自动同步新版本；忘记升版本号时工作流会自动升 patch。一次性配置见 [docs/greasyfork-sync.md](docs/greasyfork-sync.md)。

## 目录

```
.
├── dvi-chat-plus.user.js   脚本本体
├── CHANGELOG.md            版本记录
├── LICENSE                 MIT
├── package.json
├── scripts/
│   ├── check.mjs           发布前自检
│   └── bump-version.mjs    升版
├── docs/
│   └── greasyfork-sync.md  Greasy Fork 发布配置
├── .github/
│   └── workflows/
│       └── publish.yml     发布流水线
└── .vscode/settings.json
```

## 许可证

MIT，见 [LICENSE](LICENSE)。

图标：Twemoji 对话气泡，CC-BY 4.0 协议。
