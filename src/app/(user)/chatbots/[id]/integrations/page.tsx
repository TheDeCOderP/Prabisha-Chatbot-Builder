'use client';

import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Copy, Check, Download, Loader2 } from 'lucide-react';
import { useChatbot } from '@/hooks/useChatbot';

// ─── Types ────────────────────────────────────────────────────────────────────

type TechStack =
  | 'vanilla'
  | 'react'
  | 'nextjs'
  | 'vue'
  | 'angular'
  | 'wordpress'
  | 'shopify';

interface StackMeta {
  id: TechStack;
  label: string;
  ext: string; // download file extension
  icon: React.ReactNode;
}

// ─── Stack icons (unchanged from original) ───────────────────────────────────

const TECH_STACKS: StackMeta[] = [
  {
    id: 'vanilla',
    label: 'JavaScript',
    ext: 'js',
    icon: (
      <svg viewBox="0 0 1052 1052" className="w-5 h-5 shrink-0">
        <path fill="#f0db4f" d="M0 0h1052v1052H0z" />
        <path d="M965.9 801.1c-7.7-48-39-88.3-131.7-125.9-32.2-14.8-68.1-25.399-78.8-49.8-3.8-14.2-4.3-22.2-1.9-30.8 6.9-27.9 40.2-36.6 66.6-28.6 17 5.7 33.1 18.801 42.8 39.7 45.4-29.399 45.3-29.2 77-49.399-11.6-18-17.8-26.301-25.4-34-27.3-30.5-64.5-46.2-124-45-10.3 1.3-20.699 2.699-31 4-29.699 7.5-58 23.1-74.6 44-49.8 56.5-35.6 155.399 25 196.1 59.7 44.8 147.4 55 158.6 96.9 10.9 51.3-37.699 67.899-86 62-35.6-7.4-55.399-25.5-76.8-58.4-39.399 22.8-39.399 22.8-79.899 46.1 9.6 21 19.699 30.5 35.8 48.7 76.2 77.3 266.899 73.5 301.1-43.5 1.399-4.001 10.6-30.801 3.199-72.101zm-394-317.6h-98.4c0 85-.399 169.4-.399 254.4 0 54.1 2.8 103.7-6 118.9-14.4 29.899-51.7 26.2-68.7 20.399-17.3-8.5-26.1-20.6-36.3-37.699-2.8-4.9-4.9-8.7-5.601-9-26.699 16.3-53.3 32.699-80 49 13.301 27.3 32.9 51 58 66.399 37.5 22.5 87.9 29.4 140.601 17.3 34.3-10 63.899-30.699 79.399-62.199 22.4-41.3 17.6-91.3 17.4-146.6.5-90.2 0-180.4 0-270.9z" fill="#323330" />
      </svg>
    ),
  },
  {
    id: 'react',
    label: 'React',
    ext: 'tsx',
    icon: (
      <svg viewBox="0 0 569 512" className="w-5 h-5 shrink-0">
        <g fill="#087EA4" fillRule="nonzero">
          <path d="M285.5,201 C255.400481,201 231,225.400481 231,255.5 C231,285.599519 255.400481,310 285.5,310 C315.599519,310 340,285.599519 340,255.5 C340,225.400481 315.599519,201 285.5,201" />
          <path d="M568.959856,255.99437 C568.959856,213.207656 529.337802,175.68144 466.251623,150.985214 C467.094645,145.423543 467.85738,139.922107 468.399323,134.521063 C474.621631,73.0415145 459.808523,28.6686204 426.709856,9.5541429 C389.677085,-11.8291748 337.36955,3.69129898 284.479928,46.0162134 C231.590306,3.69129898 179.282771,-11.8291748 142.25,9.5541429 C109.151333,28.6686204 94.3382249,73.0415145 100.560533,134.521063 C101.102476,139.922107 101.845139,145.443621 102.708233,151.02537 C97.4493791,153.033193 92.2908847,155.161486 87.3331099,157.39017 C31.0111824,182.708821 0,217.765415 0,255.99437 C0,298.781084 39.6220545,336.307301 102.708233,361.003527 C101.845139,366.565197 101.102476,372.066633 100.560533,377.467678 C94.3382249,438.947226 109.151333,483.32012 142.25,502.434597 C153.629683,508.887578 166.52439,512.186771 179.603923,511.991836 C210.956328,511.991836 247.567589,495.487529 284.479928,465.972527 C321.372196,495.487529 358.003528,511.991836 389.396077,511.991836 C402.475265,512.183856 415.36922,508.884856 426.75,502.434597 C459.848667,483.32012 474.661775,438.947226 468.439467,377.467678 C467.897524,372.066633 467.134789,366.565197 466.291767,361.003527 C529.377946,336.347457 569,298.761006 569,255.99437" />
        </g>
      </svg>
    ),
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    ext: 'tsx',
    icon: (
      <svg viewBox="0 0 180 180" className="w-5 h-5 shrink-0">
        <mask id="nj-mask" maskUnits="userSpaceOnUse" width="180" height="180" x="0" y="0" style={{ maskType: 'alpha' }}>
          <circle cx="90" cy="90" fill="black" r="90" />
        </mask>
        <g mask="url(#nj-mask)">
          <circle cx="90" cy="90" fill="black" r="90" />
          <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#nj-g1)" />
          <rect fill="url(#nj-g2)" height="72" width="12" x="115" y="54" />
        </g>
        <defs>
          <linearGradient id="nj-g1" gradientUnits="userSpaceOnUse" x1="109" x2="144.5" y1="116.5" y2="160.5">
            <stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nj-g2" gradientUnits="userSpaceOnUse" x1="121" x2="120.799" y1="54" y2="106.875">
            <stop stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: 'vue',
    label: 'Vue.js',
    ext: 'vue',
    icon: (
      <svg viewBox="0 0 256 221" className="w-5 h-5 shrink-0">
        <path d="M204.8 0H256L128 220.8 0 0h97.92L128 51.2 157.44 0h47.36Z" fill="#41B883" />
        <path d="m0 0 128 220.8L256 0h-51.2L128 132.48 50.56 0H0Z" fill="#41B883" />
        <path d="M50.56 0 128 133.12 204.8 0h-47.36L128 51.2 97.92 0H50.56Z" fill="#35495E" />
      </svg>
    ),
  },
  {
    id: 'angular',
    label: 'Angular',
    ext: 'ts',
    icon: (
      <svg viewBox="0 0 242 256" className="w-5 h-5 shrink-0">
        <path fill="url(#ang-c)" d="m241 43-9 136L149 0l92 43Zm-58 176-62 36-63-36 12-31h101l12 31ZM121 68l32 80H88l33-80ZM9 179 0 43 92 0 9 179Z" />
        <path fill="url(#ang-d)" d="m241 43-9 136L149 0l92 43Zm-58 176-62 36-63-36 12-31h101l12 31ZM121 68l32 80H88l33-80ZM9 179 0 43 92 0 9 179Z" />
        <defs>
          <linearGradient id="ang-c" x1="53.2" x2="245" y1="231.9" y2="140.7" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E40035" /><stop offset=".5" stopColor="#DC087D" /><stop offset="1" stopColor="#6C00F5" />
          </linearGradient>
          <linearGradient id="ang-d" x1="44.5" x2="170" y1="30.7" y2="174" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF31D9" /><stop offset="1" stopColor="#FF5BE1" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    ext: 'php',
    icon: (
      <svg viewBox="0 0 122.52 122.523" className="w-5 h-5 shrink-0">
        <g fill="#21759b">
          <path d="m8.708 61.26c0 20.802 12.089 38.779 29.619 47.298l-25.069-68.686c-2.916 6.536-4.55 13.769-4.55 21.388z" />
          <path d="m96.74 58.608c0-6.495-2.333-10.993-4.334-14.494-2.664-4.329-5.161-7.995-5.161-12.324 0-4.831 3.664-9.328 8.825-9.328.233 0 .454.029.681.042-9.35-8.566-21.807-13.796-35.489-13.796-18.36 0-34.513 9.42-43.91 23.688 1.233.037 2.395.063 3.382.063 5.497 0 14.006-.667 14.006-.667 2.833-.167 3.167 3.994.337 4.329 0 0-2.847.335-6.015.501l19.138 56.925 11.501-34.493-8.188-22.434c-2.83-.166-5.511-.501-5.511-.501-2.832-.166-2.5-4.496.332-4.329 0 0 8.679.667 13.843.667 5.496 0 14.006-.667 14.006-.667 2.835-.167 3.168 3.994.337 4.329 0 0-2.853.335-6.015.501l18.992 56.494 5.242-17.517c2.272-7.269 4.001-12.49 4.001-16.989z" />
          <path d="m62.184 65.857-15.768 45.819c4.708 1.384 9.687 2.141 14.846 2.141 6.12 0 11.989-1.058 17.452-2.979-.141-.225-.269-.464-.374-.724z" />
          <path d="m107.376 36.046c.226 1.674.354 3.471.354 5.404 0 5.333-.996 11.328-3.996 18.824l-16.053 46.413c15.624-9.111 26.133-26.038 26.133-45.426.001-9.137-2.333-17.729-6.438-25.215z" />
          <path d="m61.262 0c-33.779 0-61.262 27.481-61.262 61.26 0 33.783 27.483 61.263 61.262 61.263 33.778 0 61.265-27.48 61.265-61.263-.001-33.779-27.487-61.26-61.265-61.26zm0 119.715c-32.23 0-58.453-26.223-58.453-58.455 0-32.23 26.222-58.451 58.453-58.451 32.229 0 58.45 26.221 58.45 58.451 0 32.232-26.221 58.455-58.45 58.455z" />
        </g>
      </svg>
    ),
  },
  {
    id: 'shopify',
    label: 'Shopify',
    ext: 'js',
    icon: (
      <svg viewBox="0 0 256 292" className="w-5 h-5 shrink-0">
        <path d="M223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-1.703-1.703-5.029-1.185-6.32-.805-.19.056-3.388 1.043-8.678 2.68-5.18-14.906-14.322-28.604-30.405-28.604-.444 0-.901.018-1.358.044C129.31 3.407 123.644.779 118.75.779c-37.465 0-55.364 46.835-60.976 70.635-14.558 4.511-24.9 7.718-26.221 8.133-8.126 2.549-8.383 2.805-9.45 10.462C21.3 95.806.038 260.235.038 260.235l165.678 31.042 89.77-19.42S223.973 58.8 223.775 57.34z" fill="#95BF46" />
        <path d="M221.237 54.983c-1.055-.088-23.383-1.743-23.383-1.743s-15.507-15.395-17.209-17.099c-.637-.634-1.496-.959-2.394-1.099l-12.527 256.233 89.762-19.418S223.972 58.8 223.774 57.34c-.201-1.46-1.48-2.268-2.537-2.357" fill="#5E8E3E" />
        <path d="M135.242 104.585l-11.069 32.926s-9.698-5.176-21.586-5.176c-17.428 0-18.305 10.937-18.305 13.693 0 15.038 39.2 20.8 39.2 56.024 0 27.713-17.577 45.558-41.277 45.558-28.44 0-42.984-17.7-42.984-17.7l7.615-25.16s14.95 12.835 27.565 12.835c8.243 0 11.596-6.49 11.596-11.232 0-19.616-32.16-20.491-32.16-52.724 0-27.129 19.472-53.382 58.778-53.382 15.145 0 22.627 4.338 22.627 4.338" fill="#FFF" />
      </svg>
    ),
  },
];

// ─── Code generator (same logic as original) ─────────────────────────────────

function generateEmbedCode(stack: TechStack, chatbotId: string, baseUrl: string): string {
  const configObject = `{\n  chatbotId: '${chatbotId}',\n  baseUrl: '${baseUrl}'\n}`;
  const loaderSnippet = `(function(w,d,s,o,f,js,fjs){
    w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','chatbot','${baseUrl}/embed.js'));`;

  switch (stack) {
    case 'vanilla':
      return `<!-- Add before closing </body> tag -->\n<script>\n  ${loaderSnippet}\n  chatbot('init', ${configObject});\n</script>`;

    case 'react':
      return `import { useEffect } from 'react';\n\nexport default function App() {\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = '${baseUrl}/embed.js';\n    script.async = true;\n    script.onload = () => window.chatbot?.('init', ${configObject});\n    document.body.appendChild(script);\n    return () => document.body.removeChild(script);\n  }, []);\n\n  return <div>{/* your app */}</div>;\n}`;

    case 'nextjs':
      return `// app/layout.tsx\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        <Script\n          id="chatbot-loader"\n          strategy="afterInteractive"\n          dangerouslySetInnerHTML={{\n            __html: \`\n              ${loaderSnippet}\n              chatbot('init', ${configObject});\n            \`\n          }}\n        />\n      </body>\n    </html>\n  );\n}`;

    case 'vue':
      return `<template>\n  <div id="app"><!-- your app --></div>\n</template>\n\n<script>\nexport default {\n  mounted() {\n    const script = document.createElement('script');\n    script.src = '${baseUrl}/embed.js';\n    script.async = true;\n    script.onload = () => window.chatbot?.('init', ${configObject});\n    document.body.appendChild(script);\n  }\n}\n</script>`;

    case 'angular':
      return `// app.component.ts\nimport { Component, OnInit } from '@angular/core';\n\n@Component({ selector: 'app-root', templateUrl: './app.component.html' })\nexport class AppComponent implements OnInit {\n  ngOnInit() {\n    const script = document.createElement('script');\n    script.src = '${baseUrl}/embed.js';\n    script.async = true;\n    script.onload = () => (window as any).chatbot?.('init', ${configObject});\n    document.body.appendChild(script);\n  }\n}`;

    case 'wordpress':
      return `<?php\n// Add to functions.php\nfunction add_chatbot_script() { ?>\n  <script>\n    ${loaderSnippet}\n    chatbot('init', ${configObject});\n  </script>\n<?php }\nadd_action('wp_footer', 'add_chatbot_script');\n?>`;

    case 'shopify':
      return `<!-- Add to theme.liquid before </body> -->\n<!-- Online Store › Themes › Edit code › Layout › theme.liquid -->\n\n<script>\n  ${loaderSnippet}\n  chatbot('init', ${configObject});\n</script>`;

    default:
      return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmbedPage() {
  const params = useParams();
  const chatbotId = params.id as string;

  // ── Use the hook instead of raw fetch ──────────────────────────────────────
  const { chatbot, isLoadingChatbot } = useChatbot({ chatbotId });

  const [selectedStack, setSelectedStack] = useState<TechStack>('vanilla');
  const [copied, setCopied] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://chatbots.prabisha.com';
  const embedCode = generateEmbedCode(selectedStack, chatbotId, baseUrl);
  const selectedMeta = TECH_STACKS.find(s => s.id === selectedStack)!;

  function copyToClipboard() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      toast.success('Embed code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadScript() {
    const blob = new Blob([embedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-${chatbotId}-${selectedStack}.${selectedMeta.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Embed code downloaded');
  }

  if (isLoadingChatbot) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Stack picker ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label>Framework / Platform</Label>
        <div className="grid grid-cols-2 gap-2">
          {TECH_STACKS.map((stack) => (
            <button
              key={stack.id}
              type="button"
              onClick={() => setSelectedStack(stack.id)}
              className={`
                flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm font-medium
                transition-colors text-left
                ${selectedStack === stack.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted/50'
                }
              `}
            >
              {stack.icon}
              <span>{stack.label}</span>
              {selectedStack === stack.id && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border bg-primary/10 border-primary/20 text-primary font-medium">
                  selected
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <hr />

      {/* ── Code block ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{selectedMeta.label} snippet</Label>
          <span className="text-xs text-muted-foreground font-mono">
            .{selectedMeta.ext}
          </span>
        </div>

        <div className="relative group rounded-lg overflow-hidden border border-border">
          <pre className="bg-zinc-950 text-zinc-100 p-4 overflow-x-auto text-xs leading-relaxed max-h-72 scrollbar-thin">
            <code>{embedCode}</code>
          </pre>
          {/* Floating copy button on hover */}
          <button
            type="button"
            onClick={copyToClipboard}
            className="
              absolute top-2.5 right-2.5
              flex items-center gap-1.5 px-2 py-1.5
              text-xs font-medium rounded-md
              bg-zinc-800 hover:bg-zinc-700 text-zinc-200
              border border-zinc-700
              opacity-0 group-hover:opacity-100 transition-opacity
            "
          >
            {copied
              ? <><Check className="h-3 w-3" /> Copied</>
              : <><Copy className="h-3 w-3" /> Copy</>
            }
          </button>
        </div>

        <p className="text-xs text-muted-foreground pl-0.5">
          Paste this into your {selectedMeta.label} project to embed the chatbot.
        </p>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={downloadScript}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download as .{selectedMeta.ext} file</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button onClick={copyToClipboard} className="gap-2">
          {copied
            ? <><Check className="h-4 w-4" /> Copied!</>
            : <><Copy className="h-4 w-4" /> Copy Code</>
          }
        </Button>
      </div>

    </div>
  );
}