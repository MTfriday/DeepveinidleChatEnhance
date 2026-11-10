# [DVI] Chat Enhance

A Tampermonkey / Violentmonkey / ScriptCat userscript for Deep Vein Idle chat.

The script is `dvi-chat-plus.user.js`, running on `https://deepveinidle.com/`. It reads the page DOM, uses `GM_xmlhttpRequest` only for image uploads, and does not touch accounts or saves.

## Features

- Message bubbles
- `+1` on other users' messages to copy text into the input box
- `@` button to mention a user
- Links rendered as buttons with a confirmation dialog
- Inline small images; large images become buttons with fullscreen preview
- Image upload via paste or the 📎 button, trying catbox / litterbox / uguu in order
- Emoji picker inserts native emoji characters
- Scroll-to-bottom button
- One-click input clear
- Supports the game's auto-translation UI

## Install

1. Install Tampermonkey / Violentmonkey / ScriptCat
2. Download from greasyfork.org / import the source file directly from the repository
3. Open the game page; bubbles and `+1` should appear

## Development

Requires Node.js 18+.

```bash
node --check dvi-chat-plus.user.js   # syntax check
npm run check                        # pre-release self-check
npm run bump                         # bump patch version
npm run bump -- minor                # bump minor version
npm run bump -- major                # bump major version
```

## Directory

```
.
├── dvi-chat-plus.user.js   script
├── CHANGELOG.md            version history
├── LICENSE                 MIT
├── package.json
├── scripts/
│   ├── check.mjs           pre-release self-check
│   └── bump-version.mjs    version bump
└── .vscode/settings.json
```

## License

MIT. See [LICENSE](LICENSE).

Icon: speech balloon from [Twemoji](https://github.com/twitter/twemoji), licensed CC-BY 4.0.
