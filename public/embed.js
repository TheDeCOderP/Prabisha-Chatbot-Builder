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
    buttonColor: '#3b82f6',
    buttonTextColor: '#ffffff',
    buttonSize: 'medium'
  };

  let config = { ...defaults };
  let iframe = null;
  let button = null;
  let isInitialized = false;

  async function init(userConfig) {
    if (isInitialized) return;
    
    config = { ...defaults, ...userConfig };
    if (!config.chatbotId) {
      console.error('Chatbot ID is required');
      return;
    }

    // Fetch dynamic config from database to allow updates without code changes
    try {
      const response = await fetch(`${config.baseUrl}/api/chatbots/${config.chatbotId}`);
      if (response.ok) {
        const dbConfig = await response.json();
        // Update config with database values if they exist
        config.buttonColor = dbConfig.iconBgColor || config.buttonColor;
        config.buttonTextColor = dbConfig.iconColor || config.buttonTextColor;
        config.iconUrl = dbConfig.icon;
        config.iconShape = dbConfig.iconShape;
        config.iconSize = dbConfig.iconSize;
        config.iconBorder = dbConfig.iconBorder;
        
        // Store widget sizes for responsive behavior
        if (dbConfig.theme) {
          config.widgetSize = dbConfig.theme.widgetSize || 70;
          config.widgetSizeMobile = dbConfig.theme.widgetSizeMobile || 60;
        }
        
        if (dbConfig.popup_onload !== undefined && userConfig.autoOpen === undefined) {
          config.autoOpen = dbConfig.popup_onload;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch chatbot config, using local settings');
    }

    createIframe();
    if (config.showButton) {
      createButton();
    }

    if (config.autoOpen) {
      setTimeout(openChat, config.delay);
    }

    setupMessageListener();
    isInitialized = true;
  }

  function createIframe() {
    iframe = document.createElement('iframe');
    const chatbotUrl = `${config.baseUrl}/embed/widget/${config.chatbotId}`;
    iframe.allow = "microphone";
    iframe.src = chatbotUrl;
    iframe.style.cssText = `
      position: fixed;
      z-index: 999999;
      bottom: 90px;
      right: 20px;
      width: 280px;
      max-width: calc(100% - 40px);
      height: 600px;
      max-height: 80vh;
      border: none;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      display: none;
      transition: all 0.3s ease;
      background: white;
    `;

    updateIframeDimensions();
    document.body.appendChild(iframe);
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
      `;
      
      const shape = (config.iconShape || '').toUpperCase();
      if (shape === 'ROUND') img.style.borderRadius = '50%';
      else if (shape === 'ROUNDED_SQUARE' || shape === 'SQUARE') img.style.borderRadius = '12px';
      
      const border = (config.iconBorder || '').toUpperCase();
      if (border === 'ROUND') img.style.border = '2px solid currentColor';
      else if (border === 'ROUNDED_FLAT') img.style.border = '1px solid rgba(255,255,255,0.3)';
      
      iconContainer.appendChild(img);
    } else {
      iconContainer.innerHTML = '💬';
    }
    button.appendChild(iconContainer);

    // Use responsive size based on screen width
    const isMobile = window.innerWidth < 768;
    const buttonSize = isMobile && config.widgetSizeMobile ? config.widgetSizeMobile : (config.widgetSize || 70);

    button.style.cssText = `
      position: fixed;
      z-index: 999999;
      bottom: 20px;
      right: 20px;
      width: ${buttonSize}px;
      height: ${buttonSize}px;
      border-radius: 50%;
      background-color: ${config.buttonColor};
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

  function applyPosition(el, isIframe) {
    const pos = config.position;
    const margin = '20px';
    const iframeMargin = '90px';
    
    el.style.bottom = 'auto';
    el.style.top = 'auto';
    el.style.left = 'auto';
    el.style.right = 'auto';

    const offset = isIframe ? iframeMargin : margin;

    if (pos.includes('bottom')) el.style.bottom = offset;
    if (pos.includes('top')) el.style.top = offset;
    if (pos.includes('right')) el.style.right = margin;
    if (pos.includes('left')) el.style.left = margin;
  }

  function updateIframeDimensions() {
    if (!iframe) return;
    if (window.innerWidth <= 480) {
      iframe.style.width = '100%';
      iframe.style.maxWidth = '100%';
      iframe.style.height = '100%';
      iframe.style.maxHeight = '100vh';
      iframe.style.bottom = '0';
      iframe.style.right = '0';
      iframe.style.left = '0';
      iframe.style.top = '0';
      iframe.style.borderRadius = '0';
    } else {
      iframe.style.width = '380px';
      iframe.style.maxWidth = 'calc(100% - 40px)';
      iframe.style.height = '600px';
      iframe.style.maxHeight = '80vh';
      iframe.style.borderRadius = '12px';
      applyPosition(iframe, true);
    }
  }

  window.addEventListener('resize', updateIframeDimensions);
  
  // Also update button size on resize if mobile size is different
  window.addEventListener('resize', () => {
    if (button && config.widgetSize && config.widgetSizeMobile) {
      const isMobile = window.innerWidth < 768;
      const size = isMobile ? config.widgetSizeMobile : config.widgetSize;
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
    }
  });

  function getButtonSize() {
    switch(config.buttonSize) {
      case 'small': return '50px';
      case 'large': return '80px';
      default: return '70px';
    }
  }

  function toggleChat() {
    if (iframe.style.display === 'none') {
      openChat();
    } else {
      closeChat();
    }
  }

  function openChat() {
    updateIframeDimensions();
    iframe.style.display = 'block';
    
    // Logic to hide the button on mobile when chat is open
    const isMobile = window.innerWidth <= 480;
    if (button && isMobile) {
      button.style.display = 'none';
    }
  }

  function closeChat() {
    iframe.style.display = 'none';
    
    // Always show the button again when the chat is closed
    if (button) {
      button.style.display = 'flex';
    }
  }

  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.data.chatbotId !== config.chatbotId) return;

      if (event.data.type === 'chatbot-close') {
        closeChat();
      }
      if (event.data.type === 'chatbot-resize') {
        if (event.data.width) iframe.style.width = event.data.width;
        if (event.data.height) iframe.style.height = event.data.height;
      }
      // Listen for theme updates from admin panel
      if (event.data.type === 'theme-update' && event.data.theme) {
        const theme = event.data.theme;
        
        // Update button size if changed
        if (theme.widgetSize && button) {
          const isMobile = window.innerWidth < 768;
          const size = isMobile && theme.widgetSizeMobile ? theme.widgetSizeMobile : theme.widgetSize;
          button.style.width = `${size}px`;
          button.style.height = `${size}px`;
        }
        
        // Update button color if changed
        if (theme.widgetColor && button) {
          button.style.backgroundColor = theme.widgetColor;
        }
        
        // Update button position if changed
        if (theme.widgetPosition && button) {
          config.position = theme.widgetPosition.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase();
          applyPosition(button, false);
          if (iframe) applyPosition(iframe, true);
        }
      }
    });
  }

  // Handle API commands
  const processCommand = (args) => {
    const cmd = args[0];
    const params = args[1];
    if (cmd === 'init') {
      init(params);
    } else if (cmd === 'open') {
      openChat();
    } else if (cmd === 'close') {
      closeChat();
    }
  };

  // Process queue
  if (window.chatbot.q) {
    window.chatbot.q.forEach(processCommand);
  }

  // Override queue with direct execution
  window.chatbot = function() {
    processCommand(arguments);
  };

  // Auto-init from data attributes
  if (script) {
    const chatbotId = script.getAttribute('data-chatbot-id');
    if (chatbotId) {
      init({
        chatbotId,
        baseUrl: script.getAttribute('data-base-url') || defaultBaseUrl,
        showButton: script.getAttribute('data-show-button') !== 'false',
        autoOpen: script.getAttribute('data-auto-open') === 'true',
        position: script.getAttribute('data-position') || 'bottom-right'
      });
    }
  }

})();
