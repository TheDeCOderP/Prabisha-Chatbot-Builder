"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import AppSidebar from "@/components/layout/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { WorkspaceProvider } from "@/providers/workspace-provider";
import { Loader2 } from "lucide-react";

// Breadcrumb label mappings
const BREADCRUMB_MAPPINGS: Record<string, string> = {
  dashboard:   "Dashboard",
  workspaces:  "Workspaces",
  management:  "Management",
  projects:    "Projects",
  skills:      "Skills",
  teams:       "Teams",
  chatbots:    "Chatbots",
  instructions: "Instructions",
  integrations: "Integrations",
  knowledge:   "Knowledge Base",
  logic:       "Logic & Flows",
  models:      "AI Models",
  settings:    "Settings",
  theme:       "Theme",
};

// Segment IDs to skip in breadcrumb display (dynamic route params like [id])
const SKIP_PATTERNS = [
  /^[a-z0-9]{20,}$/i,     // cuid / uuid — long alphanumeric IDs
  /^c[a-z0-9]{20,}$/i,    // cuid with 'c' prefix
];

function shouldSkip(segment: string) {
  return SKIP_PATTERNS.some((re) => re.test(segment));
}

interface BreadcrumbItemData {
  label: string;
  href: string;
  isCurrent: boolean;
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      const queryString = searchParams.toString();
      const callbackUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [status, pathname, searchParams, router]);

  const generateBreadcrumbs = (): BreadcrumbItemData[] => {
    if (!pathname) return [];
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItemData[] = [{ label: "Home", href: "/", isCurrent: false }];

    let currentPath = "";
    const visible = segments.filter((seg) => !shouldSkip(seg));

    visible.forEach((segment, index) => {
      // Reconstruct the actual path (including skipped ID segments)
      const segIdx = segments.indexOf(segment, segments.indexOf(segment));
      currentPath = "/" + segments.slice(0, segIdx + 1).join("/");

      breadcrumbs.push({
        label: BREADCRUMB_MAPPINGS[segment] ?? (segment.charAt(0).toUpperCase() + segment.slice(1)),
        href: currentPath,
        isCurrent: index === visible.length - 1,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <AppSidebar id={params.id as string} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center">
                    <BreadcrumbItem>
                      {crumb.isCurrent ? (
                        <BreadcrumbPage className="font-medium text-sm">
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href={crumb.href}
                          className="text-sm hover:text-foreground transition-colors"
                        >
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {index < breadcrumbs.length - 1 && (
                      <BreadcrumbSeparator className="mx-1" />
                    )}
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <div className="flex flex-1 flex-col overflow-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}