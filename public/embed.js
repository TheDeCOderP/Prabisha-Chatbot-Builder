/**
 * Chatbot Embed Script — Multi-Mode
 * Supports: floating_button | teaser_bubble | sticky_bar | slide_drawer | inline
 */
(function () {
  'use strict';

  if (window.self !== window.top) return; // prevent recursion inside iframes

  window.chatbot = window.chatbot || function () {
    (window.chatbot.q = window.chatbot.q || []).push(arguments);
  };

  const script = document.currentScript;
  const scriptUrl = script ? script.src : '';
  const defaultBaseUrl = scriptUrl ? new URL(scriptUrl).origin : window.location.origin;

  // ─── CSS animations injected once ──────────────────────────────────────────
  (function injectStyles() {
    if (document.getElementById('__chatbot_styles__')) return;
    const style = document.createElement('style');
    style.id = '__chatbot_styles__';
    style.textContent = `
      @keyframes __cb_fadeInUp {
        from { opacity:0; transform:translateY(12px) scale(0.95); }
        to   { opacity:1; transform:translateY(0)   scale(1);    }
      }
      @keyframes __cb_fadeInDown {
        from { opacity:0; transform:translateY(-12px) scale(0.95); }
        to   { opacity:1; transform:translateY(0)     scale(1);    }
      }
      @keyframes __cb_popIn {
        0%   { transform:scale(0) rotate(-10deg); opacity:0; }
        70%  { transform:scale(1.12) rotate(2deg); opacity:1; }
        100% { transform:scale(1)   rotate(0deg); opacity:1; }
      }
      @keyframes __cb_slideInRight {
        from { transform:translateX(100%); }
        to   { transform:translateX(0);    }
      }
      @keyframes __cb_slideInLeft {
        from { transform:translateX(-100%); }
        to   { transform:translateX(0);     }
      }
      @keyframes __cb_slideUp {
        from { transform:translateY(100%); opacity:0; }
        to   { transform:translateY(0);    opacity:1; }
      }
      @keyframes __cb_softPulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
        50%     { box-shadow: 0 0 0 6px rgba(34,197,94,0);  }
      }
      .__cb_btn_hover:hover { transform:scale(1.1) !important; box-shadow:0 8px 24px rgba(0,0,0,0.25) !important; }
    `;
    document.head.appendChild(style);
  })();

  // ─── Sound & Voice helpers ────────────────────────────────────────────────

  function playNotificationSound(volume) {
    if (!volume || volume <= 0) return;

    // Custom audio file URL — user-provided MP3/WAV
    if (config.notificationSoundUrl) {
      try {
        const audio = new Audio(config.notificationSoundUrl);
        audio.volume = Math.min(Math.max(volume, 0), 1);
        audio.play().catch(() => {});
      } catch (_) {}
      return;
    }

    // Web Audio API presets
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx  = new AudioCtx();
      const type = config.notificationSoundType || 'ding';

      const osc1 = (freq, startAt, dur, waveType) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = waveType || 'sine';
        o.frequency.setValueAtTime(freq, startAt);
        g.gain.setValueAtTime(volume * 0.3, startAt);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
        o.start(startAt); o.stop(startAt + dur);
      };

      switch (type) {
        case 'double':
          osc1(800, ctx.currentTime,       0.1);
          osc1(800, ctx.currentTime + 0.18, 0.1);
          setTimeout(() => ctx.close().catch(() => {}), 700);
          break;
        case 'chime':
          [523, 659, 784].forEach((f, i) => osc1(f, ctx.currentTime + i * 0.12, 0.35));
          setTimeout(() => ctx.close().catch(() => {}), 1200);
          break;
        case 'rising': {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(300, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.25);
          g.gain.setValueAtTime(volume * 0.3, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3);
          setTimeout(() => ctx.close().catch(() => {}), 600);
          break;
        }
        case 'soft':
          osc1(600, ctx.currentTime, 0.15, 'triangle');
          setTimeout(() => ctx.close().catch(() => {}), 400);
          break;
        default: { // 'ding'
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(900, ctx.currentTime);
          o.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.12);
          g.gain.setValueAtTime(volume * 0.35, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
          o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.25);
          setTimeout(() => ctx.close().catch(() => {}), 600);
        }
      }
    } catch (_) {}
  }

  const VOICE_LANG_MAP = {
    en: 'en-US', hi: 'hi-IN', ar: 'ar-SA', fr: 'fr-FR',
    es: 'es-ES', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN',
    pa: 'pa-IN', kn: 'kn-IN', te: 'te-IN', bn: 'bn-IN', gu: 'gu-IN',
    pt: 'pt-BR', it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', ko: 'ko-KR',
  };

  function speakGreeting(text, volume, rate) {
    if (!text || !window.speechSynthesis) return;
    try {
      const browserLang = (navigator.language || 'en').split('-')[0];
      window.speechSynthesis.cancel();
      const utt   = new SpeechSynthesisUtterance(text);
      utt.lang    = VOICE_LANG_MAP[browserLang] || 'en-US';
      utt.volume  = Math.min(Math.max(volume || 0.8, 0), 1);
      utt.rate    = Math.min(Math.max(rate   || 1.0, 0.5), 2);
      window.speechSynthesis.speak(utt);
    } catch (_) {}
  }

  // ─── Defaults ──────────────────────────────────────────────────────────────

  const defaults = {
    chatbotId: null,
    baseUrl: defaultBaseUrl,
    embedMode: 'FLOATING_BUTTON',
    // Floating / shared
    showButton:   true,
    autoOpen:     false,
    delay:        1000,
    position:     'bottom-right',
    widgetText:   'Chat with us',
    buttonColor:  '#3b82f6',
    buttonTextColor: '#ffffff',
    buttonBorderColor: '#3b82f6',
    closeBtnBgColor: '#DF6A2E',
    closeBtnColor: '#ffffff',
    widgetSize:        70,
    widgetSizeMobile:  60,
    widgetMargin:      20,
    widgetCustomPosition: false,
    widgetTop: null, widgetBottom: null, widgetLeft: null, widgetRight: null,
    widgetShape: 'round',
    windowWidth: 420, windowHeight: 600, windowBorderRadius: 16,
    iconUrl: null,   // IMAGE or SVG URL — used as <img src>
    iconEmoji: null, // Emoji string — rendered as <span>, never as <img>
    iconType: 'EMOJI', // 'EMOJI' | 'IMAGE' | 'SVG'
    // Teaser
    teaserEnabled: true,
    teaserMessage: '👋 Hi! Need help finding what you\'re looking for?',
    teaserDelay: 3,
    teaserBgColor: '#111CA8',
    teaserTextColor: '#ffffff',
    teaserCtaYes: 'Yes, help me',
    teaserCtaNo: 'Not now',
    // Sticky bar
    stickyBarText: 'Chat with us — we reply instantly',
    stickyBarBgColor: '#111CA8',
    stickyBarTextColor: '#ffffff',
    stickyBarPosition: 'bottom',
    stickyBarCtaText: 'Start chat →',
    // Drawer
    drawerSide: 'right',
    drawerWidth: 380,
    drawerTabText: 'Chat',
    drawerTabBgColor: '#111CA8',
    // Voice & Sound
    notificationSound:    true,
    notificationVolume:   0.4,
    notificationSoundType: 'ding',
    notificationSoundUrl:  null,
    voiceGreeting:        false,
    voiceGreetingVolume:  0.8,
    voiceGreetingRate:    1.0,
    // Internal — greeting text resolved from chatbot data
    _greetingText: '',
  };

  let config = { ...defaults };
  let isInitialized = false;

  // DOM references per mode
  let iframe = null;
  let button = null;
  let closeBtn = null;
  let teaserEl = null;
  let stickyBarEl = null;
  let drawerEl = null;
  let drawerTab = null;
  let overlay = null;

  function teardown() {
    [button, closeBtn, iframe, teaserEl, stickyBarEl, drawerEl, drawerTab, overlay].forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    button = closeBtn = iframe = teaserEl = stickyBarEl = drawerEl = drawerTab = overlay = null;
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  async function init(userConfig) {
    if (isInitialized) return;

    config = { ...defaults, ...userConfig };
    if (!config.chatbotId) { console.error('Chatbot ID is required'); return; }

    // ── Step 1: Render immediately with defaults so button appears instantly ──
    // No layout shift or late-pop — position is set on first paint.
    if (typeof config.embedMode === 'string') {
      config.embedMode = config.embedMode.toUpperCase().replace(/-/g, '_');
    }
    switch (config.embedMode) {
      case 'INLINE':          buildInline();       break;
      case 'STICKY_BAR':      buildStickyBar();    break;
      case 'SLIDE_DRAWER':    buildSlideDrawer();  break;
      case 'TEASER_BUBBLE':   buildTeaserBubble(); break;
      default:                buildFloating();     break;
    }
    setupMessageListener();
    isInitialized = true;

    // ── Step 2: Fetch DB config in background and silently patch the UI ───────
    try {
      const response = await fetch(`${config.baseUrl}/api/chatbots/${config.chatbotId}`, { cache: 'no-cache' });
      if (!response.ok) return;
      const db = await response.json();

      const th = db.theme || {};

      // Patch icon — use theme widget icon with correct type, fall back to chatbot icon/avatar
      // widgetIconType: 'EMOJI' | 'SVG' | 'IMAGE'
      const widgetIcon     = th.widgetIcon     || null;
      const widgetIconType = th.widgetIconType || 'EMOJI';
      const fallbackUrl    = db.icon || db.avatar || null;

      // Backward-compat: if theme says EMOJI but has no emoji value and db has an image, use the image
      const effectiveIconType = (widgetIconType === 'EMOJI' && !widgetIcon && fallbackUrl) ? 'IMAGE' : widgetIconType;
      const rawIconUrl    = effectiveIconType === 'EMOJI' ? null : (widgetIcon || fallbackUrl);
      // Resolve relative URLs so images work when widget is embedded on external sites
      config.iconUrl      = rawIconUrl && !/^(https?:\/\/|\/\/|data:)/.test(rawIconUrl)
        ? config.baseUrl + (rawIconUrl.startsWith('/') ? rawIconUrl : '/' + rawIconUrl)
        : rawIconUrl;
      config.iconEmoji    = effectiveIconType === 'EMOJI' ? (widgetIcon || null) : null;
      config.iconType     = widgetIconType;

      updateBtnIcon(config.iconUrl, config.iconEmoji);
      updateDrawerTabIcon(config.iconUrl, config.iconEmoji);
      updateStickyBarIcon(config.iconUrl, config.iconEmoji, config.stickyBarTextColor);

      // Re-apply visual theme settings that may differ from defaults
      const prevSize     = config.widgetSize;
      const prevSizeMob  = config.widgetSizeMobile;
      const prevShape    = config.widgetShape;
      const prevBtnColor = config.buttonColor;
      const prevBorder   = config.buttonBorderColor;
      const prevPos      = config.position;
      const prevMargin   = config.widgetMargin;
      const prevCustom   = config.widgetCustomPosition;

      config.widgetSize       = th.widgetSize       || 70;
      config.widgetSizeMobile = th.widgetSizeMobile || 60;
      config.widgetShape      = th.widgetShape      || 'round';
      if (th.widgetText)     config.widgetText       = th.widgetText;
      if (th.widgetBgColor)  config.buttonColor      = th.widgetBgColor;
      if (th.widgetColor)    config.buttonBorderColor = th.widgetColor;
      config.closeBtnBgColor = th.closeButtonBgColor || config.closeBtnBgColor;
      config.closeBtnColor   = th.closeButtonColor   || config.closeBtnColor;
      if (th.widgetPosition) config.position = th.widgetPosition.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase();
      config.widgetCustomPosition = th.widgetCustomPosition || false;
      config.widgetTop    = th.widgetTop    ?? null;
      config.widgetBottom = th.widgetBottom ?? null;
      config.widgetLeft   = th.widgetLeft   ?? null;
      config.widgetRight  = th.widgetRight  ?? null;
      config.widgetMargin = th.widgetMargin ?? 20;
      config.windowWidth        = th.windowWidth        || 420;
      config.windowHeight       = th.windowHeight       || 600;
      config.windowBorderRadius = th.windowBorderRadius ?? 16;

      // Mode-specific settings — applied BEFORE mode check so rebuild uses correct config
      config.teaserEnabled   = th.teaserEnabled   ?? config.teaserEnabled;
      config.teaserMessage   = th.teaserMessage   || config.teaserMessage;
      config.teaserDelay     = th.teaserDelay     ?? config.teaserDelay;
      config.teaserBgColor   = th.teaserBgColor   || config.teaserBgColor;
      config.teaserTextColor = th.teaserTextColor || config.teaserTextColor;
      config.teaserCtaYes    = th.teaserCtaYes    || config.teaserCtaYes;
      config.teaserCtaNo     = th.teaserCtaNo     || config.teaserCtaNo;
      config.stickyBarText      = th.stickyBarText      || config.stickyBarText;
      config.stickyBarBgColor   = th.stickyBarBgColor   || config.stickyBarBgColor;
      config.stickyBarTextColor = th.stickyBarTextColor || config.stickyBarTextColor;
      config.stickyBarPosition  = th.stickyBarPosition  || config.stickyBarPosition;
      config.stickyBarCtaText   = th.stickyBarCtaText   || config.stickyBarCtaText;
      config.drawerSide       = th.drawerSide      || config.drawerSide;
      config.drawerWidth      = th.drawerWidth     || config.drawerWidth;
      config.drawerTabText    = th.drawerTabText   || config.drawerTabText;
      config.drawerTabBgColor = th.drawerTabBgColor|| config.drawerTabBgColor;

      // Embed mode — if DB says a different mode, teardown current UI and rebuild with correct config
      const newMode = (th.embedMode || config.embedMode || 'FLOATING_BUTTON').toUpperCase().replace(/-/g, '_');
      if (newMode !== config.embedMode) {
        config.embedMode = newMode;
        teardown();
        switch (newMode) {
          case 'INLINE':        await buildInline();       break;
          case 'STICKY_BAR':   await buildStickyBar();    break;
          case 'SLIDE_DRAWER': await buildSlideDrawer();  break;
          case 'TEASER_BUBBLE':await buildTeaserBubble(); break;
          default:             await buildFloating();      break;
        }
        return; // DOM patch below not needed — rebuild already applied full theme
      }

      // Voice & Sound
      config.notificationSound    = th.notificationSound    ?? config.notificationSound;
      config.notificationVolume   = th.notificationVolume   ?? config.notificationVolume;
      config.notificationSoundType = th.notificationSoundType || config.notificationSoundType;
      config.notificationSoundUrl  = th.notificationSoundUrl  || config.notificationSoundUrl;
      config.voiceGreeting        = th.voiceGreeting        ?? config.voiceGreeting;
      config.voiceGreetingVolume  = th.voiceGreetingVolume  ?? config.voiceGreetingVolume;
      config.voiceGreetingRate    = th.voiceGreetingRate    ?? config.voiceGreetingRate;

      // Resolve greeting text for TTS
      try {
        const greetingArr = db.greeting;
        if (Array.isArray(greetingArr) && greetingArr.length > 0) {
          const g = greetingArr[0];
          const browserLang = (navigator.language || 'en').split('-')[0];
          config._greetingText =
            (typeof g === 'string' ? g : (g[browserLang] || g['en'] || Object.values(g)[0])) || '';
        }
      } catch (_) {}

      if (userConfig.autoOpen === undefined) {
        config.autoOpen = th.popup_onload ?? db.popup_onload ?? false;
      }

      // Silently re-apply button position/size/color if they changed from defaults
      // Always apply theme to button after API data loads — ensures external sites always show correct styling
      if (button) {
        const isMob = window.innerWidth < 768;
        const sz    = isMob ? config.widgetSizeMobile : config.widgetSize;
        button.style.width            = sz + 'px';
        button.style.height           = sz + 'px';
        button.style.borderRadius     = getBtnRadius();
        button.style.backgroundColor  = config.buttonColor;
        button.style.border           = `3px solid ${config.buttonBorderColor || config.buttonColor}`;
        button.title                  = config.widgetText || '';
        button.setAttribute('aria-label', config.widgetText || 'Open chatbot');
        applyBtnPosition(button);
        if (iframe) applyWinPosition(iframe, sz);
      }

      // Patch close button colors
      if (closeBtn) {
        closeBtn.style.backgroundColor = config.closeBtnBgColor;
        closeBtn.style.color           = config.closeBtnColor;
      }

      // Patch drawer elements — fixes position/text/color not updating on external sites
      if (drawerEl && drawerTab) {
        const side = config.drawerSide;
        drawerEl.style.removeProperty('left');
        drawerEl.style.removeProperty('right');
        drawerEl.style[side]     = '0';
        drawerEl.style.width     = Math.min(config.drawerWidth || 380, window.innerWidth - 40) + 'px';
        drawerEl.style.transform = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
        drawerEl.style.boxShadow = side === 'left' ? '8px 0 32px rgba(0,0,0,0.15)' : '-8px 0 32px rgba(0,0,0,0.15)';
        drawerTab.style.removeProperty('left');
        drawerTab.style.removeProperty('right');
        drawerTab.style[side]           = '0';
        drawerTab.style.transition      = `${side} 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease`;
        drawerTab.style.backgroundColor = config.drawerTabBgColor;
        drawerTab.style.borderRadius    = side === 'right' ? '10px 0 0 10px' : '0 10px 10px 0';
        const labelSpan = drawerTab.lastElementChild;
        if (labelSpan && labelSpan.nodeName === 'SPAN') labelSpan.textContent = config.drawerTabText;
      }

      // Patch sticky bar elements — fixes text/color/position not updating on external sites
      if (stickyBarEl) {
        const newBarPos = config.stickyBarPosition || 'bottom';
        stickyBarEl.style.backgroundColor = config.stickyBarBgColor;
        stickyBarEl.style.removeProperty('top');
        stickyBarEl.style.removeProperty('bottom');
        stickyBarEl.style[newBarPos] = '0';
        stickyBarEl.style.boxShadow = newBarPos === 'bottom'
          ? '0 -4px 20px rgba(0,0,0,0.12)'
          : '0 4px 20px rgba(0,0,0,0.12)';
        if (iframe) {
          iframe.style.removeProperty('top');
          iframe.style.removeProperty('bottom');
          if (newBarPos === 'bottom') iframe.style.bottom = '64px';
          else                        iframe.style.top    = '64px';
        }
        const spans = stickyBarEl.querySelectorAll('span');
        if (spans[0]) {
          spans[0].textContent = (config.stickyBarText || '').replace(/^[\p{Emoji}\s]+/u, '');
          spans[0].style.color = config.stickyBarTextColor;
        }
        if (spans[1]) {
          spans[1].textContent = config.stickyBarCtaText;
          spans[1].style.color = config.stickyBarTextColor;
        }
      }

      // Auto-open after theme loaded (popup_onload)
      if (config.autoOpen && iframe && iframe.style.display === 'none') {
        setTimeout(openChat, config.delay || 1000);
      }
    } catch (e) {
      // Non-fatal — widget already rendered with defaults above
    } finally {
      // Reveal widget after correct config applied — prevents flash of default blue styling
      if (button) {
        button.style.visibility = 'visible';
        button.style.animation  = '__cb_popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards';
      }
      if (drawerTab)   drawerTab.style.opacity   = '1';
      if (stickyBarEl) {
        stickyBarEl.style.visibility = 'visible';
        const pos = config.stickyBarPosition || 'bottom';
        stickyBarEl.style.animation = pos === 'bottom'
          ? '__cb_fadeInUp 0.4s ease forwards'
          : '__cb_fadeInDown 0.4s ease forwards';
      }
    }
  }

  // ─── Update button icon after config loads ────────────────────────────────
  // url  = Cloudinary/SVG URL (for IMAGE / SVG types)
  // emoji = emoji character string (for EMOJI type)
  // Either can be null — if both null, renders default chat SVG.

  function updateBtnIcon(url, emoji) {
    if (!button) return;
    const inner = button.querySelector('div');
    if (!inner) return;
    inner.innerHTML = ''; // clear whatever was there before

    const defaultSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`;

    if (emoji) {
      // Emoji — render as text, never as <img>
      const span = document.createElement('span');
      span.textContent = emoji;
      span.style.cssText = 'font-size:28px;line-height:1;user-select:none;';
      inner.appendChild(span);
    } else if (url) {
      // IMAGE or SVG URL
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Chat';
      img.style.cssText = `width:100%;height:100%;object-fit:cover;border-radius:${getBtnRadius()};`;
      img.onerror = function () { inner.innerHTML = defaultSvg; };
      inner.appendChild(img);
    } else {
      // Nothing set — default chat bubble SVG
      inner.innerHTML = defaultSvg;
    }
  }


  function updateDrawerTabIcon(url, emoji) {
    if (!drawerTab) return;
    // Remove any existing icon node (first child before the label span)
    const first = drawerTab.firstChild;
    if (first && first.tagName !== 'SPAN' || (first && first.tagName === 'SPAN' && !first.textContent.trim().match(/[a-zA-Z]/))) {
      first.remove();
    }
    const iconNode = document.createElement(emoji ? 'span' : 'div');
    if (emoji) {
      iconNode.textContent = emoji;
      iconNode.style.cssText = 'font-size:18px;line-height:1;';
    } else if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:24px;height:24px;object-fit:cover;border-radius:4px;';
      img.onerror = function () { iconNode.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`; };
      iconNode.appendChild(img);
    } else {
      iconNode.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`;
    }
    drawerTab.insertBefore(iconNode, drawerTab.firstChild);
  }

  function updateStickyBarIcon(url, emoji, textColor) {
    if (!stickyBarEl) return;
    const iconDiv = stickyBarEl.querySelector('div');
    if (!iconDiv) return;
    iconDiv.innerHTML = '';
    iconDiv.textContent = '';
    if (emoji) {
      iconDiv.textContent = emoji;
      iconDiv.style.fontSize = '20px';
    } else if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:24px;height:24px;object-fit:cover;border-radius:50%;';
      img.onerror = function () { iconDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="${textColor || '#fff'}"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`; };
      iconDiv.appendChild(img);
    } else {
      iconDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="${textColor || '#fff'}"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`;
    }
  }

  // ─── Iframe factory ────────────────────────────────────────────────────────

  async function createIframe(extraStyle = {}) {
    iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'microphone *; camera *; speaker-selection *');
    iframe.title = 'Chatbot';

    const qp = new URLSearchParams();
    qp.set('is_mobile', String(window.innerWidth < 768));
    try {
      if (navigator.permissions) {
        const s = await navigator.permissions.query({ name: 'microphone' });
        qp.set('parent_permission', s.state || 'unknown');
      }
    } catch (_) { qp.set('parent_permission', 'unknown'); }

    iframe.src = `${config.baseUrl}/embed/widget/${config.chatbotId}?${qp}`;

    const base = {
      border: 'none',
      display: 'block',
      background: 'white',
    };
    Object.assign(iframe.style, base, extraStyle);
    return iframe;
  }

  // ─── Border-radius helper ──────────────────────────────────────────────────

  function getBtnRadius() {
    const s = (config.widgetShape || 'round').toUpperCase();
    if (s === 'SQUARE') return '0';
    if (s === 'ROUNDED_SQUARE') return '16px';
    return '50%';
  }

  // ─── Position helpers ──────────────────────────────────────────────────────

  function applyBtnPosition(el) {
    const isMob  = window.innerWidth < 768;
    const size   = isMob ? config.widgetSizeMobile : config.widgetSize;
    const margin = config.widgetMargin ?? 20;
    el.style.bottom = el.style.top = el.style.left = el.style.right = 'auto';

    if (config.widgetCustomPosition) {
      if (config.widgetLeft  != null) el.style.left   = config.widgetLeft  + 'px';
      if (config.widgetRight != null) el.style.right  = config.widgetRight + 'px';
      if (config.widgetTop   != null) el.style.top    = config.widgetTop   + 'px';
      if (config.widgetBottom!= null) el.style.bottom = config.widgetBottom+ 'px';
    } else {
      const pos = config.position || 'bottom-right';
      if (pos.includes('bottom')) el.style.bottom = margin + 'px';
      if (pos.includes('top'))    el.style.top    = margin + 'px';
      if (pos.includes('right'))  el.style.right  = margin + 'px';
      if (pos.includes('left'))   el.style.left   = margin + 'px';
    }
  }

  function applyWinPosition(el, btnSize) {
    const isMob  = window.innerWidth <= 480;
    const margin = config.widgetMargin ?? 20;
    el.style.bottom = el.style.top = el.style.left = el.style.right = 'auto';

    if (isMob) {
      el.style.bottom = el.style.left = el.style.right = el.style.top = '0';
      el.style.width  = '100%';
      el.style.height = '100%';
      el.style.maxWidth = el.style.maxHeight = '100%';
      el.style.borderRadius = '0';
      return;
    }

    const offset = (margin + btnSize + 10) + 'px';
    const pos    = config.position || 'bottom-right';

    if (config.widgetCustomPosition) {
      if (config.widgetLeft  != null) el.style.left   = config.widgetLeft  + 'px';
      if (config.widgetRight != null) el.style.right  = config.widgetRight + 'px';
      if (config.widgetBottom!= null) el.style.bottom = (config.widgetBottom + btnSize + 10) + 'px';
      else if (config.widgetTop != null) el.style.top = (config.widgetTop + btnSize + 10) + 'px';
    } else {
      if (pos.includes('bottom')) el.style.bottom = offset;
      if (pos.includes('top'))    el.style.top    = offset;
      if (pos.includes('right'))  el.style.right  = margin + 'px';
      if (pos.includes('left'))   el.style.left   = margin + 'px';
    }
  }

  // ─── 1. FLOATING BUTTON ────────────────────────────────────────────────────

  async function buildFloating() {
    const isMob   = window.innerWidth < 768;
    const btnSize = isMob ? config.widgetSizeMobile : config.widgetSize;
    const borderR = config.windowBorderRadius ?? 16;

    // Chat window iframe
    await createIframe();
    Object.assign(iframe.style, {
      position: 'fixed', zIndex: '999999',
      width: (config.windowWidth || 420) + 'px',
      maxWidth: 'calc(100% - 40px)',
      height: (config.windowHeight || 600) + 'px',
      maxHeight: '85vh',
      borderRadius: borderR + 'px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      display: 'none',
    });
    applyWinPosition(iframe, btnSize);
    document.body.appendChild(iframe);

    // Close button (desktop)
    if (window.innerWidth > 768) buildCloseBtn();

    // Launcher button
    if (config.showButton) buildLauncherBtn(btnSize);

    if (config.autoOpen) setTimeout(openChat, config.delay);

    // Debounce resize: mobile Safari fires on every scroll pixel as browser
    // chrome shows/hides — without this it runs 30-60×/s during normal scroll.
    var _resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(onResize, 120);
    });
  }

  function buildLauncherBtn(size) {
    button = document.createElement('div');
    button.id = '__chatbot_launcher__';
    button.className = '__cb_btn_hover';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', 'Open chatbot');

    // Inner icon container — actual icon rendered via updateBtnIcon() so
    // the same type-aware logic (EMOJI / IMAGE / SVG / fallback) is used
    // both at initial build time and after the API config patch.
    const inner = document.createElement('div');
    inner.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    button.appendChild(inner);

    // Render icon immediately; updateBtnIcon patches it again after API fetch
    updateBtnIcon(config.iconUrl || null, config.iconEmoji || null);

    // Online dot
    const dot = document.createElement('span');
    dot.style.cssText = 'position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white;animation:__cb_softPulse 2s ease-in-out infinite;';
    button.appendChild(dot);

    Object.assign(button.style, {
      position: 'fixed', zIndex: '999999',
      width: size + 'px', height: size + 'px',
      borderRadius: getBtnRadius(),
      backgroundColor: config.buttonColor,
      border: `3px solid ${config.buttonBorderColor || config.buttonColor}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      overflow: 'hidden', padding: '0',
      visibility: 'hidden',
    });

    applyBtnPosition(button);
    button.addEventListener('click', toggleChat);
    document.body.appendChild(button);
  }

  function buildCloseBtn() {
    closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close chat');
    Object.assign(closeBtn.style, {
      position: 'fixed', zIndex: '9999999',
      width: '32px', height: '32px',
      borderRadius: '50%',
      backgroundColor: config.closeBtnBgColor,
      color: config.closeBtnColor,
      border: '2px solid rgba(255,255,255,0.4)',
      cursor: 'pointer',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)', padding: '0',
      transition: 'transform 0.15s ease',
    });
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.onmouseenter = () => { closeBtn.style.transform = 'scale(1.1)'; };
    closeBtn.onmouseleave = () => { closeBtn.style.transform = 'scale(1)'; };
    closeBtn.onclick = closeChat;
    document.body.appendChild(closeBtn);
  }

  function positionCloseBtn() {
    if (!iframe || !closeBtn) return;
    const r = iframe.getBoundingClientRect();
    closeBtn.style.top  = (r.top  - 16) + 'px';
    closeBtn.style.left = (r.right - 16) + 'px';
    closeBtn.style.display = (window.innerWidth <= 480 || iframe.style.display === 'none') ? 'none' : 'flex';
  }

  function toggleChat() {
    iframe.style.display === 'none' ? openChat() : closeChat();
  }

  function openChat() {
    if (!iframe) return;
    // Notification sound (user clicked = allowed by browsers)
    if (config.notificationSound) playNotificationSound(config.notificationVolume);
    iframe.style.display = 'block';
    iframe.style.animation = '__cb_fadeInUp 0.35s cubic-bezier(0.34,1.2,0.64,1) forwards';
    if (closeBtn) { closeBtn.style.display = 'flex'; requestAnimationFrame(positionCloseBtn); }
    if (button && window.innerWidth <= 480) button.style.display = 'none';
    // Voice greeting after chat is visible
    if (config.voiceGreeting && config._greetingText) {
      setTimeout(() => speakGreeting(config._greetingText, config.voiceGreetingVolume, config.voiceGreetingRate), 600);
    }
  }

  function closeChat() {
    if (!iframe) return;
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    iframe.style.animation = 'none';
    iframe.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
    if (button)   button.style.display   = 'flex';
    // Drawer / sticky
    if (drawerEl)    { drawerEl.style.transform    = config.drawerSide === 'left' ? 'translateX(-100%)' : 'translateX(100%)'; }
    if (stickyBarEl && stickyBarEl._chatOpen) {
      if (drawerEl) { /* noop */ } else closeStickyChat();
    }
  }

  function onResize() {
    if (!iframe) return;
    const isMob = window.innerWidth <= 480;
    if (isMob) {
      Object.assign(iframe.style, { bottom:'0',right:'0',left:'0',top:'0', width:'100%',maxWidth:'100%', height:'100%',maxHeight:'100vh', borderRadius:'0' });
    } else {
      const btnSize = window.innerWidth < 768 ? config.widgetSizeMobile : config.widgetSize;
      iframe.style.width        = (config.windowWidth || 420)  + 'px';
      iframe.style.maxWidth     = 'calc(100% - 40px)';
      iframe.style.height       = (config.windowHeight || 600) + 'px';
      iframe.style.maxHeight    = '85vh';
      iframe.style.borderRadius = (config.windowBorderRadius ?? 16) + 'px';
      applyWinPosition(iframe, btnSize);
    }
    if (button) {
      const s = window.innerWidth < 768 ? config.widgetSizeMobile : config.widgetSize;
      button.style.width  = s + 'px';
      button.style.height = s + 'px';
    }
    positionCloseBtn();
  }

  // ─── 2. TEASER BUBBLE ──────────────────────────────────────────────────────

  async function buildTeaserBubble() {
    await buildFloating(); // reuse floating infrastructure

    if (!config.teaserEnabled) return;

    setTimeout(() => {
      if (!button || !document.body.contains(button)) return;
      // Don't show teaser if chat is already open
      if (iframe && iframe.style.display !== 'none') return;

      teaserEl = document.createElement('div');
      const isMob   = window.innerWidth < 768;
      const btnSize = isMob ? config.widgetSizeMobile : config.widgetSize;
      const margin  = config.widgetMargin ?? 20;
      const pos     = config.position || 'bottom-right';
      const onLeft  = pos.includes('left');

      Object.assign(teaserEl.style, {
        position:        'fixed',
        zIndex:          '999998',
        maxWidth:        '240px',
        backgroundColor: config.teaserBgColor,
        color:           config.teaserTextColor,
        padding:         '12px 16px',
        borderRadius:    onLeft ? '12px 12px 12px 0' : '12px 12px 0 12px',
        boxShadow:       '0 6px 24px rgba(0,0,0,0.15)',
        fontSize:        '13px',
        fontWeight:      '500',
        lineHeight:      '1.5',
        cursor:          'pointer',
        animation:       '__cb_fadeInUp 0.4s ease forwards',
        fontFamily:      'inherit',
        bottom:          (margin + btnSize + 14) + 'px',
        [onLeft ? 'left' : 'right']: margin + 'px',
      });

      teaserEl.innerHTML = `
        <p style="margin:0 0 10px;">${config.teaserMessage}</p>
        <div style="display:flex;gap:8px;">
          <button id="__cb_teaser_yes__" style="flex:1;padding:5px 12px;border-radius:20px;background:rgba(255,255,255,0.2);color:inherit;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.3);cursor:pointer;font-family:inherit;">${config.teaserCtaYes}</button>
          <button id="__cb_teaser_no__"  style="padding:5px 12px;border-radius:20px;background:transparent;color:inherit;font-size:12px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;font-family:inherit;">${config.teaserCtaNo}</button>
        </div>`;

      teaserEl.querySelector('#__cb_teaser_yes__').onclick = (e) => { e.stopPropagation(); dismissTeaser(); openChat(); };
      teaserEl.querySelector('#__cb_teaser_no__').onclick  = (e) => { e.stopPropagation(); dismissTeaser(); };
      teaserEl.onclick = () => { dismissTeaser(); openChat(); };

      document.body.appendChild(teaserEl);
    }, (config.teaserDelay ?? 3) * 1000);
  }

  function dismissTeaser() {
    if (!teaserEl) return;
    teaserEl.style.animation = 'none';
    teaserEl.style.opacity   = '0';
    teaserEl.style.transform = 'translateY(8px)';
    teaserEl.style.transition= 'all 0.2s ease';
    setTimeout(() => { teaserEl && teaserEl.remove(); teaserEl = null; }, 250);
  }

  // ─── 3. STICKY BAR ─────────────────────────────────────────────────────────

  async function buildStickyBar() {
    const barPos = config.stickyBarPosition || 'bottom';

    // Create the sticky bar
    stickyBarEl = document.createElement('div');
    stickyBarEl._chatOpen = false;

    Object.assign(stickyBarEl.style, {
      position:        'fixed',
      zIndex:          '999998',
      left:            '0', right: '0',
      [barPos]:        '0',
      height:          '52px',
      backgroundColor: config.stickyBarBgColor,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             '12px',
      cursor:          'pointer',
      boxShadow:       barPos === 'bottom'
        ? '0 -4px 20px rgba(0,0,0,0.12)'
        : '0 4px 20px rgba(0,0,0,0.12)',
      fontFamily:      'inherit',
      visibility:      'hidden',
    });

    // Icon — use chatbot's configured icon (emoji / image) or default SVG
    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0;';
    if (config.iconEmoji) {
      iconDiv.textContent = config.iconEmoji;
      iconDiv.style.fontSize = '20px';
    } else if (config.iconUrl) {
      const img = document.createElement('img');
      img.src = config.iconUrl;
      img.style.cssText = 'width:24px;height:24px;object-fit:cover;border-radius:50%;';
      img.onerror = function () {
        iconDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="${config.stickyBarTextColor}" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`;
      };
      iconDiv.appendChild(img);
    } else {
      iconDiv.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="${config.stickyBarTextColor}" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`;
    }

    // Text
    const textEl = document.createElement('span');
    // Strip any leading emoji so the SVG icon isn't duplicated
    textEl.textContent = (config.stickyBarText || '').replace(/^[\p{Emoji}\s]+/u, '');
    Object.assign(textEl.style, {
      color: config.stickyBarTextColor, fontSize: '14px', fontWeight: '600',
    });

    // CTA pill
    const ctaEl = document.createElement('span');
    ctaEl.textContent = config.stickyBarCtaText;
    Object.assign(ctaEl.style, {
      padding: '4px 14px',
      borderRadius: '20px',
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: config.stickyBarTextColor,
      fontSize: '12px', fontWeight: '700',
      border: '1px solid rgba(255,255,255,0.25)',
    });

    stickyBarEl.appendChild(iconDiv);
    stickyBarEl.appendChild(textEl);
    stickyBarEl.appendChild(ctaEl);

    // Create iframe (hidden initially)
    await createIframe();
    const borderR = config.windowBorderRadius ?? 16;
    const winW    = Math.min(config.windowWidth || 420, window.innerWidth - 32);
    const winH    = Math.min(config.windowHeight || 600, window.innerHeight - 80);

    Object.assign(iframe.style, {
      position: 'fixed', zIndex: '999999',
      right: '16px',
      width: winW + 'px', maxWidth: 'calc(100% - 32px)',
      height: winH + 'px',
      borderRadius: borderR + 'px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      display: 'none',
    });
    if (barPos === 'bottom') iframe.style.bottom = '64px';
    else                    iframe.style.top    = '64px';

    stickyBarEl.addEventListener('click', () => {
      if (stickyBarEl._chatOpen) closeStickyChat(); else openStickyChat();
    });

    document.body.appendChild(iframe);
    document.body.appendChild(stickyBarEl);

    if (config.autoOpen) setTimeout(openStickyChat, config.delay);
  }

  function openStickyChat() {
    if (config.notificationSound) playNotificationSound(config.notificationVolume);
    iframe.style.display = 'block';
    iframe.style.animation = '__cb_fadeInUp 0.35s cubic-bezier(0.34,1.2,0.64,1) forwards';
    stickyBarEl._chatOpen = true;
    if (config.voiceGreeting && config._greetingText) {
      setTimeout(() => speakGreeting(config._greetingText, config.voiceGreetingVolume, config.voiceGreetingRate), 600);
    }
  }

  function closeStickyChat() {
    iframe.style.animation = 'none';
    iframe.style.display   = 'none';
    stickyBarEl._chatOpen  = false;
  }

  // ─── 4. SLIDE DRAWER ───────────────────────────────────────────────────────

  async function buildSlideDrawer() {
    const side  = config.drawerSide || 'right';
    const width = Math.min(config.drawerWidth || 380, window.innerWidth - 40);

    // Drawer panel
    drawerEl = document.createElement('div');
    Object.assign(drawerEl.style, {
      position:  'fixed',
      top:       '0', bottom: '0',
      [side]:    '0',
      width:     width + 'px',
      maxWidth:  '100vw',
      zIndex:    '999999',
      transform: side === 'left' ? 'translateX(-100%)' : 'translateX(100%)',
      transition:'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
      boxShadow: side === 'left'
        ? '8px 0 32px rgba(0,0,0,0.15)'
        : '-8px 0 32px rgba(0,0,0,0.15)',
      overflow:  'hidden',
      background:'#fff',
    });

    await createIframe({ width: '100%', height: '100%' });
    drawerEl.appendChild(iframe);
    document.body.appendChild(drawerEl);

    // Dim overlay
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0',
      backgroundColor: 'rgba(0,0,0,0.35)',
      zIndex: '999998',
      opacity: '0', pointerEvents: 'none',
      transition: 'opacity 0.3s ease',
    });
    overlay.onclick = closeDrawer;
    document.body.appendChild(overlay);

    // Tab trigger
    drawerTab = document.createElement('button');
    drawerTab.setAttribute('aria-label', 'Open chat');
    Object.assign(drawerTab.style, {
      position:  'fixed',
      top:       '50%',
      [side]:    '0',
      transform: 'translateY(-50%)',
      zIndex:    '999997',
      transition:`${side} 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease`,
      display:   'flex', alignItems: 'center',
      padding:   '12px 6px',
      backgroundColor: config.drawerTabBgColor,
      color:     '#fff', border: 'none', cursor: 'pointer',
      borderRadius: side === 'right' ? '10px 0 0 10px' : '0 10px 10px 0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      writingMode: 'vertical-rl', textOrientation: 'mixed',
      fontSize:  '13px', fontWeight: '700', letterSpacing: '0.5px',
      fontFamily: 'inherit',
      gap: '6px',
      opacity:   '0',
    });

    // Drawer tab icon — respect iconType same as launcher button
    if (config.iconEmoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = config.iconEmoji;
      emojiSpan.style.cssText = 'font-size:18px;line-height:1;';
      drawerTab.appendChild(emojiSpan);
    } else if (config.iconUrl) {
      const img = document.createElement('img');
      img.src = config.iconUrl;
      img.style.cssText = 'width:24px;height:24px;object-fit:cover;border-radius:4px;';
      img.onerror = function () {
        img.replaceWith(Object.assign(document.createElement('span'), {
          innerHTML: `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`,
        }));
      };
      drawerTab.appendChild(img);
    } else {
      drawerTab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/></svg>`;
    }
    const label = document.createElement('span');
    label.textContent = config.drawerTabText;
    drawerTab.appendChild(label);

    drawerTab.addEventListener('click', toggleDrawer);
    document.body.appendChild(drawerTab);

    if (config.autoOpen) setTimeout(openDrawer, config.delay);
  }

  function openDrawer() {
    if (config.notificationSound) playNotificationSound(config.notificationVolume);
    drawerEl.style.transform = 'translateX(0)';
    overlay.style.opacity    = '1';
    overlay.style.pointerEvents = 'auto';
    drawerTab.style[config.drawerSide] = (config.drawerWidth || 380) + 'px';
    if (config.voiceGreeting && config._greetingText) {
      setTimeout(() => speakGreeting(config._greetingText, config.voiceGreetingVolume, config.voiceGreetingRate), 600);
    }
  }

  function closeDrawer() {
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    const side = config.drawerSide || 'right';
    drawerEl.style.transform = side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
    overlay.style.opacity    = '0';
    overlay.style.pointerEvents = 'none';
    drawerTab.style[side] = '0';
  }

  function toggleDrawer() {
    const open = drawerEl.style.transform === 'translateX(0px)' || drawerEl.style.transform === 'translateX(0)';
    open ? closeDrawer() : openDrawer();
  }

  // ─── 5. INLINE ─────────────────────────────────────────────────────────────

  async function buildInline() {
    const containerId = config.container;
    const container   = containerId
      ? document.getElementById(containerId)
      : document.querySelector('[data-chatbot-inline]');

    if (!container) {
      console.warn('Chatbot inline mode: container not found. Add id="' + (containerId || 'your-container') + '" to a div.');
      return;
    }

    await createIframe({ width: '100%', height: '100%', borderRadius: 'inherit' });
    container.style.overflow = 'hidden';
    if (!container.style.height) container.style.height = '600px';

    iframe.style.animation = '__cb_fadeInUp 0.4s ease forwards';
    container.appendChild(iframe);
  }

  // ─── Message listener ──────────────────────────────────────────────────────

  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      const d = event.data;
      if (!d || d.chatbotId !== config.chatbotId) return;

      if (d.type === 'chatbot-close') {
        if (config.embedMode === 'SLIDE_DRAWER') closeDrawer();
        else if (config.embedMode === 'STICKY_BAR') closeStickyChat();
        else closeChat();
      }

      if (d.type === 'chatbot-theme' && d.theme) {
        const th = d.theme;
        // Apply position/size updates from widget
        if (th.widgetPosition) config.position = th.widgetPosition.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase();
        if (th.widgetCustomPosition !== undefined) config.widgetCustomPosition = th.widgetCustomPosition;
        ['widgetTop','widgetBottom','widgetLeft','widgetRight','widgetMargin'].forEach(k => {
          if (th[k] !== undefined) config[k] = th[k];
        });
        if (th.windowWidth)  config.windowWidth  = th.windowWidth;
        if (th.windowHeight) config.windowHeight = th.windowHeight;
        if (th.windowBorderRadius != null) config.windowBorderRadius = th.windowBorderRadius;
        if (button) applyBtnPosition(button);
        if (iframe && config.embedMode === 'FLOATING_BUTTON') onResize();
      }

      if (d.type === 'theme-update' && d.theme) {
        const th = d.theme;
        // Update button visuals live
        if (button) {
          if (th.widgetBgColor)  { config.buttonColor = th.widgetBgColor; button.style.backgroundColor = th.widgetBgColor; }
          if (th.widgetColor)    { config.buttonBorderColor = th.widgetColor; button.style.borderColor = th.widgetColor; }
          if (th.widgetSize)     { config.widgetSize = th.widgetSize; if (window.innerWidth >= 768) { button.style.width = button.style.height = th.widgetSize + 'px'; } }
          if (th.widgetSizeMobile) { config.widgetSizeMobile = th.widgetSizeMobile; if (window.innerWidth < 768) { button.style.width = button.style.height = th.widgetSizeMobile + 'px'; } }
          if (th.widgetShape)    { config.widgetShape = th.widgetShape; button.style.borderRadius = getBtnRadius(); }
          if (th.widgetPosition) { config.position = th.widgetPosition.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase(); applyBtnPosition(button); }
        }
        if (closeBtn) {
          if (th.closeButtonBgColor) closeBtn.style.backgroundColor = th.closeButtonBgColor;
          if (th.closeButtonColor)   closeBtn.style.color = th.closeButtonColor;
        }
      }
    });
  }

  // ─── Command processor ────────────────────────────────────────────────────

  const processCommand = (args) => {
    const cmd    = args[0];
    const params = args[1];
    if (cmd === 'init')  init(params);
    else if (cmd === 'open') {
      if (config.embedMode === 'SLIDE_DRAWER') openDrawer();
      else if (config.embedMode === 'STICKY_BAR') openStickyChat();
      else openChat();
    }
    else if (cmd === 'close') {
      if (config.embedMode === 'SLIDE_DRAWER') closeDrawer();
      else if (config.embedMode === 'STICKY_BAR') closeStickyChat();
      else closeChat();
    }
  };

  if (window.chatbot.q) window.chatbot.q.forEach(processCommand);
  window.chatbot = function () { processCommand(arguments); };

  // ─── Auto-init from script data attributes ────────────────────────────────

  if (script) {
    const chatbotId = script.getAttribute('data-chatbot-id');
    if (chatbotId) {
      const modeAttr = script.getAttribute('data-mode') || '';
      init({
        chatbotId,
        baseUrl:     script.getAttribute('data-base-url')    || defaultBaseUrl,
        showButton:  script.getAttribute('data-show-button') !== 'false',
        autoOpen:    script.getAttribute('data-auto-open')   === 'true',
        position:    script.getAttribute('data-position')    || 'bottom-right',
        container:   script.getAttribute('data-container')   || null,
        // embedMode from attribute overrides DB value only if explicitly set
        ...(modeAttr && { embedMode: modeAttr.toUpperCase().replace(/-/g, '_') }),
      });
    }
  }

})();
