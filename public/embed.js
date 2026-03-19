/**
 * Chatbot Embed Script
 * This script loads the chatbot widget in an iframe.
 */
(function() {
  'use strict';

  // Prevent loading if already inside an iframe to avoid recursion
  if (window.self !== window.top) return;

  // Create global chatbot queue if it doesn't exist
  window.chatbot = window.chatbot || function() {
    (window.chatbot.q = window.chatbot.q || []).push(arguments);
  };

  const script = document.currentScript;
  const scriptUrl = script ? script.src : '';
  const defaultBaseUrl = scriptUrl ? new URL(scriptUrl).origin : window.location.origin;

  const defaults = {
    chatbotId: null,
    baseUrl: defaultBaseUrl,
    showButton: true,
    autoOpen: false,
    delay: 1000,
    position: 'bottom-right',
    // All colours / sizes below are overridden by theme fields on init
    buttonColor: '#ffffff',
    buttonTextColor: '#ffffff',
    closeBtnBgColor: '#DF6A2E',
    closeBtnColor: '#ffffff',
    widgetSize: 70,
    widgetSizeMobile: 60,
    // Image source for the toggle button — comes from chatbot.avatar || chatbot.icon
    iconUrl: null,
    // Shape for the toggle button — comes from theme.widgetShape
    widgetShape: 'round',
  };

  let config = { ...defaults };
  let iframe = null;
  let button = null;
  let closeBtn = null;
  let isInitialized = false;

  async function init(userConfig) {
    if (isInitialized) return;

    // Check whether parent document forbids microphone via Permissions-Policy
    if (typeof document !== 'undefined' && document.featurePolicy) {
      if (!document.featurePolicy.allowsFeature('microphone')) {
        console.warn('Parent document Permissions-Policy blocks microphone; the embedded chatbot may not be able to access it.');
      }
    }

    config = { ...defaults, ...userConfig };
    if (!config.chatbotId) {
      console.error('Chatbot ID is required');
      return;
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/chatbots/${config.chatbotId}`);
      if (response.ok) {
        const dbConfig = await response.json();

        config.iconUrl = dbConfig.icon || dbConfig.avatar || null;

        // ── All visual settings come from ChatbotTheme ───────────────────
        if (dbConfig.theme) {
          const th = dbConfig.theme;

          config.widgetSize       = th.widgetSize       || 70;
          config.widgetSizeMobile = th.widgetSizeMobile || 60;
          config.widgetShape      = th.widgetShape      || 'round';

          // Toggle button background colour
          if (th.widgetBgColor)  config.buttonColor    = th.widgetBgColor;
          // Toggle button border / accent colour
          if (th.widgetColor)    config.buttonBorderColor = th.widgetColor;

          // Close button colours
          config.closeBtnBgColor = th.closeButtonBgColor || config.closeBtnBgColor;
          config.closeBtnColor   = th.closeButtonColor   || config.closeBtnColor;

          // Position override from theme
          if (th.widgetPosition) {
            config.position = th.widgetPosition
              .toLowerCase()
              .replace(/([A-Z])/g, '-$1')
              .toLowerCase();
          }
        }

        // popup_onload — respect theme first, then chatbot root field
        if (userConfig.autoOpen === undefined) {
          config.autoOpen =
            dbConfig.theme?.popup_onload ??
            dbConfig.popup_onload ??
            false;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch chatbot config, using local settings');
    }

    await createIframe();
    createCloseButton();

    if (config.showButton) {
      createButton();
    }

    if (config.autoOpen) {
      setTimeout(openChat, config.delay);
    }

    setupMessageListener();
    isInitialized = true;
  }

  // ─── Iframe ───────────────────────────────────────────────────────────────

  async function createIframe() {
    iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'microphone *; camera *; speaker-selection *');

    const qp = new URLSearchParams();
    const isActualMobile = window.innerWidth < 768;
    qp.set('is_mobile', String(isActualMobile));

    try {
      if (typeof document !== 'undefined' && document.featurePolicy) {
        qp.set('parent_policy_blocked', String(!document.featurePolicy.allowsFeature('microphone')));
      }
    } catch (e) {}

    try {
      if (navigator && navigator.permissions && typeof navigator.permissions.query === 'function') {
        const status = await navigator.permissions.query({ name: 'microphone' });
        qp.set('parent_permission', status && status.state ? status.state : 'unknown');
      }
    } catch (e) {
      qp.set('parent_permission', 'unknown');
    }

    const chatbotUrl =
      `${config.baseUrl}/embed/widget/${config.chatbotId}` +
      (qp.toString() ? `?${qp.toString()}` : '');

    iframe.src = chatbotUrl;
    iframe.style.cssText = `
      position: fixed;
      z-index: 999999;
      bottom: 90px;
      right: 20px;
      width: 380px;
      max-width: calc(100% - 40px);
      height: 600px;
      max-height: 80vh;
      border: none;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      display: none;
      transition: all 0.3s ease;
      background: white;
    `;

    updateIframeDimensions();
    document.body.appendChild(iframe);
  }

  // ─── Close button (parent-side) ───────────────────────────────────────────

  function createCloseButton() {
    if (window.innerWidth <= 768) return; // mobile uses in-iframe controls

    closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.style.cssText = `
      position: fixed;
      z-index: 9999999;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: ${config.closeBtnBgColor};
      color: ${config.closeBtnColor};
      border: 2px solid rgba(255,255,255,0.4);
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      padding: 0;
      transition: opacity 0.15s ease, transform 0.2s ease;
    `;
    closeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`;

    closeBtn.onmouseenter = () => { closeBtn.style.transform = 'scale(1.1)'; };
    closeBtn.onmouseleave = () => { closeBtn.style.transform = 'scale(1)'; };
    closeBtn.onclick = closeChat;
    document.body.appendChild(closeBtn);
  }

  function positionCloseButton() {
    if (!iframe || !closeBtn) return;
    const rect = iframe.getBoundingClientRect();
    closeBtn.style.top  = (rect.top  - 20) + 'px';
    closeBtn.style.left = (rect.right - 20) + 'px';
    closeBtn.style.display =
      (window.innerWidth <= 480 || iframe.style.display === 'none') ? 'none' : 'flex';
  }

  // ─── Toggle button ────────────────────────────────────────────────────────

  function getButtonBorderRadius() {
    const shape = (config.widgetShape || 'round').toUpperCase();
    switch (shape) {
      case 'ROUND':          return '50%';
      case 'SQUARE':         return '0px';
      case 'ROUNDED_SQUARE': return '16px';
      default:               return '50%';
    }
  }

  function createButton() {
    button = document.createElement('div');
    button.id = 'chatbot-button';

    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    `;

    if (config.iconUrl) {
      const img = document.createElement('img');
      img.src = config.iconUrl;
      img.alt = 'Chat';
      img.style.cssText = `
        width: 100%;
        height: 100%;
        padding: 4px;
        object-fit: contain;
        border-radius: ${getButtonBorderRadius()};
      `;
      iconContainer.appendChild(img);
    } else {
      iconContainer.innerHTML = '💬';
    }
    button.appendChild(iconContainer);

    const isMobile = window.innerWidth < 768;
    const buttonSize = isMobile ? config.widgetSizeMobile : config.widgetSize;
    const borderRadius = getButtonBorderRadius();

    button.style.cssText = `
      position: fixed;
      z-index: 999999;
      bottom: 20px;
      right: 20px;
      width: ${buttonSize}px;
      height: ${buttonSize}px;
      border-radius: ${borderRadius};
      background-color: ${config.buttonColor};
      border: 3px solid ${config.buttonBorderColor || config.buttonColor};
      color: ${config.buttonTextColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    `;

    applyPosition(button, false);

    button.onclick = toggleChat;
    button.onmouseenter = () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    };
    button.onmouseleave = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    };

    document.body.appendChild(button);
  }

  // ─── Position helpers ─────────────────────────────────────────────────────

  function applyPosition(el, isIframe) {
    const pos = config.position || 'bottom-right';
    const margin = '20px';
    const iframeOffset = '90px';

    el.style.bottom = 'auto';
    el.style.top    = 'auto';
    el.style.left   = 'auto';
    el.style.right  = 'auto';

    const offset = isIframe ? iframeOffset : margin;

    if (pos.includes('bottom')) el.style.bottom = offset;
    if (pos.includes('top'))    el.style.top    = offset;
    if (pos.includes('right'))  el.style.right  = margin;
    if (pos.includes('left'))   el.style.left   = margin;
  }

  function updateIframeDimensions() {
    if (!iframe) return;
    if (window.innerWidth <= 480) {
      iframe.style.width        = '100%';
      iframe.style.maxWidth     = '100%';
      iframe.style.height       = '100%';
      iframe.style.maxHeight    = '100vh';
      iframe.style.bottom       = '0';
      iframe.style.right        = '0';
      iframe.style.left         = '0';
      iframe.style.top          = '0';
      iframe.style.borderRadius = '0';
    } else {
      iframe.style.width        = '380px';
      iframe.style.maxWidth     = 'calc(100% - 40px)';
      iframe.style.height       = '600px';
      iframe.style.maxHeight    = '80vh';
      iframe.style.borderRadius = '12px';
      applyPosition(iframe, true);
    }
  }

  // ─── Resize handler ───────────────────────────────────────────────────────

  window.addEventListener('resize', () => {
    updateIframeDimensions();
    positionCloseButton();

    if (button) {
      const isMobile = window.innerWidth < 768;
      const size = isMobile ? config.widgetSizeMobile : config.widgetSize;
      button.style.width  = `${size}px`;
      button.style.height = `${size}px`;
    }
  });

  // ─── Open / close ─────────────────────────────────────────────────────────

  function toggleChat() {
    if (iframe.style.display === 'none') openChat();
    else closeChat();
  }

  function openChat() {
    updateIframeDimensions();
    iframe.style.display = 'block';

    if (closeBtn) {
      closeBtn.style.display = 'flex';
      requestAnimationFrame(positionCloseButton);
    }

    // Hide toggle button on full-screen mobile
    if (button && window.innerWidth <= 480) button.style.display = 'none';
  }

  function closeChat() {
    iframe.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
    if (button)   button.style.display   = 'flex';
  }

  // ─── Message listener (postMessage from iframe) ───────────────────────────

  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.data.chatbotId !== config.chatbotId) return;

      if (event.data.type === 'chatbot-close') {
        closeChat();
      }

      if (event.data.type === 'chatbot-resize') {
        if (event.data.width)  iframe.style.width  = event.data.width;
        if (event.data.height) iframe.style.height = event.data.height;
        positionCloseButton();
      }

      // Live theme updates broadcast from the admin panel
      if (event.data.type === 'theme-update' && event.data.theme) {
        const theme = event.data.theme;

        // Widget size
        if (button && (theme.widgetSize || theme.widgetSizeMobile)) {
          if (theme.widgetSize)       config.widgetSize       = theme.widgetSize;
          if (theme.widgetSizeMobile) config.widgetSizeMobile = theme.widgetSizeMobile;
          const isMobile = window.innerWidth < 768;
          const size = isMobile ? config.widgetSizeMobile : config.widgetSize;
          button.style.width  = `${size}px`;
          button.style.height = `${size}px`;
        }

        // Widget shape
        if (button && theme.widgetShape) {
          config.widgetShape = theme.widgetShape;
          const br = getButtonBorderRadius();
          button.style.borderRadius = br;
          // Also update img inside if present
          const img = button.querySelector('img');
          if (img) img.style.borderRadius = br;
        }

        // Toggle button background colour
        if (button && theme.widgetBgColor) {
          config.buttonColor = theme.widgetBgColor;
          button.style.backgroundColor = theme.widgetBgColor;
        }

        // Toggle button border/accent colour
        if (button && theme.widgetColor) {
          config.buttonBorderColor = theme.widgetColor;
          button.style.borderColor = theme.widgetColor;
        }

        // Close button colours
        if (closeBtn) {
          if (theme.closeButtonBgColor) {
            config.closeBtnBgColor = theme.closeButtonBgColor;
            closeBtn.style.backgroundColor = theme.closeButtonBgColor;
          }
          if (theme.closeButtonColor) {
            config.closeBtnColor = theme.closeButtonColor;
            closeBtn.style.color = theme.closeButtonColor;
          }
        }

        // Position
        if (theme.widgetPosition && button) {
          config.position = theme.widgetPosition
            .toLowerCase()
            .replace(/([A-Z])/g, '-$1')
            .toLowerCase();
          applyPosition(button, false);
          if (iframe) {
            applyPosition(iframe, true);
            positionCloseButton();
          }
        }
      }
    });
  }

  // ─── Command processor ────────────────────────────────────────────────────

  const processCommand = (args) => {
    const cmd    = args[0];
    const params = args[1];
    if (cmd === 'init')       init(params);
    else if (cmd === 'open')  openChat();
    else if (cmd === 'close') closeChat();
  };

  // Process any queued commands
  if (window.chatbot.q) {
    window.chatbot.q.forEach(processCommand);
  }

  // Replace queue with direct execution
  window.chatbot = function() {
    processCommand(arguments);
  };

  // Auto-init from data attributes on the <script> tag
  if (script) {
    const chatbotId = script.getAttribute('data-chatbot-id');
    if (chatbotId) {
      init({
        chatbotId,
        baseUrl:    script.getAttribute('data-base-url')    || defaultBaseUrl,
        showButton: script.getAttribute('data-show-button') !== 'false',
        autoOpen:   script.getAttribute('data-auto-open')   === 'true',
        position:   script.getAttribute('data-position')    || 'bottom-right',
      });
    }
  }

})();