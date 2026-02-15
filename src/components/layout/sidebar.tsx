"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  LogOut,
  BookOpen,
  Bot,
  Cable,
  Drill,
  GalleryVerticalEnd,
  Gauge,
  Map,
  MessageCircle,
  Moon,
  Palette,
  ScrollText,
  Settings2,
  SquareTerminal,
  Sun,
  NotebookPen,
  UserRoundPlus,
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
  SidebarMenuAction,
} from "@/components/ui/sidebar"
import { ChevronRight, type LucideIcon, Plus, ChevronsUpDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { signOut, useSession } from "next-auth/react"
import { Workspace } from "@/types/workspace"
import { Session } from "next-auth"
import { toast } from "sonner"
import { WorkspaceForm } from "../forms/workspace-form"
import { useWorkspace } from "@/providers/workspace-provider"
import { Chatbot } from "../../../generated/prisma/client"
import { usePathname, useRouter } from "next/navigation"
import ChatbotForm from "../forms/chatbot-form"

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
  const id = props.id
  const pathname = usePathname()
  const router = useRouter()
  const isChatbotRoute = pathname?.startsWith("/chatbots/")

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
          {
            icon: MessageCircle,
            title: "Conversations",
            url: "/conversations",
          },
          {
            icon: UserRoundPlus,
            title: "Invites",
            url: "/invites",
          },
          {
            icon: NotebookPen,
            title: "Leads",
            url: "/leads",
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
        ],
      },
    ],
  }

  const { data: session } = useSession()
  const { activeWorkspace } = useWorkspace()

  const [loading, setLoading] = useState(true)
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeChatbot, setActiveChatbot] = useState<Chatbot | null>(null)

  useEffect(() => {
    // Fetch workspaces
    const fetchWorkspaces = async () => {
      try {
        const res = await fetch("/api/workspaces")
        const data = await res.json()
        setWorkspaces(data || [])
      } catch (error) {
        console.error("Error fetching workspaces:", error)
        setWorkspaces([])
      } finally {
        setLoading(false)
      }
    }

    fetchWorkspaces()
  }, [])

  useEffect(() => {
    // Fetch chatbots for the active workspace
    const fetchChatbots = async () => {
      if (!activeWorkspace?.id) {
        setChatbots([])
        return
      }

      try {
        const res = await fetch(`/api/chatbots?workspaceId=${activeWorkspace.id}`)
        const data = await res.json()
        setChatbots(data || [])

        // If we're on a chatbot route, set the active chatbot
        if (isChatbotRoute && id) {
          const currentChatbot = data.find((chatbot: Chatbot) => chatbot.id === id)
          setActiveChatbot(currentChatbot || null)
        }
      } catch (error) {
        console.error("Error fetching chatbots:", error)
        setChatbots([])
      }
    }

    fetchChatbots()
  }, [activeWorkspace, isChatbotRoute, id])

  // Update active chatbot when route changes
  useEffect(() => {
    if (isChatbotRoute && id && chatbots.length > 0) {
      const currentChatbot = chatbots.find((chatbot) => chatbot.id === id)
      setActiveChatbot(currentChatbot || null)
    }
  }, [pathname, chatbots, isChatbotRoute, id])

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        {isChatbotRoute && activeWorkspace ? (
          <ChatbotSwitcher
            chatbots={chatbots}
            activeChatbot={activeChatbot}
            workspaceId={activeWorkspace.id}
            loading={loading}
            onChatbotSelect={(chatbot) => {
              if (chatbot.id !== id) {
                router.push(`/chatbots/${chatbot.id}/instructions`)
              }
            }}
          />
        ) : (
          <WorkspaceSwitcher activeWorkspace={activeWorkspace} workspaces={workspaces} loading={loading} />
        )}
      </SidebarHeader>
      {isChatbotRoute ? (
        <SidebarContent>
          <NavMain items={defaultNavData.chatbotNav} />
        </SidebarContent>
      ) : (
        <SidebarContent>
          <NavMain items={defaultNavData.mainNav} />
        </SidebarContent>
      )}
      <SidebarFooter>
        <NavUser session={session} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function NavMain({ items }: { items: NavItem[] }) {
  if (!items.length) return null

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

export function NavUser({ session }: { session: Session | null }) {
  const { isMobile } = useSidebar()
  const { setTheme, theme } = useTheme()

  const user = {
    name: session?.user?.name || "Guest",
    email: session?.user?.email || "guest@example.com",
    avatar: session?.user?.image || "/avatars/default.jpg",
  }

  const handleLogout = async () => {
    const appUrl = window.location.origin; 
    const centralLogoutUrl = `https://auth.prabisha.com/auth/logout?callbackUrl=${appUrl}/login`;
    
    await signOut({ callbackUrl: centralLogoutUrl });
  };

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
                <AvatarFallback className="rounded-lg">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
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
                  <AvatarFallback className="rounded-lg">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
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
  activeWorkspace,
  workspaces,
  loading,
}: {
  activeWorkspace: Workspace | null
  workspaces: Workspace[]
  loading: boolean
}) {
  const { isMobile } = useSidebar()
  const { setActiveWorkspace } = useWorkspace()

  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspace) {
      setActiveWorkspace(workspaces[0])
    }
  }, [workspaces, activeWorkspace, setActiveWorkspace])

  const handleWorkspaceAdded = () => {
    toast.success("Workspace added successfully!")
  }

  // Handle workspace renaming
  const handleRenameWorkspace = async (workspaceId: string, newDisplayName: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/rename`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: newDisplayName })
      })
      
      if (response.ok) {
        toast.success('Workspace renamed successfully')
        // Refresh workspaces or update locally
      }
    } catch (error) {
      toast.error('Failed to rename workspace')
    }
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
                <span className="truncate font-medium">{activeWorkspace?.name || "Select Workspace"}</span>
                <span className="truncate text-xs text-muted-foreground">Workspace</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-70 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">Workspaces</DropdownMenuLabel>
            {workspaces.map((workspace, index) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setActiveWorkspace(workspace)}
                className="gap-2 p-2 group"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`flex size-6 items-center justify-center rounded-md ${
                      workspace.role === 'OWNER' 
                        ? 'bg-primary/10' 
                        : 'bg-secondary/10'
                    }`}>
                      <GalleryVerticalEnd className="size-3" />
                    </div>
                    <span className="truncate font-medium">
                      {workspace.name}
                    </span>
                    {workspace.role === 'OWNER' && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Owner
                      </span>
                    )}
                  </div>
                  {workspace.owner && workspace.role !== 'OWNER' && (
                    <span className="text-xs text-muted-foreground truncate mt-1">
                      Owned by {workspace.owner.name || workspace.owner.email}
                    </span>
                  )}
                </div>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2 cursor-pointer" onSelect={(e) => e.preventDefault()}>
              <WorkspaceForm
                onSuccess={handleWorkspaceAdded}
                trigger={
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                      <Plus className="size-4" />
                    </div>
                    <div className="text-muted-foreground font-medium">Add Workspace</div>
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

function ChatbotSwitcher({
  chatbots,
  activeChatbot,
  workspaceId,
  loading,
  onChatbotSelect,
}: {
  chatbots: Chatbot[]
  activeChatbot: Chatbot | null
  workspaceId: string
  loading: boolean
  onChatbotSelect: (chatbot: Chatbot) => void
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  const handleCreateChatbot = () => {
    router.push(`/chatbots/create?workspaceId=${workspaceId}`)
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

  if (chatbots.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            onClick={handleCreateChatbot}
          >
            <div className="flex items-center gap-2">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Bot className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">No Chatbots</span>
                <span className="truncate text-xs text-muted-foreground">Create your first chatbot</span>
              </div>
              <Plus className="ml-auto size-4" />
            </div>
          </SidebarMenuButton>
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
                <Bot className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeChatbot?.name || "Select Chatbot"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {chatbots.length} chatbot{chatbots.length !== 1 ? "s" : ""}
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
            <DropdownMenuLabel className="text-muted-foreground text-xs">Chatbots</DropdownMenuLabel>
            {chatbots.map((chatbot, index) => (
              <DropdownMenuItem
                key={chatbot.id}
                onClick={() => onChatbotSelect(chatbot)}
                className="gap-2 p-2"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                    <Bot className="size-3" />
                  </div>
                  <span className="truncate">{chatbot.name}</span>
                </div>
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}