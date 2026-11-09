// ==UserScript==
// @name         [DVI]聊天增强
// @namespace    https://deepveinidle.com/
// @version      1.2.7
// @description  Deep Vein Idle 聊天栏增强：气泡排版、快捷复读、链接与图片安全预览。
// @match        https://deepveinidle.com/*
// @match        https://www.deepveinidle.com/*
// @license      MIT
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 重复注入守卫，避免 Observer 与定时器开两套
    if (window.__DVI_CHAT_PLUS__) {
        console.log('[dvi-ce] 聊天增强已在运行，跳过重复注入');
        return;
    }
    window.__DVI_CHAT_PLUS__ = true;


    const SCRIPT_VERSION = '1.2.7';

    const NS = 'dvi-ce';

    const CFG = {
        // 链接按钮文字上限，超出中间省略
        maxLinkText: 48,
        // 缩略图最大尺寸
        maxImgW: 240,
        maxImgH: 150,
        // 超过此尺寸按大图处理，不放聊天里
        bigImgW: 900,
        bigImgH: 700,
        // 出图超时则退回链接按钮
        imgTimeout: 6000,
        // 已有草稿时：追加还是覆盖
        appendWhenDraft: true,
        // 兜底重扫间隔，主要靠 MutationObserver
        rescanInterval: 8000,
    };
    // 小工具
    const IMG_EXT_RE = /\.(png|jpe?g|gif|gifv|webp|avif|bmp|svg)$/i;

    // 这些域名默认当图片处理
    const IMG_HOSTS = {
        'i.imgur.com': 1,
        'i.ibb.co': 1,
        'cdn.discordapp.com': 1,
        'media.discordapp.net': 1,
        'pbs.twimg.com': 1,
        'i.postimg.cc': 1,
        'i.gyazo.com': 1,
        'images.unsplash.com': 1,
        'i.pinimg.com': 1,
        'i.pximg.net': 1,
        'files.catbox.moe': 1,
    };

    // 只取 ASCII 可见字符，遇中文断开
    const URL_RE = /\bhttps?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/g;
    // 剥掉尾部标点
    const TRAIL_RE = /[)\],.;:!?'"]$/;

    function isImageUrl(u) {
        let url;
        try {
            url = new URL(u);
        } catch (e) {
            return false;
        }
        if (!/^https?:$/.test(url.protocol)) return false;
        const path = url.pathname.toLowerCase();
        if (IMG_EXT_RE.test(path)) return true;
        if (IMG_HOSTS[url.hostname.toLowerCase()]) return true;
        return false;
    }

    function shortText(u) {
        const shown = u.replace(/^https?:\/\//i, '');
        return shown.length > CFG.maxLinkText
            ? shown.slice(0, CFG.maxLinkText - 1) + '…'
            : shown;
    }
    // 全屏看图
    let viewerEl = null;

    function onViewerKey(ev) {
        if (ev.key === 'Escape') {
            ev.stopImmediatePropagation();   // 阻止游戏面板关闭
            ev.preventDefault();
            closeViewer();
        }
    }

    function closeViewer() {
        if (!viewerEl) return;
        viewerEl.remove();
        viewerEl = null;
        document.removeEventListener('keydown', onViewerKey, true);
    }

    function showViewer(src) {
        closeViewer();
        const box = document.createElement('div');
        box.className = NS + '-viewer';
        box.setAttribute('data-no-i18n', '');

        const img = document.createElement('img');
        img.src = src;
        img.referrerPolicy = 'no-referrer';
        img.alt = '预览';
        img.addEventListener('error', function () {
            closeViewer();
        });

        const tip = document.createElement('span');
        tip.className = NS + '-viewer-tip';
        tip.textContent = '点击任意处 / Esc 关闭';

        box.appendChild(img);
        box.appendChild(tip);
        box.addEventListener('click', closeViewer);
        document.body.appendChild(box);
        viewerEl = box;
        document.addEventListener('keydown', onViewerKey, true);
    }
    // 链接确认窗
    let confirmEl = null;

    function onConfirmKey(ev) {
        if (ev.key === 'Escape') {
            ev.stopImmediatePropagation();   // 阻止游戏面板关闭
            ev.preventDefault();
            closeConfirm();
        }
    }

    function closeConfirm() {
        if (!confirmEl) return;
        confirmEl.remove();
        confirmEl = null;
        document.removeEventListener('keydown', onConfirmKey, true);
    }

    // 不直接跳转，先弹确认窗
    function confirmOpen(url) {
        closeConfirm();

        let host = url;
        try { host = new URL(url).hostname || url; } catch (e) { /* 非法 URL 显示原串 */ }

        const mask = document.createElement('div');
        mask.className = NS + '-confirm';
        mask.setAttribute('data-no-i18n', '');

        const box = document.createElement('div');
        box.className = NS + '-confirm-box';

        const title = document.createElement('div');
        title.className = NS + '-confirm-title';
        title.textContent = '即将打开外部链接';

        const hostEl = document.createElement('div');
        hostEl.className = NS + '-confirm-host';
        hostEl.textContent = host;

        const urlEl = document.createElement('div');
        urlEl.className = NS + '-confirm-url';
        urlEl.textContent = url;

        const tip = document.createElement('div');
        tip.className = NS + '-confirm-tip';
        tip.textContent = '确认这是你想去的地址吗？';

        const acts = document.createElement('div');
        acts.className = NS + '-confirm-acts';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = NS + '-btn-cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            closeConfirm();
        });

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = NS + '-btn-ok';
        openBtn.textContent = '打开';
        openBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            closeConfirm();
            try {
                window.open(url, '_blank', 'noopener,noreferrer');
            } catch (e) { /* 被拦截则忽略 */ }
        });

        acts.appendChild(cancel);
        acts.appendChild(openBtn);
        box.appendChild(title);
        box.appendChild(hostEl);
        box.appendChild(urlEl);
        box.appendChild(tip);
        box.appendChild(acts);
        mask.appendChild(box);
        mask.addEventListener('click', function (ev) {
            if (ev.target === mask) closeConfirm();     // 点遮罩关闭
        });
        document.body.appendChild(mask);
        confirmEl = mask;
        document.addEventListener('keydown', onConfirmKey, true);
        openBtn.focus();
    }
    // 链接转按钮
    // 渲染成按钮而非 <a>，点击先确认
    function buildLinkButton(url) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = NS + '-lbtn';
        btn.setAttribute('data-url', url);      // 还原完整地址
        btn.setAttribute('data-no-i18n', '');
        btn.textContent = '↗ ' + shortText(url);
        btn.title = url;
        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            confirmOpen(url);
        });
        return btn;
    }

    // 大图只给按钮
    function buildBigImageButton(url, w, h) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = NS + '-lbtn ' + NS + '-ibtn';
        btn.setAttribute('data-url', url);
        btn.setAttribute('data-no-i18n', '');
        btn.textContent = '图片 ' + w + '×' + h + ' · 点击查看';
        btn.title = url;
        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            showViewer(url);
        });
        return btn;
    }

    function scrollLogToBottom() {
        const log = document.querySelector('.chat-log');
        if (log) log.scrollTop = log.scrollHeight;
    }

    function isLogAtBottom() {
        const log = document.querySelector('.chat-log');
        if (!log) return true;
        return log.offsetHeight + log.scrollTop + 30 > log.scrollHeight;
    }

    /* 内联图片：小图直显，大图转按钮，失败退回链接 */

    function buildImageLink(url) {
        const wrap = document.createElement('span');
        wrap.className = NS + '-img';
        wrap.setAttribute('data-url', url);
        wrap.setAttribute('data-no-i18n', '');

        // 贴底状态要提前记
        const wasBottom = isLogAtBottom();

        const img = document.createElement('img');
        img.className = NS + '-thumb';
        img.src = url;
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.alt = '图片';
        img.style.maxWidth = CFG.maxImgW + 'px';
        img.style.maxHeight = CFG.maxImgH + 'px';

        let settled = false;
        const fallback = function () {
            if (settled) return;
            settled = true;
            if (wasBottom) scrollLogToBottom();
            const fb = buildLinkButton(url);
            if (wrap.parentNode) wrap.parentNode.replaceChild(fb, wrap);
        };

        img.addEventListener('error', fallback, { once: true });
        img.addEventListener('load', function () {
            if (settled) return;
            settled = true;

            // 大图转按钮，点击全屏
            if (img.naturalWidth > CFG.bigImgW || img.naturalHeight > CFG.bigImgH) {
                const ph = buildBigImageButton(url, img.naturalWidth, img.naturalHeight);
                if (wrap.parentNode) wrap.parentNode.replaceChild(ph, wrap);
            }
            // 撑开后补贴底
            if (wasBottom) scrollLogToBottom();
        }, { once: true });

        // 懒加载图进视口才开始计时
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(function (entries) {
                for (let i = 0; i < entries.length; i++) {
                    if (!entries[i].isIntersecting) continue;
                    io.disconnect();
                    window.setTimeout(function () { fallback(); }, CFG.imgTimeout);
                    return;
                }
            }, { rootMargin: '120px' });
            io.observe(wrap);
        } else {
            window.setTimeout(function () { fallback(); }, CFG.imgTimeout);
        }

        wrap.appendChild(img);
        wrap.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            settled = true;                     // 用户主动查看，才取原图
            showViewer(url);
        });
        return wrap;
    }

    function buildUrlNode(url) {
        return isImageUrl(url) ? buildImageLink(url) : buildLinkButton(url);
    }
    // 从消息中提取 URL
    function linkifyTextNode(node) {
        const text = node.nodeValue || '';
        if (text.indexOf('http') < 0) return false;
        if (!/https?:\/\//i.test(text)) return false;

        const frag = document.createDocumentFragment();
        let last = 0;
        let changed = false;

        while (true) {
            URL_RE.lastIndex = last;
            const m = URL_RE.exec(text);
            if (!m) break;

            let clean = m[0];
            while (TRAIL_RE.test(clean)) clean = clean.slice(0, -1);
            if (!clean || !/^https?:\/\//i.test(clean)) {
                URL_RE.lastIndex = m.index + m[0].length;
                continue;
            }

            const start = m.index;
            if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));
            frag.appendChild(buildUrlNode(clean));
            last = start + clean.length;
            changed = true;
        }

        if (!changed) return false;
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
        return true;
    }

    function linkifyLine(line) {
        const body = line.querySelector('.chat-text');
        // 有正文处理正文，否则处理整行
        if (!body && !line.classList.contains('chat-notice')) return;
        const root = body || line;

        // 只替换文本节点，chip 与 @ 保持原样
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const targets = [];
        while (walker.nextNode()) {
            const n = walker.currentNode;
            if (n.parentNode && n.parentNode.closest &&
                n.parentNode.closest('.chat-name, button, a')) continue;
            targets.push(n);
        }
        targets.forEach(linkifyTextNode);
    }
    // 消息气泡
    // 正文包成气泡，时间/名字/徽章留在行内；游戏会动态插拔这些标记，不搬动
    function bubbleLine(line) {
        if (line.hasAttribute('data-ce-bubbled')) return;
        if (line.classList.contains('chat-notice')) return;
        if (line.classList.contains('system')) return;

        const text = line.querySelector('.chat-text');
        if (!text) return;

        const bubble = document.createElement('div');
        bubble.className = NS + '-bubble';
        bubble.setAttribute('data-no-i18n', '');
        text.parentNode.insertBefore(bubble, text);   // 占位
        bubble.appendChild(text);                     // 移入正文
        line.setAttribute('data-ce-bubbled', '');
    }

    // 按钮挂进气泡，跟随正文
    function actsHost(line) {
        return line.querySelector('.' + NS + '-bubble') || line;
    }
    // +1 按钮
    function getLineText(line) {
        const body = line.querySelector('.chat-text');
        if (!body) return '';
        const clone = body.cloneNode(true);

        // 剔除翻译与举报按钮，避免混进正文
        clone.querySelectorAll('.chat-tr-flip, .chat-tr-flag').forEach(function (n) {
            n.remove();
        });

        // 还原原始 URL
        clone.querySelectorAll('.' + NS + '-img, .' + NS + '-lbtn').forEach(function (n) {
            n.replaceWith(n.getAttribute('data-url') || n.textContent || '');
        });

        // chip 还原成 [名称 ×N]
        clone.querySelectorAll('.chat-item').forEach(function (chip) {
            try {
                const nEl = chip.querySelector('.chat-item-n');
                const qty = nEl ? nEl.textContent.replace(/[×\s]/g, '') : '';
                const name = chip.textContent.replace(nEl ? nEl.textContent : '', '').trim();
                if (!name) return;
                chip.replaceWith('[' + name + (qty ? ' ×' + qty : '') + ']');
            } catch (e) { /* 还原失败则保留原样 */ }
        });

        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function pickCompose() {
        const main = document.querySelector('input.chat-input[data-input]');
        if (main) return main;
        const trade = document.querySelector('input.trade-chat-input');
        if (trade) return trade;
        return document.querySelector('input.chat-input') || null;
    }

    function fillCompose(text) {
        if (!text) return false;
        const input = pickCompose();
        if (!input) return false;
        if (input.disabled) return false;

        const max = input.maxLength > 0 ? input.maxLength : 9999;
        const draft = input.value || '';
        let next;
        if (CFG.appendWhenDraft && draft) {
            const sep = /\s$/.test(draft) ? '' : ' ';
            next = draft + sep + text;
        } else {
            next = text;
        }
        if (next.length > max) next = next.slice(0, max);

        input.value = next;
        // 补 input 事件，同步依赖输入框的 UI
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
        try {
            input.setSelectionRange(next.length, next.length);
        } catch (e) { /* 不支持选区则忽略 */ }
        return true;
    }

    function ensurePlusOne(line) {
        if (line.classList.contains('chat-notice')) return; // 系统通知
        if (line.classList.contains('system')) return;      // 系统消息
        if (!line.querySelector('.chat-text')) return;      // 无正文
        if (line.querySelector('.' + NS + '-plus1')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = NS + '-plus1';
        btn.textContent = '+1';
        btn.title = '把这条消息复制到我的输入框';
        btn.setAttribute('data-no-i18n', '');
        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const ok = fillCompose(getLineText(line));
            btn.textContent = ok ? '✓' : '✗';
            btn.title = ok ? '已放进输入框' : '找不到可用的输入框（游客在非新手频道不能发言）';
            setTimeout(function () {
                btn.textContent = '+1';
                btn.title = '把这条消息复制到我的输入框';
            }, 1000);
        });
        actsHost(line).appendChild(btn);
    }
    // @ 提及按钮
    // 发送框头部补 @名字，已 @ 过只挪光标
    function mentionCompose(name) {
        if (!name) return false;
        const input = pickCompose();
        if (!input || input.disabled) return false;

        const tag = '@' + name;
        const draft = input.value || '';
        if (draft.indexOf(tag) >= 0) {
            input.focus();
            return true;
        }

        const max = input.maxLength > 0 ? input.maxLength : 9999;
        let next = tag + ' ' + draft;
        if (next.length > max) next = next.slice(0, max);

        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
        try {
            input.setSelectionRange(next.length, next.length);
        } catch (e) { /* 不支持选区则忽略 */ }
        return true;
    }

    function lineSpeaker(line) {
        const el = line.querySelector('.chat-name');
        return el ? (el.textContent || '').trim() : '';
    }

    function ensureMention(line) {
        if (line.classList.contains('own')) return;         // 自己发的不 @ 自己
        if (line.classList.contains('chat-notice')) return;
        if (line.classList.contains('system')) return;
        if (!line.querySelector('.chat-text')) return;
        if (line.querySelector('.' + NS + '-mention')) return;

        const name = lineSpeaker(line);
        if (!name) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = NS + '-mention';
        btn.textContent = '@';
        btn.title = '提及 ' + name;
        btn.setAttribute('data-no-i18n', '');
        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const ok = mentionCompose(name);
            btn.textContent = ok ? '✓' : '✗';
            setTimeout(function () { btn.textContent = '@'; }, 900);
        });
        actsHost(line).appendChild(btn);
    }
    // 回到底部 / 清空输入
    // 按钮挂在不滚动的 .chat-body 上
    function placeJump(host, btn) {
        const compose = host.querySelector('form.chat-compose');
        // 压在发送框上沿留 8px
        const gap = compose
            ? Math.max(12, Math.round(host.getBoundingClientRect().bottom - compose.getBoundingClientRect().top) + 8)
            : 12;
        btn.style.bottom = gap + 'px';
    }

    function updateJump(log, btn) {
        const atBottom = log.offsetHeight + log.scrollTop + 24 > log.scrollHeight;
        btn.classList.toggle(NS + '-hide', atBottom);
    }

    let jumpResizeWired = false;

    function ensureJumpButton() {
        // 补齐被重绘带走的按钮
        const log = document.querySelector('.chat-log');
        const host = log && log.parentElement;
        if (!log || !host) return;

        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

        let btn = host.querySelector('.' + NS + '-jump');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = NS + '-jump';
            btn.textContent = '↓';
            btn.title = '回到最新消息';
            btn.setAttribute('data-no-i18n', '');
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                log.scrollTop = log.scrollHeight;
            });
            host.appendChild(btn);
        }
        placeJump(host, btn);

        if (!log.hasAttribute('data-ce-scroll')) {
            log.setAttribute('data-ce-scroll', '');
            log.addEventListener('scroll', function () {
                updateJump(log, btn);
            }, { passive: true });
        }
        updateJump(log, btn);

        if (!jumpResizeWired) {
            jumpResizeWired = true;
            window.addEventListener('resize', function () {
                const l = document.querySelector('.chat-log');
                const h = l && l.parentElement;
                const b = h && h.querySelector('.' + NS + '-jump');
                if (l && h && b) {
                    placeJump(h, b);
                    updateJump(l, b);
                }
            });
        }
    }

    function placeClear(form, btn) {
        const send = form.querySelector('.chat-send');
        if (!send) { btn.style.right = '72px'; return; }
        // 贴发送按钮左侧留 6px
        const gap = form.offsetWidth - send.offsetLeft + 6;
        btn.style.right = Math.max(24, gap) + 'px';
    }

    function ensureClearButton() {
        const form = document.querySelector('form.chat-compose');
        const input = form && form.querySelector('input.chat-input[data-input]');
        if (!form || !input) return;

        if (getComputedStyle(form).position === 'static') form.style.position = 'relative';

        let btn = form.querySelector('.' + NS + '-clear');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = NS + '-clear';
            btn.textContent = '×';
            btn.title = '清空输入';
            btn.setAttribute('data-no-i18n', '');
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                const cur = form.querySelector('input.chat-input[data-input]');
                if (!cur || !cur.value) return;
                cur.value = '';
                cur.dispatchEvent(new Event('input', { bubbles: true }));
                cur.dispatchEvent(new Event('change', { bubbles: true }));
                cur.focus();
                btn.classList.add(NS + '-hide');
            });
            form.appendChild(btn);
        }
        placeClear(form, btn);

        if (!input.hasAttribute('data-ce-clear')) {
            input.setAttribute('data-ce-clear', '');
            input.addEventListener('input', function () {
                btn.classList.toggle(NS + '-hide', !input.value);
            });
        }
        btn.classList.toggle(NS + '-hide', !input.value);
    }

    function ensureHud() {
        ensureJumpButton();
        ensureClearButton();
    }
    // 启动
    function processLine(line) {
        bubbleLine(line);
        ensurePlusOne(line);
        ensureMention(line);
        linkifyLine(line);
    }

    // 按频道取尾部若干行；各频道混在一个日志里，只取整段尾部会让切过去的频道没按钮
    function scanRecent(perRoom) {
        document.querySelectorAll('.chat-log, [data-log]').forEach(function (log) {
            const lines = log.querySelectorAll('.chat-line');
            const seen = Object.create(null);
            for (let i = lines.length - 1; i >= 0; i--) {
                const room = lines[i].dataset.room || '';
                const n = seen[room] || 0;
                if (n >= perRoom) continue;
                seen[room] = n + 1;
                processLine(lines[i]);
            }
        });
    }

    let pending = new Set();
    let scheduled = false;

    // 游戏用 24px 判定贴底，气泡化撑高后容易越过阈值；
    // 处理前在底部，处理完立刻补回去
    function processBatch(batch) {
        const wasBottom = isLogAtBottom();
        batch.forEach(processLine);
        if (wasBottom) scrollLogToBottom();
    }

    function schedule(line) {
        if (line) pending.add(line);
        if (scheduled) return;
        scheduled = true;
        setTimeout(function () {
            scheduled = false;
            if (pending.size) {
                const batch = Array.from(pending);
                pending.clear();
                processBatch(batch);
            } else {
                const wasBottom = isLogAtBottom();
                scanRecent(60);
                if (wasBottom) scrollLogToBottom();
            }
        }, 120);
    }

    function lineOf(node) {
        if (!node) return null;
        const el = node.nodeType === 1 ? node : node.parentElement;
        if (!el || !el.closest) return null;
        return el.closest('.chat-line');
    }

    function start() {
        injectStyle();
        const wasBottom = isLogAtBottom();
        scanRecent(9999);   // 首次全量扫描
        if (wasBottom) scrollLogToBottom();   // 补贴底
        ensureHud();

        const obs = new MutationObserver(function (muts) {
            for (let i = 0; i < muts.length; i++) {
                const m = muts[i];
                if (m.type !== 'childList') continue;
                const own = lineOf(m.target);
                if (own) { schedule(own); continue; }
                // 一次追加可能多条，全部收下一起处理，避免贴底补偿失准
                for (let j = 0; j < m.addedNodes.length; j++) {
                    const ln = lineOf(m.addedNodes[j]);
                    if (ln) schedule(ln);
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        // SPA 路由切换不重新注入：监听 popstate/hashchange，另有 href 比对兜底
        let lastHref = location.href;
        const checkRoute = function () {
            if (location.href === lastHref) return;
            lastHref = location.href;
            ensureHud();
            scanRecent(60);
        };
        window.addEventListener('popstate', checkRoute);
        window.addEventListener('hashchange', checkRoute);

        // 翻译切换会整段重绘，低频补扫尾部并补挂按钮
        setInterval(function () {
            checkRoute();
            const wasBottom = isLogAtBottom();
            scanRecent(60);
            ensureHud();
            if (wasBottom) scrollLogToBottom();
        }, CFG.rescanInterval);

        console.log('[' + NS + '] 聊天增强已启动 v' + SCRIPT_VERSION);
    }
    // 样式
    function injectStyle() {
        if (document.getElementById(NS + '-style')) return;
        const style = document.createElement('style');
        style.id = NS + '-style';
        style.textContent = [
            /* +1 按钮 */
            '.' + NS + '-plus1{',
            '  margin:0 0 0 6px;padding:0 5px;font:inherit;font-size:10px;line-height:15px;',
            '  color:inherit;background:transparent;border:1px dashed rgba(140,140,140,.55);',
            '  border-radius:4px;cursor:pointer;opacity:.55;vertical-align:baseline;',
            '  transition:opacity .12s,background .12s;',
            '}',
            '.' + NS + '-plus1:hover{opacity:1;background:rgba(140,140,140,.18);}',
            '.' + NS + '-plus1:active{transform:translateY(1px);}',

            /* 气泡：徽章留在行内，正文单独成块 */
            '.chat-line[data-ce-bubbled]{',
            '  display:block;padding:3px 0;',
            '}',
            '.chat-line[data-ce-bubbled] > .chat-when{font-size:10px;opacity:.5;}',
            '.chat-line[data-ce-bubbled] > .' + NS + '-bubble{',
            '  display:block;',
            '  width:fit-content;max-width:100%;box-sizing:border-box;',
            '  margin-top:2px;padding:5px 9px;border-radius:10px;',
            '  background:rgba(255,255,255,.055);',
            '  border:1px solid rgba(255,255,255,.06);',
            '  line-height:1.55;word-break:break-word;',
            '}',
            '.chat-line[data-ce-bubbled].own > .' + NS + '-bubble{',
            '  background:rgba(110,165,255,.13);border-color:rgba(120,170,255,.18);',
            '}',

            /* 翻译按钮由游戏插入，只调排版不拦事件 */
            '.' + NS + '-bubble .chat-tr-flip{',
            '  margin:0 0 0 5px;padding:0 5px;font:inherit;font-size:10px;line-height:15px;',
            '  color:#a8c3e0;background:rgba(120,160,220,.12);',
            '  border:1px solid rgba(120,160,220,.32);border-radius:4px;',
            '  cursor:pointer;vertical-align:baseline;white-space:nowrap;',
            '  transition:background .12s,color .12s;',
            '}',
            '.' + NS + '-bubble .chat-tr-flip:hover{color:#dbeaff;background:rgba(120,160,220,.26);}',
            '.' + NS + '-bubble .chat-tr-flag{',
            '  margin-left:2px;padding:0 4px;color:#e2c68b;',
            '  background:rgba(200,170,110,.10);border-color:rgba(200,170,110,.4);',
            '}',
            '.chat-line[data-ce-bubbled].own > .' + NS + '-bubble{',
            '  background:rgba(110,165,255,.13);border-color:rgba(120,170,255,.18);',
            '}',

            /* 链接/大图按钮，点击先弹确认窗 */
            '.' + NS + '-lbtn{',
            '  display:inline-block;max-width:100%;margin:1px 2px 1px 0;',
            '  padding:2px 7px;font:inherit;font-size:11px;line-height:1.5;',
            '  color:#8fc7ff;background:rgba(90,150,255,.10);',
            '  border:1px solid rgba(120,170,255,.34);border-radius:5px;',
            '  cursor:pointer;text-align:left;vertical-align:baseline;',
            '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
            '  transition:background .12s,border-color .12s;',
            '}',
            '.' + NS + '-lbtn:hover{background:rgba(90,150,255,.2);border-color:rgba(140,190,255,.6);}',
            '.' + NS + '-ibtn{color:#e2c68b;background:rgba(200,170,110,.10);border-color:rgba(200,170,110,.4);}',
            '.' + NS + '-ibtn:hover{background:rgba(200,170,110,.2);border-color:rgba(225,195,135,.7);}',

            /* 缩略图 */
            '.' + NS + '-img{',
            '  display:inline-block;vertical-align:middle;margin:3px 0;max-width:100%;',
            '  line-height:0;cursor:zoom-in;',
            '}',
            '.' + NS + '-thumb{',
            '  display:block;max-width:100%;border-radius:5px;',
            '  border:1px solid rgba(140,140,140,.35);background:rgba(0,0,0,.15);',
            '}',

            /* 大图预览 */
            '.' + NS + '-viewer{',
            '  position:fixed;inset:0;z-index:2147483000;',
            '  display:flex;align-items:center;justify-content:center;',
            '  background:rgba(0,0,0,.84);cursor:zoom-out;',
            '}',
            '.' + NS + '-viewer img{',
            '  max-width:92vw;max-height:88vh;border-radius:6px;',
            '  box-shadow:0 8px 40px rgba(0,0,0,.6);',
            '}',
            '.' + NS + '-viewer-tip{',
            '  position:absolute;left:0;right:0;bottom:16px;text-align:center;',
            '  font-size:12px;color:rgba(255,255,255,.6);pointer-events:none;',
            '}',

            /* 确认窗 */
            '.' + NS + '-confirm{',
            '  position:fixed;inset:0;z-index:2147483000;',
            '  display:flex;align-items:center;justify-content:center;',
            '  background:rgba(0,0,0,.62);',
            '}',
            '.' + NS + '-confirm-box{',
            '  width:min(460px,86vw);box-sizing:border-box;',
            '  padding:16px 18px 14px;border-radius:10px;',
            '  background:#1b222c;color:#e6ecf5;',
            '  border:1px solid rgba(140,160,190,.3);',
            '  box-shadow:0 14px 48px rgba(0,0,0,.55);',
            '  font-size:13px;text-align:left;',
            '}',
            '.' + NS + '-confirm-title{font-size:14px;font-weight:600;margin-bottom:10px;}',
            '.' + NS + '-confirm-host{color:#9fd0ff;font-weight:600;margin-bottom:6px;word-break:break-all;}',
            '.' + NS + '-confirm-url{',
            '  max-height:96px;overflow:auto;padding:8px;margin-bottom:8px;',
            '  background:rgba(0,0,0,.34);border-radius:6px;',
            '  font-size:11px;line-height:1.5;color:#b6c4d6;word-break:break-all;',
            '  user-select:text;',
            '}',
            '.' + NS + '-confirm-tip{font-size:11px;color:#8b9cb0;margin-bottom:14px;}',
            '.' + NS + '-confirm-acts{display:flex;justify-content:flex-end;gap:8px;}',
            '.' + NS + '-btn-cancel,.' + NS + '-btn-ok{',
            '  padding:5px 16px;font:inherit;font-size:12px;border-radius:6px;cursor:pointer;',
            '  background:rgba(255,255,255,.07);color:#dbe4f0;border:1px solid rgba(140,160,190,.4);',
            '  transition:background .12s;',
            '}',
            '.' + NS + '-btn-cancel:hover{background:rgba(255,255,255,.14);}',
            '.' + NS + '-btn-ok{background:#3b6bd0;border-color:#4b82e6;color:#fff;}',
            '.' + NS + '-btn-ok:hover{background:#4a80e8;}',

            /* @ 提及按钮：平时隐身，鼠标扫到这条消息才冒出来，避免整屏按钮 */
            '.' + NS + '-mention{',
            '  margin:0 0 0 4px;padding:0 5px;font:inherit;font-size:10px;line-height:15px;',
            '  color:inherit;background:transparent;border:1px dashed rgba(140,140,140,.55);',
            '  border-radius:4px;cursor:pointer;opacity:0;vertical-align:baseline;',
            '  transition:opacity .12s,background .12s;',
            '}',
            '.chat-line:hover .' + NS + '-mention{opacity:.75;}',
            '.chat-line:hover .' + NS + '-mention:hover{opacity:1;background:rgba(140,140,140,.18);}',

            /* 回到底部 */
            '.' + NS + '-jump{',
            '  position:absolute;right:10px;z-index:5;margin:0;padding:0;',
            '  width:32px;height:32px;border-radius:16px;',
            '  display:flex;align-items:center;justify-content:center;',
            '  font-size:15px;line-height:1;',
            '  color:#dfe8f5;background:rgba(30,38,50,.82);',
            '  border:1px solid rgba(140,160,190,.45);',
            '  box-shadow:0 2px 10px rgba(0,0,0,.35);',
            '  cursor:pointer;transition:opacity .15s,transform .15s,background .15s;',
            '}',
            '.' + NS + '-jump:hover{background:rgba(45,58,76,.95);transform:translateY(-1px);}',

            /* 清空输入 */
            '.' + NS + '-clear{',
            '  position:absolute;top:50%;transform:translateY(-50%);',
            '  width:18px;height:18px;padding:0;line-height:16px;',
            '  font-size:13px;text-align:center;',
            '  color:rgba(200,210,225,.7);background:transparent;',
            '  border:none;border-radius:9px;cursor:pointer;transition:opacity .12s,background .12s;',
            '}',
            '.' + NS + '-clear:hover{color:#fff;background:rgba(140,140,140,.25);}',

            /* 通用隐藏，保留占位 */
            '.' + NS + '-hide{opacity:0;pointer-events:none;}',
        ].join('\n');
        (document.head || document.documentElement).appendChild(style);
    }
    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
