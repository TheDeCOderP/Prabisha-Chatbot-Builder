// app/dashboard/chatbots/[chatbotId]/embed/page.tsx

'use client';

import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Copy,
  Check,
  Code,
  Link as LinkIcon,
  Settings,
  Eye,
  EyeOff,
  Globe,
  Smartphone,
  Tablet,
  Monitor,
  Download,
  Share2,
  Zap,
  Lock,
  Shield
} from 'lucide-react';

type TechStack = 'vanilla' | 'react' | 'nextjs' | 'vue' | 'angular' | 'wordpress' | 'shopify';

export default function EmbedPage() {
  const params = useParams();
  const router = useRouter();
  const chatbotId = params.chatbotId as string;
  
  const [chatbot, setChatbot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedStack, setSelectedStack] = useState<TechStack>('vanilla');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customizations, setCustomizations] = useState({
    showButton: true,
    autoOpen: false,
    delay: 1000,
    position: 'bottom-right' as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
    buttonColor: '#3b82f6',
    buttonTextColor: '#ffffff',
    buttonSize: 'medium' as 'small' | 'medium' | 'large'
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchChatbot();
  }, [chatbotId]);

  async function fetchChatbot() {
    try {
      setLoading(true);
      const response = await fetch(`/api/chatbots/${chatbotId}`);
      if (!response.ok) throw new Error('Failed to fetch chatbot');
      const data = await response.json();
      setChatbot(data);
      
      if (data) {
        setCustomizations(prev => ({
          ...prev,
          autoOpen: data.popup_onload || false,
          buttonColor: data.iconBgColor || '#3b82f6',
          buttonTextColor: data.iconColor || '#ffffff'
        }));
      }
    } catch (error) {
      toast.error('Error loading chatbot data');
    } finally {
      setLoading(false);
    }
  }

  // Generate embed code based on tech stack
  function generateEmbedCode(stack: TechStack) {
    const { showButton, autoOpen, delay, position, buttonColor, buttonTextColor, buttonSize } = customizations;
    
    const configObject = `{
  chatbotId: '${chatbotId}',
  baseUrl: '${baseUrl}',
  showButton: ${showButton},
  autoOpen: ${autoOpen},
  delay: ${delay},
  position: '${position}',
  buttonColor: '${buttonColor}',
  buttonTextColor: '${buttonTextColor}',
  buttonSize: '${buttonSize}'
}`;

    switch (stack) {
      case 'vanilla':
        return `<!-- Add this script before closing </body> tag -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','chatbot','${baseUrl}/embed.js'));
  
  chatbot('init', ${configObject});
</script>`;

      case 'react':
        return `// Install: npm install @your-company/chatbot-react
// Or use the hook below

import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Load chatbot script
    const script = document.createElement('script');
    script.src = '${baseUrl}/embed.js';
    script.async = true;
    
    script.onload = () => {
      if (window.chatbot) {
        window.chatbot('init', ${configObject});
      }
    };
    
    document.body.appendChild(script);
    
    return () => {
      // Cleanup
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="App">
      {/* Your app content */}
    </div>
  );
}

export default App;`;

      case 'nextjs':
        return `// app/layout.tsx or pages/_app.tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        
        <Script
          id="chatbot-script"
          strategy="lazyOnload"
          src="${baseUrl}/embed.js"
          onLoad={() => {
            window.chatbot('init', ${configObject});
          }}
        />
      </body>
    </html>
  );
}

// Alternative: Create a component
// components/Chatbot.tsx
'use client';

import { useEffect } from 'react';

export default function Chatbot() {
  useEffect(() => {
    if (window.chatbot) {
      window.chatbot('init', ${configObject});
    }
  }, []);

  return null;
}`;

      case 'vue':
        return `<!-- Add to your main App.vue or layout -->
<template>
  <div id="app">
    <!-- Your app content -->
  </div>
</template>

<script>
export default {
  name: 'App',
  mounted() {
    this.loadChatbot();
  },
  methods: {
    loadChatbot() {
      const script = document.createElement('script');
      script.src = '${baseUrl}/embed.js';
      script.async = true;
      
      script.onload = () => {
        if (window.chatbot) {
          window.chatbot('init', ${configObject});
        }
      };
      
      document.body.appendChild(script);
    }
  },
  beforeUnmount() {
    // Cleanup if needed
  }
}
</script>`;

      case 'angular':
        return `// app.component.ts
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  ngOnInit() {
    this.loadChatbot();
  }

  loadChatbot() {
    const script = document.createElement('script');
    script.src = '${baseUrl}/embed.js';
    script.async = true;
    
    script.onload = () => {
      if ((window as any).chatbot) {
        (window as any).chatbot('init', ${configObject});
      }
    };
    
    document.body.appendChild(script);
  }
}

// Or create a service
// chatbot.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  loadChatbot() {
    const script = document.createElement('script');
    script.src = '${baseUrl}/embed.js';
    script.async = true;
    
    script.onload = () => {
      if ((window as any).chatbot) {
        (window as any).chatbot('init', ${configObject});
      }
    };
    
    document.body.appendChild(script);
  }
}`;

      case 'wordpress':
        return `<!-- Method 1: Add to theme's footer.php before </body> -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','chatbot','${baseUrl}/embed.js'));
  
  chatbot('init', ${configObject});
</script>

<!-- Method 2: Add to functions.php -->
<?php
function add_chatbot_script() {
    ?>
    <script>
      (function(w,d,s,o,f,js,fjs){
        w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
        js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
        js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
      }(window,document,'script','chatbot','${baseUrl}/embed.js'));
      
      chatbot('init', ${configObject});
    </script>
    <?php
}
add_action('wp_footer', 'add_chatbot_script');
?>`;

      case 'shopify':
        return `<!-- Add to theme.liquid before </body> tag -->
<!-- Go to: Online Store > Themes > Actions > Edit code > Layout > theme.liquid -->

<script>
  (function(w,d,s,o,f,js,fjs){
    w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','chatbot','${baseUrl}/embed.js'));
  
  chatbot('init', ${configObject});
</script>

<!-- Or use Shopify's Script Tag API -->
<!-- Settings > Apps and sales channels > Develop apps > Create an app -->
<!-- Add Script Tag with src: ${baseUrl}/embed.js -->`;

      default:
        return '';
    }
  }

  const embedUrl = `${baseUrl}/embed.js`;

  function copyToClipboard() {
    const code = generateEmbedCode(selectedStack);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      toast.success('Embed code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadScript() {
    const code = generateEmbedCode(selectedStack);
    const extension = selectedStack === 'react' || selectedStack === 'nextjs' ? 'tsx' : 
                     selectedStack === 'vue' ? 'vue' : 
                     selectedStack === 'angular' ? 'ts' : 
                     selectedStack === 'wordpress' ? 'php' : 'js';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-${chatbotId}-${selectedStack}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Embed code downloaded');
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="space-y-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const embedCode = generateEmbedCode(selectedStack);

  const techStacks = [
    { id: 'vanilla', label: 'HTML/JavaScript', icon: '🌐' },
    { id: 'react', label: 'React', icon: '⚛️' },
    { id: 'nextjs', label: 'Next.js', icon: '▲' },
    { id: 'vue', label: 'Vue.js', icon: '💚' },
    { id: 'angular', label: 'Angular', icon: '🅰️' },
    { id: 'wordpress', label: 'WordPress', icon: '📝' },
    { id: 'shopify', label: 'Shopify', icon: '🛍️' },
  ];

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Embed Chatbot</h1>
              <p className="text-muted-foreground">
                Add your chatbot to any website with a simple script
              </p>
            </div>
            <Badge variant={chatbot?.isActive ? "default" : "secondary"}>
              {chatbot?.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <Separator />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Preview & Settings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Customization Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Customization Options
                </CardTitle>
                <CardDescription>
                  Configure how your chatbot appears and behaves
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <select
                      value={customizations.position}
                      onChange={(e) => setCustomizations(prev => ({ ...prev, position: e.target.value as any }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Button Size</Label>
                    <select
                      value={customizations.buttonSize}
                      onChange={(e) => setCustomizations(prev => ({ ...prev, buttonSize: e.target.value as any }))}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Button Color</Label>
                    <Input
                      type="color"
                      value={customizations.buttonColor}
                      onChange={(e) => setCustomizations(prev => ({ ...prev, buttonColor: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Text Color</Label>
                    <Input
                      type="color"
                      value={customizations.buttonTextColor}
                      onChange={(e) => setCustomizations(prev => ({ ...prev, buttonTextColor: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customizations.showButton}
                      onChange={(e) => setCustomizations(prev => ({ ...prev, showButton: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Show chat button</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customizations.autoOpen}
                      onChange={(e) => setCustomizations(prev => ({ ...prev, autoOpen: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Auto-open on page load</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Preview Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview
                </CardTitle>
                <CardDescription>
                  See how your chatbot will appear on your website
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative border rounded-lg p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-[400px] flex items-center justify-center">
                  {/* Chatbot Button Preview */}
                  <div
                    className={`absolute ${
                      customizations.position === 'bottom-right' ? 'bottom-4 right-4' :
                      customizations.position === 'bottom-left' ? 'bottom-4 left-4' :
                      customizations.position === 'top-right' ? 'top-4 right-4' : 'top-4 left-4'
                    }`}
                  >
                    <div
                      className="rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                      style={{
                        backgroundColor: customizations.buttonColor,
                        color: customizations.buttonTextColor,
                        width: customizations.buttonSize === 'small' ? '50px' :
                              customizations.buttonSize === 'medium' ? '60px' : '70px',
                        height: customizations.buttonSize === 'small' ? '50px' :
                               customizations.buttonSize === 'medium' ? '60px' : '70px'
                      }}
                    >
                      <div className="text-xl">💬</div>
                    </div>
                  </div>
                  
                  <div className="text-center text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Website Preview Area</p>
                    <p className="text-sm">Your chatbot button will appear here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Embed Code */}
          <div className="space-y-8">
            {/* Tech Stack Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Select Your Tech Stack
                </CardTitle>
                <CardDescription>
                  Choose your framework or platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {techStacks.map((stack) => (
                    <Button
                      key={stack.id}
                      variant={selectedStack === stack.id ? 'default' : 'outline'}
                      className="justify-start gap-2 h-auto py-3"
                      onClick={() => setSelectedStack(stack.id as TechStack)}
                    >
                      <span className="text-lg">{stack.icon}</span>
                      <span className="text-sm">{stack.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Embed Code Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  {techStacks.find(s => s.id === selectedStack)?.label} Code
                </CardTitle>
                <CardDescription>
                  Copy and paste this code into your project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs max-h-[400px]">
                      <code>{embedCode}</code>
                    </pre>
                    <Button
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={copyToClipboard}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label className="text-xs">Direct Script URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={embedUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(embedUrl);
                        toast.success('Script URL copied');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <div className="flex gap-2 w-full">
                  <Button onClick={copyToClipboard} className="flex-1 gap-2">
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Code
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={downloadScript} className="gap-2">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Quick Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4" />
                  Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>• Place the script before the closing {'</body>'} tag</p>
                <p>• The script loads asynchronously and won't block page rendering</p>
                <p>• Test in different browsers and devices</p>
                <p>• Check your chatbot status is set to Active</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}