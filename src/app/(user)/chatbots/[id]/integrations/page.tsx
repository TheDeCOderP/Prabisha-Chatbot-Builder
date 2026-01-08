// app/dashboard/chatbots/[chatbotId]/embed/page.tsx

'use client';

import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy,
  Check,
  Code,
  Link as LinkIcon,
  Settings,
  Eye,
  Globe,
  Download,
  Zap,
  Shield,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type TechStack = 'vanilla' | 'react' | 'nextjs' | 'vue' | 'angular' | 'wordpress' | 'shopify';

export default function EmbedPage() {
  const params = useParams();
  const chatbotId = params.id as string;
  
  const [chatbot, setChatbot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedStack, setSelectedStack] = useState<TechStack>('vanilla');
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
    { 
      id: 'vanilla', 
      label: 'JavaScript', 
      icon: (
        <svg viewBox="0 0 1052 1052" style={{ width: 24, height: 24 }}>
          <path fill="#f0db4f" d="M0 0h1052v1052H0z"/>
          <path d="M965.9 801.1c-7.7-48-39-88.3-131.7-125.9-32.2-14.8-68.1-25.399-78.8-49.8-3.8-14.2-4.3-22.2-1.9-30.8 6.9-27.9 40.2-36.6 66.6-28.6 17 5.7 33.1 18.801 42.8 39.7 45.4-29.399 45.3-29.2 77-49.399-11.6-18-17.8-26.301-25.4-34-27.3-30.5-64.5-46.2-124-45-10.3 1.3-20.699 2.699-31 4-29.699 7.5-58 23.1-74.6 44-49.8 56.5-35.6 155.399 25 196.1 59.7 44.8 147.4 55 158.6 96.9 10.9 51.3-37.699 67.899-86 62-35.6-7.4-55.399-25.5-76.8-58.4-39.399 22.8-39.399 22.8-79.899 46.1 9.6 21 19.699 30.5 35.8 48.7 76.2 77.3 266.899 73.5 301.1-43.5 1.399-4.001 10.6-30.801 3.199-72.101zm-394-317.6h-98.4c0 85-.399 169.4-.399 254.4 0 54.1 2.8 103.7-6 118.9-14.4 29.899-51.7 26.2-68.7 20.399-17.3-8.5-26.1-20.6-36.3-37.699-2.8-4.9-4.9-8.7-5.601-9-26.699 16.3-53.3 32.699-80 49 13.301 27.3 32.9 51 58 66.399 37.5 22.5 87.9 29.4 140.601 17.3 34.3-10 63.899-30.699 79.399-62.199 22.4-41.3 17.6-91.3 17.4-146.6.5-90.2 0-180.4 0-270.9z" fill="#323330"/>
        </svg>
      )
    },
    { 
      id: 'react', 
      label: 'React', 
      icon: (
        <svg viewBox="0 0 569 512" style={{ width: 24, height: 24 }}>
          <g fill="none" fillRule="evenodd">
            <g fill="#087EA4" fillRule="nonzero">
              <path d="M285.5,201 C255.400481,201 231,225.400481 231,255.5 C231,285.599519 255.400481,310 285.5,310 C315.599519,310 340,285.599519 340,255.5 C340,225.400481 315.599519,201 285.5,201" id="react_light__Path"/>
              <path d="M568.959856,255.99437 C568.959856,213.207656 529.337802,175.68144 466.251623,150.985214 C467.094645,145.423543 467.85738,139.922107 468.399323,134.521063 C474.621631,73.0415145 459.808523,28.6686204 426.709856,9.5541429 C389.677085,-11.8291748 337.36955,3.69129898 284.479928,46.0162134 C231.590306,3.69129898 179.282771,-11.8291748 142.25,9.5541429 C109.151333,28.6686204 94.3382249,73.0415145 100.560533,134.521063 C101.102476,139.922107 101.845139,145.443621 102.708233,151.02537 C97.4493791,153.033193 92.2908847,155.161486 87.3331099,157.39017 C31.0111824,182.708821 0,217.765415 0,255.99437 C0,298.781084 39.6220545,336.307301 102.708233,361.003527 C101.845139,366.565197 101.102476,372.066633 100.560533,377.467678 C94.3382249,438.947226 109.151333,483.32012 142.25,502.434597 C153.629683,508.887578 166.52439,512.186771 179.603923,511.991836 C210.956328,511.991836 247.567589,495.487529 284.479928,465.972527 C321.372196,495.487529 358.003528,511.991836 389.396077,511.991836 C402.475265,512.183856 415.36922,508.884856 426.75,502.434597 C459.848667,483.32012 474.661775,438.947226 468.439467,377.467678 C467.897524,372.066633 467.134789,366.565197 466.291767,361.003527 C529.377946,336.347457 569,298.761006 569,255.99437 M389.155214,27.1025182 C397.565154,26.899606 405.877839,28.9368502 413.241569,33.0055186 C436.223966,46.2772304 446.540955,82.2775015 441.522965,131.770345 C441.181741,135.143488 440.780302,138.556788 440.298575,141.990165 C414.066922,134.08804 387.205771,128.452154 360.010724,125.144528 C343.525021,103.224055 325.192524,82.7564475 305.214266,63.9661533 C336.586743,39.7116483 366.032313,27.1025182 389.135142,27.1025182 M378.356498,310.205598 C368.204912,327.830733 357.150626,344.919965 345.237759,361.405091 C325.045049,363.479997 304.758818,364.51205 284.459856,364.497299 C264.167589,364.51136 243.888075,363.479308 223.702025,361.405091 C211.820914,344.919381 200.80007,327.83006 190.683646,310.205598 C180.532593,292.629285 171.306974,274.534187 163.044553,255.99437 C171.306974,237.454554 180.532593,219.359455 190.683646,201.783142 C200.784121,184.229367 211.770999,167.201087 223.601665,150.764353 C243.824636,148.63809 264.145559,147.579168 284.479928,147.591877 C304.772146,147.579725 325.051559,148.611772 345.237759,150.68404 C357.109048,167.14607 368.136094,184.201112 378.27621,201.783142 C388.419418,219.363718 397.644825,237.458403 405.915303,255.99437 C397.644825,274.530337 388.419418,292.625022 378.27621,310.205598 M419.724813,290.127366 C426.09516,307.503536 431.324985,325.277083 435.380944,343.334682 C417.779633,348.823635 399.836793,353.149774 381.668372,356.285142 C388.573127,345.871232 395.263781,335.035679 401.740334,323.778483 C408.143291,312.655143 414.144807,301.431411 419.805101,290.207679 M246.363271,390.377981 C258.848032,391.140954 271.593728,391.582675 284.5,391.582675 C297.406272,391.582675 310.232256,391.140954 322.737089,390.377981 C310.880643,404.583418 298.10766,417.997563 284.5,430.534446 C270.921643,417.999548 258.18192,404.585125 246.363271,390.377981 Z M187.311556,356.244986 C169.137286,353.123646 151.187726,348.810918 133.578912,343.334682 C137.618549,325.305649 142.828222,307.559058 149.174827,290.207679 C154.754833,301.431411 160.736278,312.655143 167.239594,323.778483 C173.74291,334.901824 180.467017,345.864539 187.311556,356.285142 M149.174827,221.760984 C142.850954,204.473938 137.654787,186.794745 133.619056,168.834762 C151.18418,163.352378 169.085653,159.013101 187.211197,155.844146 C180.346585,166.224592 173.622478,176.986525 167.139234,188.210257 C160.65599,199.433989 154.734761,210.517173 149.074467,221.760984 M322.616657,121.590681 C310.131896,120.827708 297.3862,120.385987 284.379568,120.385987 C271.479987,120.385987 258.767744,120.787552 246.242839,121.590681 C258.061488,107.383537 270.801211,93.9691137 284.379568,81.4342157 C297.99241,93.9658277 310.765727,107.380324 322.616657,121.590681 Z M401.70019,188.210257 C395.196875,176.939676 388.472767,166.09743 381.527868,155.68352 C399.744224,158.819049 417.734224,163.151949 435.380944,168.654058 C431.331963,186.680673 426.122466,204.426664 419.785029,221.781062 C414.205023,210.55733 408.203506,199.333598 401.720262,188.230335 M127.517179,131.790423 C122.438973,82.3176579 132.816178,46.2973086 155.778503,33.0255968 C163.144699,28.9632474 171.455651,26.9264282 179.864858,27.1225964 C202.967687,27.1225964 232.413257,39.7317265 263.785734,63.9862316 C243.794133,82.7898734 225.448298,103.270812 208.949132,125.204763 C181.761691,128.528025 154.90355,134.14313 128.661281,141.990165 C128.199626,138.556788 127.778115,135.163566 127.456963,131.790423 M98.4529773,182.106474 C101.54406,180.767925 104.695358,179.429376 107.906872,178.090828 C114.220532,204.735668 122.781793,230.7969 133.498624,255.99437 C122.761529,281.241316 114.193296,307.357063 107.8868,334.058539 C56.7434387,313.076786 27.0971497,284.003505 27.0971497,255.99437 C27.0971497,229.450947 53.1907013,202.526037 98.4529773,182.106474 Z M155.778503,478.963143 C132.816178,465.691432 122.438973,429.671082 127.517179,380.198317 C127.838331,376.825174 128.259842,373.431953 128.721497,369.978497 C154.953686,377.878517 181.814655,383.514365 209.009348,386.824134 C225.500295,408.752719 243.832321,429.233234 263.805806,448.042665 C220.069,481.834331 180.105722,492.97775 155.838719,478.963143 M441.502893,380.198317 C446.520883,429.691161 436.203894,465.691432 413.221497,478.963143 C388.974566,493.017906 348.991216,481.834331 305.274481,448.042665 C325.241364,429.232737 343.566681,408.752215 360.050868,386.824134 C387.245915,383.516508 414.107066,377.880622 440.338719,369.978497 C440.820446,373.431953 441.221885,376.825174 441.563109,380.198317 M461.193488,334.018382 C454.869166,307.332523 446.294494,281.231049 435.561592,255.99437 C446.289797,230.744081 454.857778,204.629101 461.173416,177.930202 C512.216417,198.911955 541.942994,227.985236 541.942994,255.99437 C541.942994,284.003505 512.296705,313.076786 461.153344,334.058539" id="react_light__Shape"/>
            </g>
          </g>
        </svg>
      )
    },
    { 
      id: 'nextjs', 
      label: 'Next.js', 
      icon: (
        <svg viewBox="0 0 180 180" style={{ width: 24, height: 24 }}>
          <mask 
            height="180" 
            id="nextjs-icon-mask" 
            maskUnits="userSpaceOnUse" 
            width="180" 
            x="0" 
            y="0"
            style={{ maskType: 'alpha' }}
          >
            <circle cx="90" cy="90" fill="black" r="90"/>
          </mask>
          <g mask="url(#nextjs-icon-mask)">
            <circle cx="90" cy="90" fill="black" r="90"/>
            <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#nextjs-gradient-1)"/>
            <rect fill="url(#nextjs-gradient-2)" height="72" width="12" x="115" y="54"/>
          </g>
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" id="nextjs-gradient-1" x1="109" x2="144.5" y1="116.5" y2="160.5">
              <stop stopColor="white"/>
              <stop offset="1" stopColor="white" stopOpacity="0"/>
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" id="nextjs-gradient-2" x1="121" x2="120.799" y1="54" y2="106.875">
              <stop stopColor="white"/>
              <stop offset="1" stopColor="white" stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
      )
    },
  { id: 'vue', label: 'Vue.js', icon: '💚' },
  { id: 'angular', label: 'Angular', icon: '🅰️' },
  { id: 'wordpress', label: 'WordPress', icon: '📝' },
  { id: 'shopify', label: 'Shopify', icon: '🛍️' },
];

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Embed Chatbot</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Preview & Settings */}
          <div className="lg:col-span-2 space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="position">Position</Label>
                    <Select
                      value={customizations.position}
                      onValueChange={(value) => setCustomizations(prev => ({ 
                        ...prev, 
                        position: value as any 
                      }))}
                    >
                      <SelectTrigger id="position">
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="buttonSize">Button Size</Label>
                    <Select
                      value={customizations.buttonSize}
                      onValueChange={(value) => setCustomizations(prev => ({ 
                        ...prev, 
                        buttonSize: value as any 
                      }))}
                    >
                      <SelectTrigger id="buttonSize">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="buttonColor">Button Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="buttonColor"
                        type="color"
                        value={customizations.buttonColor}
                        onChange={(e) => setCustomizations(prev => ({ 
                          ...prev, 
                          buttonColor: e.target.value 
                        }))}
                        className="w-12 h-12 p-1 cursor-pointer"
                      />
                      <Input
                        value={customizations.buttonColor}
                        onChange={(e) => setCustomizations(prev => ({ 
                          ...prev, 
                          buttonColor: e.target.value 
                        }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="buttonTextColor">Text Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="buttonTextColor"
                        type="color"
                        value={customizations.buttonTextColor}
                        onChange={(e) => setCustomizations(prev => ({ 
                          ...prev, 
                          buttonTextColor: e.target.value 
                        }))}
                        className="w-12 h-12 p-1 cursor-pointer"
                      />
                      <Input
                        value={customizations.buttonTextColor}
                        onChange={(e) => setCustomizations(prev => ({ 
                          ...prev, 
                          buttonTextColor: e.target.value 
                        }))}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showButton">Show chat button</Label>
                      <p className="text-sm text-muted-foreground">
                        Display the chat button on your website
                      </p>
                    </div>
                    <Switch
                      id="showButton"
                      checked={customizations.showButton}
                      onCheckedChange={(checked) => setCustomizations(prev => ({ 
                        ...prev, 
                        showButton: checked 
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoOpen">Auto-open on page load</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically open chat when page loads
                      </p>
                    </div>
                    <Switch
                      id="autoOpen"
                      checked={customizations.autoOpen}
                      onCheckedChange={(checked) => setCustomizations(prev => ({ 
                        ...prev, 
                        autoOpen: checked 
                      }))}
                    />
                  </div>
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
                <div className="relative border rounded-lg p-6 bg-gradient-to-br from-background to-muted min-h-[300px] md:min-h-[400px] flex items-center justify-center">
                  {customizations.showButton && (
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
                  )}
                  
                  <div className="text-center text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm md:text-base">Website Preview Area</p>
                    <p className="text-xs md:text-sm">Your chatbot button will appear here</p>
                    {!customizations.showButton && (
                      <p className="text-xs text-destructive mt-2">
                        Chat button is hidden (toggle "Show chat button" above)
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Embed Code */}
          <div className="space-y-6 h-full">
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
                
                <div className="space-y-3">
                  <Label htmlFor="scriptUrl">Direct Script URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="scriptUrl"
                      value={embedUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
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
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Copy script URL</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={downloadScript}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download as file</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}