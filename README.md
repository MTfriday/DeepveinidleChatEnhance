# [DVI]聊天增强

Deep Vein Idle 聊天栏的油猴脚本（Userscript）。脚本本体是根目录的 `dvi-chat-plus.user.js`，在 Tampermonkey / Violentmonkey / ScriptCat 中运行；其余文件是本地开发用的工程配置。

## 安装

1. 浏览器装 Tampermonkey / Violentmonkey / ScriptCat 之一。
2. 新建脚本，粘贴 `dvi-chat-plus.user.js` 全文，保存。
3. 打开 <https://deepveinidle.com/>，聊天栏出现圆角气泡与「+1」即生效。

脚本只读页面 DOM，`@grant none`，不请求任何外部接口，不接触账号与存档数据。

## 目录结构

```
DeepveinidleChatEnhance/
├── dvi-chat-plus.user.js       脚本本体，唯一发布物
├── CHANGELOG.md                版本记录
├── README.md                   项目说明
├── LICENSE                     MIT
├── package.json                本地校验与升版命令
├── scripts/
│   ├── check.mjs               发布前自检
│   └── bump-version.mjs        升版本号
├── .vscode/settings.json       编辑器约定
└── .gitignore
```

## 常用命令

需要 Node.js 18 以上。

```bash
node --check dvi-chat-plus.user.js   # 只查语法
npm run check                        # 完整自检
npm run bump                         # 1.2.4 → 1.2.5
npm run bump -- minor                # 次版本 +1，1.2.4 → 1.3.0
npm run bump -- major                # 主版本 +1，1.2.4 → 2.0.0
```

`npm run check` 逐项检查：语法可解析、六个必填元数据字段齐全、`@version` 与 `SCRIPT_VERSION` 一致、IIFE 包裹与 `'use strict'`、无长横线装饰注释、无 AI 生成标记、`@grant` 与 `@connect` 用法自洽。

## 功能

| 功能 | 行为 |
| --- | --- |
| 气泡 | 时间、名字、Founder/Staff/MOD 徽章留在原行，正文包进圆角气泡；装饰元素不进气泡 |
| +1 | 他人与自己发的消息尾部都有「+1」，点击把该行纯正文填进发送框，不自动发送 |
| @ | 同位置一个「@」，点击在发送框头部补「@名字 」，不重复堆叠 |
| 链接 | 非图片链接渲染成按钮（不当 `<a>`），点按弹居中确认窗，显示主机名与完整地址，确认后才打开 |
| 图片 | 小图内联直显；超过 900×700 只给按钮，点击全屏；小图 6 秒没出图退回链接按钮 |
| 回底 | 聊天翻上去后右下浮出「↓」，点击回到最新消息 |
| 清空 | 输入框有草稿时右侧浮出「×」，一键清空 |
| 翻译 | 适配游戏自动翻译在 `.chat-text` 里追加的「[原文]/[译文]」与「⚑」 |

全部在本地 DOM 层完成，不发任何自定义协议包。

## 依赖的游戏端结构

实测于游戏主包 `v1.0.1211`，游戏改版后需重新核对：

| 节点 | 用途 |
| --- | --- |
| `.chat-log` | 聊天日志容器，消息行都 append 在这里 |
| `.chat-line` | 一条消息；自己发的带 `.own`，服务器/公告带 `.system` / `.chat-notice` |
| `.chat-name` | 发言者名字 |
| `.chat-text` | 消息正文（物品 chip 是 `button.chat-item`，@人是 span） |
| `.chat-tr-flip` | 自动翻译开启后追加在 `.chat-text` 内的「[原文]/[译文]」切换按钮 |
| `.chat-tr-flag` | 同位置的「⚑」按钮，点开 `chat-tr-card` 报告译文有误 |
| `.chat-name` 的兄弟元素 | Founder/Staff 徽章、MOD 标签、`chat-name-icon` 都是行内子元素，由游戏动态插拔，不能写死网格列 |
| `input.chat-input[data-input]` | 主输入框，在 `form.chat-compose` 内 |
| `input.trade-chat-input` | 交易私聊输入框，备用落点 |

游戏端本身不处理 URL（`appendWithMentions` 只识别 @，`linked` 只识别物品 chip），链接化全部由脚本负责。

## 发布流程

1. `npm run check` 全绿。
2. `npm run bump` 升版本，并在 `CHANGELOG.md` 顶部补一条。
3. `git commit` + `git tag v<版本>`。
4. 上传脚本，或推送 GitHub 后用 raw 直链分发。

约定：`@version` 只增不减；`@namespace` 与 `@name` 保持不变，否则 Greasyfork 视为新脚本而非更新；代码不压缩。

## 许可证

MIT，见 [LICENSE](LICENSE)。
