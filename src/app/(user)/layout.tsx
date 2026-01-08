"use client";

import { useParams, usePathname } from "next/navigation"
import AppSidebar from "@/components/layout/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { WorkspaceProvider } from "@/providers/workspace-provider";

// Define breadcrumb mappings
const BREADCRUMB_MAPPINGS: Record<string, { label: string; href: string }> = {
  "dashboard": { label: "Dashboard", href: "/dashboard" },
  "chatbots": { label: "Chatbots", href: "/chatbots" },
  "instructions": { label: "Instructions", href: "/instructions" },
  "integrations": { label: "Integrations", href: "/integrations" },
  "knowledge": { label: "Knowledge Base", href: "/knowledge" },
  "logic": { label: "Logic & Flows", href: "/logic" },
  "models": { label: "AI Models", href: "/models" },
  "settings": { label: "Settings", href: "/settings" },
  "theme": { label: "Theme", href: "/theme" },
};

// Define the structure for nested breadcrumbs
interface BreadcrumbItemData {
  label: string;
  href: string;
  isCurrent?: boolean;
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();

  // Generate breadcrumbs based on the current path
  const generateBreadcrumbs = (): BreadcrumbItemData[] => {
    if (!pathname) return [];
    
    // Split the pathname into segments
    const segments = pathname.split('/').filter(segment => segment.length > 0);
    
    // Start with home
    const breadcrumbs: BreadcrumbItemData[] = [
      { label: "Home", href: "/" }
    ];
    
    // Build the path incrementally
    let currentPath = "";
    
    segments.forEach((segment, index) => {
      // Skip the id parameter
      if (segment === params.id) {
        currentPath += `/${segment}`;
        return;
      }
      
      currentPath += `/${segment}`;
      
      // Check if this segment has a mapping
      const mapping = BREADCRUMB_MAPPINGS[segment];
      
      if (mapping) {
        breadcrumbs.push({
          label: mapping.label,
          href: currentPath,
          isCurrent: index === segments.length - 1
        });
      } else {
        // Fallback: capitalize the segment
        breadcrumbs.push({
          label: segment.charAt(0).toUpperCase() + segment.slice(1),
          href: currentPath,
          isCurrent: index === segments.length - 1
        });
      }
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <AppSidebar id={params.id as string}/>
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.href} className="flex items-center">
                      <BreadcrumbItem>
                        {index === breadcrumbs.length - 1 ? (
                          // Current page (no link)
                          <BreadcrumbPage className="font-semibold">
                            {crumb.label}
                          </BreadcrumbPage>
                        ) : (
                          // Clickable breadcrumb
                          <BreadcrumbLink 
                            href={crumb.href}
                            className="hover:text-primary transition-colors"
                          >
                            {crumb.label}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      
                      {/* Add separator except for the last item */}
                      {index < breadcrumbs.length - 1 && (
                        <BreadcrumbSeparator className="mx-2" />
                      )}
                    </div>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 m-4 border max-h-[calc(100vh-7rem)] overflow-auto rounded-xl no-scrollbar">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceProvider>
  )
}