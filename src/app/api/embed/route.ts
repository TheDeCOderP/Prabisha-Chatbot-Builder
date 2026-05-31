// app/api/embed/route.ts
export async function GET() {
  const script = `
(function() {
  // Prevent loading if already inside an iframe to avoid recursion
  if (window.self !== window.top) return;

  // Create global chatbot queue
  window.chatbotQueue = window.chatbotQueue || [];
  
  // Main chatbot function
  window.chatbot = function() {
    chatbotQueue.push(Array.prototype.slice.call(arguments));
  };
  
  // Load chatbot widget
  function loadChatbotWidget(config) {
    if (document.getElementById('chatbot-widget-' + config.chatbotId)) {
      return; // Already loaded
    }
    
    // Create container
    const container = document.createElement('div');
    container.id = 'chatbot-widget-' + config.chatbotId;
    container.className = 'chatbot-container';
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'chatbot-iframe-' + config.chatbotId;
    iframe.src = \`${process.env.NEXT_PUBLIC_APP_URL}/embed/widget/\${config.chatbotId}\`;
    // grant features to the embedded chatbot frame; wildcards are not supported so list explicitly
    const permissions = "microphone; camera; autoplay; clipboard-write; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; midi; payment; picture-in-picture; speaker-selection; usb; web-share";
    iframe.allow = permissions;
    iframe.setAttribute('allow', permissions);    
    // Initial styles
    iframe.style.cssText = \`
      border: none;
      position: fixed;
      z-index: 999999;
      transition: all 0.3s ease;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      border-radius: 12px;
      overflow: hidden;
      background: white;
      max-width: 100vw;
      max-height: 100vh;
    \`;
    
    // Add to document
    container.appendChild(iframe);
    document.body.appendChild(container);
    
    // Apply position based on config
    applyPosition(iframe, config);
    
    // Create launcher button if enabled
    if (config.showButton !== false) {
      createLauncherButton(config);
    }
    
    // Auto-open if configured
    if (config.autoOpen) {
      setTimeout(() => {
        openChatbot(iframe, config);
      }, config.delay || 1000);
    }
    
    // Handle messages from iframe
    window.addEventListener('message', function(event) {
      if (event.data.chatbotId !== config.chatbotId) return;

      if (event.data.type === 'chatbot-close') {
        closeChatbot(iframe, config);

      } else if (event.data.type === 'chatbot-resize') {
        resizeChatbot(iframe, event.data);

      } else if (event.data.type === 'chatbot-theme') {
        // Widget has loaded and sent us its DB theme — apply sizing, position, launcher
        applyThemeFromDB(iframe, config, event.data.theme);
      }
    });
  }

  function applyThemeFromDB(iframe, config, theme) {
    var isMobile = window.innerWidth < 480;
    if (isMobile) return; // mobile is always full-screen, nothing to adjust

    var w  = (theme.windowWidth  || 420) + 'px';
    var h  = (theme.windowHeight || 600) + 'px';
    var br = (theme.windowBorderRadius != null ? theme.windowBorderRadius : 16) + 'px';

    // If chat is already open, resize immediately
    if (iframe.style.display === 'block') {
      iframe.style.width        = w;
      iframe.style.height       = h;
      iframe.style.borderRadius = br;
    }

    // Store on config so openChatbot picks them up on next open
    config._dbWidth  = w;
    config._dbHeight = h;
    config._dbBorderRadius = br;
    config._dbTheme  = theme;

    // Reposition launcher button based on DB theme
    var launcher = document.getElementById('chatbot-launcher-' + config.chatbotId);
    if (launcher) {
      applyPositionFromTheme(launcher, theme);
    }

    // Reposition iframe (closed state stays hidden, but update its fixed coords)
    applyPositionFromTheme(iframe, theme);

    // Auto-open if popup_onload was set in DB
    if (theme.popup_onload && iframe.style.display !== 'block') {
      openChatbot(iframe, config);
    }
  }

  function applyPositionFromTheme(el, theme) {
    // Reset all sides first
    el.style.top    = '';
    el.style.bottom = '';
    el.style.left   = '';
    el.style.right  = '';

    var margin = (theme.widgetMargin != null ? theme.widgetMargin : 20) + 'px';

    if (theme.widgetCustomPosition) {
      if (theme.widgetTop    != null) el.style.top    = theme.widgetTop    + 'px';
      if (theme.widgetBottom != null) el.style.bottom = theme.widgetBottom + 'px';
      if (theme.widgetLeft   != null) el.style.left   = theme.widgetLeft   + 'px';
      if (theme.widgetRight  != null) el.style.right  = theme.widgetRight  + 'px';
    } else {
      var pos = (theme.widgetPosition || 'BottomRight').toLowerCase();
      if (pos.includes('bottom')) el.style.bottom = margin; else el.style.top = margin;
      if (pos.includes('right'))  el.style.right  = margin; else el.style.left = margin;
    }
  }
  
  function createLauncherButton(config) {
    const buttonId = 'chatbot-launcher-' + config.chatbotId;
    if (document.getElementById(buttonId)) return;
    
    const button = document.createElement('button');
    button.id = buttonId;
    button.className = 'chatbot-launcher';
    button.innerHTML = '💬';
    button.style.cssText = \`
      position: fixed;
      z-index: 999998;
      width: \${getButtonSize(config.buttonSize)};
      height: \${getButtonSize(config.buttonSize)};
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background-color: \${config.buttonColor || '#3b82f6'};
      color: \${config.buttonTextColor || '#ffffff'};
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    \`;
    
    // Apply position
    applyButtonPosition(button, config);
    
    // Add click handler
    button.addEventListener('click', function() {
      const iframe = document.getElementById('chatbot-iframe-' + config.chatbotId);
      if (iframe.style.display === 'none' || iframe.style.display === '') {
        openChatbot(iframe, config);
      } else {
        closeChatbot(iframe, config);
      }
    });
    
    // Add hover effects
    button.addEventListener('mouseenter', function() {
      button.style.transform = 'scale(1.1)';
    });
    
    button.addEventListener('mouseleave', function() {
      button.style.transform = 'scale(1)';
    });
    
    document.body.appendChild(button);
  }
  
  function getButtonSize(size) {
    switch(size) {
      case 'small': return '50px';
      case 'large': return '70px';
      default: return '60px';
    }
  }
  
  function applyButtonPosition(button, config) {
    const position = config.position || 'bottom-right';
    const margin = '20px';
    
    switch(position) {
      case 'bottom-right':
        button.style.bottom = margin;
        button.style.right = margin;
        break;
      case 'bottom-left':
        button.style.bottom = margin;
        button.style.left = margin;
        break;
      case 'top-right':
        button.style.top = margin;
        button.style.right = margin;
        break;
      case 'top-left':
        button.style.top = margin;
        button.style.left = margin;
        break;
    }
  }
  
  function applyPosition(iframe, config) {
    const position = config.position || 'bottom-right';
    const margin = '20px';
    
    // Reset all positions first
    iframe.style.top = '';
    iframe.style.bottom = '';
    iframe.style.left = '';
    iframe.style.right = '';

    switch(position) {
      case 'bottom-right':
        iframe.style.bottom = margin;
        iframe.style.right = margin;
        break;
      case 'bottom-left':
        iframe.style.bottom = margin;
        iframe.style.left = margin;
        break;
      case 'top-right':
        iframe.style.top = margin;
        iframe.style.right = margin;
        break;
      case 'top-left':
        iframe.style.top = margin;
        iframe.style.left = margin;
        break;
    }
  }
  
  // Handles mobile full-screen and DB-driven sizing/positioning
  function openChatbot(iframe, config) {
    var isMobile = window.innerWidth < 480;

    iframe.style.display = 'block';

    if (isMobile) {
      iframe.style.width        = '100%';
      iframe.style.height       = '100%';
      iframe.style.top          = '0';
      iframe.style.left         = '0';
      iframe.style.right        = '0';
      iframe.style.bottom       = '0';
      iframe.style.borderRadius = '0';
    } else {
      // Prefer DB-derived values if available, fall back to init config
      iframe.style.width        = config._dbWidth  || config.width  || '420px';
      iframe.style.height       = config._dbHeight || config.height || '600px';
      iframe.style.borderRadius = config._dbBorderRadius || '16px';

      if (config._dbTheme) {
        applyPositionFromTheme(iframe, config._dbTheme);
      } else {
        applyPosition(iframe, config);
      }
    }

    iframe.style.opacity   = '1';
    iframe.style.transform = 'translateY(0)';

    var button = document.getElementById('chatbot-launcher-' + config.chatbotId);
    if (button) button.style.display = 'none';
  }
  
  function closeChatbot(iframe, config) {
    iframe.style.display = 'none';
    
    // Show launcher button when closed
    const button = document.getElementById('chatbot-launcher-' + config.chatbotId);
    if (button) {
      button.style.display = 'flex';
    }
  }
  
  function resizeChatbot(iframe, data) {
    // Only allow resize on desktop
    if (window.innerWidth >= 480) {
        if (data.width) iframe.style.width = data.width;
        if (data.height) iframe.style.height = data.height;
    }
  }
  
  // Process initialization calls
  chatbot.init = function(config) {
    loadChatbotWidget(config);
  };
  
  // Process any queued calls
  while (chatbotQueue.length) {
    const args = chatbotQueue.shift();
    const method = args.shift();
    
    if (method === 'init') {
      chatbot.init(args[0]);
    }
  }
  
  // Auto-initialize if config is in data attributes
  document.addEventListener('DOMContentLoaded', function() {
    const elements = document.querySelectorAll('[data-chatbot-id]');
    elements.forEach(function(el) {
      const chatbotId = el.getAttribute('data-chatbot-id');
      const config = {
        chatbotId: chatbotId,
        showButton: el.getAttribute('data-show-button') !== 'false',
        autoOpen: el.getAttribute('data-auto-open') === 'true',
        delay: parseInt(el.getAttribute('data-delay') || '1000'),
        position: el.getAttribute('data-position') || 'bottom-right',
        buttonColor: el.getAttribute('data-button-color') || '#3b82f6',
        buttonTextColor: el.getAttribute('data-button-text-color') || '#ffffff',
        buttonSize: el.getAttribute('data-button-size') || 'medium'
      };
      
      loadChatbotWidget(config);
    });
  });
})();
  `.trim();

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}