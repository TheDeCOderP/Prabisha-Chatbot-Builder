"use client"
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Cable,
  Command,
  Drill,
  Frame,
  GalleryVerticalEnd,
  Gauge,
  LayoutDashboard,
  Map,
  MessageCircle,
  Moon,
  Palette,
  PieChart,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  SquareTerminal,
  Sun,
  UsersRound,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuAction
} from "@/components/ui/sidebar";
import { ChevronRight, type LucideIcon } from "lucide-react"
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
  Plus
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuShortcut
} from "@/components/ui/dropdown-menu"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "next-auth/react"
import { Workspace } from "@/types/workspace"
import { Session } from "next-auth";
import { toast } from "sonner";
import { WorkspaceForm } from "../forms/workspace-form";
import { useWorkspace } from "@/providers/workspace-provider";

// Types for navigation items
type NavItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: {
    icon?: LucideIcon
    title: string
    url: string
  }[]
}

export default function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const id = props.id;

  const defaultNavData = {
    mainNav: [
      {
        title: "Playground",
        url: "#",
        icon: SquareTerminal,
        isActive: true,
        items: [
          {
            icon: Gauge,
            title: "Dashboard",
            url: "/dashboard",
          },
          {
            icon: Bot,
            title: "Chatbots",
            url: "/chatbots",
          },
        ],
      },
    ],
    chatbotNav: [
      {
        title: "Build",
        url: "#",
        icon: Drill,
        isActive: true,
        items: [
          {
            icon: ScrollText,
            title: "Instructions",
            url: `/chatbots/${id}/instructions`,
          },
          {
            icon: BookOpen,
            title: "Knowledge",
            url: `/chatbots/${id}/knowledge`,
          },
          {
            icon: Map,
            title: "Logic",
            url: `/chatbots/${id}/logic`,
          },
          {
            icon: Palette,
            title: "Theme",
            url: `/chatbots/${id}/theme`,
          },
          {
            icon: Cable,
            title: "Integrations",
            url: `/chatbots/${id}/integrations`,
          },
          {
            icon: Bot,
            title: "AI Model",
            url: `/chatbots/${id}/models`,
          },
          {
            icon: Settings2,
            title: "Settings",
            url: `/chatbots/${id}/settings`,
          },
        ]
      },
      {
        title: "Review",
        url: "#",
        icon: SquareTerminal,
        isActive: true,
        items: [
          {
            icon: MessageCircle,
            title: "Conversations",
            url: `/chatbots/${id}/conversations`,
          },
          {
            icon: Settings2,
            title: "Settings",
            url: `/chatbots/${id}/settings`,
          },
        ]
      }
    ],
  }
  const { data: session } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [navData, setNavData] = useState<NavItem[]>([]);
      
  useEffect(() => {
    // Fetch workspaces
    const fetchWorkspaces = async () => {
      try {
        const res = await fetch('/api/workspaces');
        const data = await res.json();
        setWorkspaces(data || []);
      } catch (error) {
        console.error('Error fetching workspaces:', error);
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch navigation data (you can replace this with your own API)
    const fetchNavigationData = async () => {
      try {
        // Example API call for navigation data
        // const res = await fetch('/api/navigation');
        // const data = await res.json();
        // setNavData(data.navMain || defaultNavData.navMain);
        
        // For now, use default data
        setNavData(defaultNavData.mainNav);
      } catch (error) {
        console.error('Error fetching navigation:', error);
        setNavData(defaultNavData.mainNav);
      }
    };

        fetchWorkspaces();
    fetchNavigationData();
  }, []);

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher workspaces={workspaces} loading={loading} />
      </SidebarHeader>
      { id ? (
        <SidebarContent>
          <NavMain items={defaultNavData.chatbotNav} />
        </SidebarContent>
      ) : (
        <SidebarContent>
          <NavMain items={navData} />
        </SidebarContent>
      )}
      <SidebarFooter>
        <NavUser session={session} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function NavMain({
  items,
}: {
  items: NavItem[]
}) {
  if (!items.length) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {item.items && item.items.length > 0 && (
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  )}
                </SidebarMenuButton>
              </CollapsibleTrigger>
              {item.items && item.items.length > 0 && (
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <a href={subItem.url}>
                            {subItem.icon && <subItem.icon />}
                            <span>{subItem.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              )}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function NavUser({
  session,
}: {
  session: Session | null
}) {
  const { isMobile } = useSidebar()
  const { setTheme, theme } = useTheme();

  const user = {
    name: session?.user?.name || "Guest",
    email: session?.user?.email || "guest@example.com",
    avatar: session?.user?.image || "/avatars/default.jpg",
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ?  <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function WorkspaceSwitcher({
  workspaces,
  loading,
}: {
  workspaces: Workspace[]
  loading: boolean
}) {
  const { isMobile } = useSidebar()
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();

  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspace) {
      setActiveWorkspace(workspaces[0])
    }
  }, [workspaces, activeWorkspace, setActiveWorkspace]);

  const handleWorkspaceAdded = () => {
    toast.success("Workspace added successfully!");
    // Optionally, refresh the workspace list here
  }

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex items-center gap-2 w-full">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="h-4 w-4 ml-auto" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!activeWorkspace && workspaces.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">No Workspaces</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <WorkspaceForm onSuccess={handleWorkspaceAdded} />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <GalleryVerticalEnd className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeWorkspace?.name || "Select Workspace"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((workspace, index) => (
              <DropdownMenuItem
                key={workspace.id || workspace.name}
                onClick={() => setActiveWorkspace(workspace)}
                className="gap-2 p-2"
              >
                {workspace.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2 cursor-pointer"
              onSelect={(e) => e.preventDefault()}
            >
              <WorkspaceForm
                onSuccess={handleWorkspaceAdded}
                trigger={
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                      <Plus className="size-4" />
                    </div>
                    <div className="text-muted-foreground font-medium">
                      Add Workspace
                    </div>
                  </div>
                }
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}