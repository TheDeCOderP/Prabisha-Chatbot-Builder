"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { Search, Bookmark, RotateCcw, Plus, MoreVertical, Trash, UserCog, Mail, Crown, Shield, User, UserPlus } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { useWorkspace } from "@/providers/workspace-provider"
import { useSession } from "next-auth/react"

// Form validation schema for adding member
const addMemberSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .trim(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
})

// Form validation schema for editing role
const editRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
})

type AddMemberFormValues = z.infer<typeof addMemberSchema>
type EditRoleFormValues = z.infer<typeof editRoleSchema>

interface WorkspaceMember {
  id: string
  role: "OWNER" | "ADMIN" | "MEMBER"
  userId: string
  workspaceId: string
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
  }
  createdAt: string
}

interface Invitation {
  id: string
  email: string
  role: "OWNER" | "ADMIN" | "MEMBER"
  status: "PENDING" | "ACCEPTED" | "EXPIRED"
  createdAt: string
}

export default function MembersPage() {
  const { activeWorkspace } = useWorkspace()
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [itemsPerPage, setItemsPerPage] = useState("25")
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<WorkspaceMember | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<"OWNER" | "ADMIN" | "MEMBER" | null>(null)

  // Forms
  const addMemberForm = useForm<AddMemberFormValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
    mode: "onChange",
  })

  const editRoleForm = useForm<EditRoleFormValues>({
    resolver: zodResolver(editRoleSchema),
    defaultValues: {
      role: "MEMBER",
    },
    mode: "onChange",
  })

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchMembers()
      fetchInvitations()
    }
  }, [activeWorkspace?.id])

  // Determine current user role from members list whenever members change
  useEffect(() => {
    if (members.length > 0 && session?.user?.email) {
      const currentMember = members.find(
        member => member.user.email.toLowerCase() === session.user.email?.toLowerCase()
      )
      if (currentMember) {
        setCurrentUserRole(currentMember.role)
      } else {
        // User is not a member of this workspace (shouldn't happen if they have access)
        setCurrentUserRole(null)
      }
    }
  }, [members, session?.user?.email])

  const fetchMembers = async () => {
    if (!activeWorkspace?.id) return

    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/workspaces/${activeWorkspace.id}/members`)

      if (!response.ok) {
        throw new Error("Failed to fetch members")
      }

      const data = await response.json()
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching members:", err)
      toast.error("Failed to load members")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInvitations = async () => {
    if (!activeWorkspace?.id) return

    try {
      const response = await fetch('/api/invites')
      if (response.ok) {
        const data = await response.json()
        // Filter sent invitations for the active workspace that are still pending
        const pending = (data.sent || []).filter(
          (inv: Invitation) => inv.status === "PENDING"
        )
        setInvitations(pending)
      }
    } catch (error) {
      console.error("Error fetching invitations:", error)
    }
  }

  const onAddMember = async (data: AddMemberFormValues) => {
    try {
      const response = await fetch('/api/invites', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace?.id,
          email: data.email,
          role: data.role,
        }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to invite member")
      }

      setIsAddMemberDialogOpen(false)
      addMemberForm.reset()
      fetchInvitations()
      toast.success(`Invitation sent to ${data.email}`)
    } catch (error) {
      console.error("Error inviting member:", error)
      toast.error(error instanceof Error ? error.message : "Failed to invite member")
    }
  }

  const onUpdateRole = async (data: EditRoleFormValues) => {
    if (!selectedMember) return

    try {
      const response = await fetch(`/api/workspaces/${activeWorkspace?.id}/members/${selectedMember.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: data.role }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to update role")
      }

      setIsEditRoleDialogOpen(false)
      setSelectedMember(null)
      fetchMembers()
      toast.success("Member role updated successfully")
    } catch (error) {
      console.error("Error updating role:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update member role")
    }
  }

  const handleRemoveMember = async (member: WorkspaceMember) => {
    setMemberToDelete(member)
    setDeleteDialogOpen(true)
  }

  const confirmRemoveMember = async () => {
    if (!memberToDelete) return

    try {
      const response = await fetch(`/api/workspaces/${activeWorkspace?.id}/members/${memberToDelete.userId}`, {
        method: "DELETE",
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to remove member")
      }

      setMembers(members.filter(m => m.userId !== memberToDelete.userId))
      toast.success(`${memberToDelete.user.email} has been removed from the workspace`)
    } catch (error) {
      console.error("Error removing member:", error)
      toast.error(error instanceof Error ? error.message : "Failed to remove member")
    } finally {
      setDeleteDialogOpen(false)
      setMemberToDelete(null)
    }
  }

  const openEditRoleDialog = (member: WorkspaceMember) => {
    setSelectedMember(member)
    editRoleForm.setValue("role", member.role)
    setIsEditRoleDialogOpen(true)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER":
        return <Crown className="h-4 w-4 text-yellow-500" />
      case "ADMIN":
        return <Shield className="h-4 w-4 text-blue-500" />
      default:
        return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "OWNER":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "ADMIN":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
    }
  }

  const canManageMembers = currentUserRole === "OWNER" || currentUserRole === "ADMIN"
  const canChangeRole = currentUserRole === "OWNER"

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.user.name && member.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesRole =
      filter === "all" ||
      (filter === "owner" && member.role === "OWNER") ||
      (filter === "admin" && member.role === "ADMIN") ||
      (filter === "member" && member.role === "MEMBER")
    return matchesSearch && matchesRole
  })

  const totalItems = filteredMembers.length
  const startItem = totalItems > 0 ? 1 : 0
  const endItem = Math.min(parseInt(itemsPerPage), totalItems)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          {canManageMembers && <Skeleton className="h-10 w-32" />}
        </div>

        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-6 w-24" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-destructive/10 p-3">
          <div className="text-2xl">⚠️</div>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Failed to load members</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <Button onClick={fetchMembers} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{memberToDelete?.user.email}</span> from this workspace?
              They will lose access to all chatbots and data in this workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Member Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedMember?.user.email}
            </DialogDescription>
          </DialogHeader>
          <Form {...editRoleForm}>
            <form onSubmit={editRoleForm.handleSubmit(onUpdateRole)} className="space-y-6">
              <FormField
                control={editRoleForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currentUserRole === "OWNER" && (
                          <SelectItem value="OWNER">
                            <div className="flex items-center gap-2">
                              <Crown className="h-4 w-4 text-yellow-500" />
                              <span>Owner</span>
                              <span className="text-xs text-muted-foreground">Full access, can delete workspace</span>
                            </div>
                          </SelectItem>
                        )}
                        <SelectItem value="ADMIN">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            <span>Admin</span>
                            <span className="text-xs text-muted-foreground">Can manage members and settings</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="MEMBER">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Member</span>
                            <span className="text-xs text-muted-foreground">Can use chatbots</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditRoleDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Update Role
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this workspace.
            </DialogDescription>
          </DialogHeader>
          <Form {...addMemberForm}>
            <form onSubmit={addMemberForm.handleSubmit(onAddMember)} className="space-y-6">
              <FormField
                control={addMemberForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Email Address
                      <span className="text-destructive ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="colleague@example.com"
                        disabled={addMemberForm.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addMemberForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {canChangeRole && (
                          <SelectItem value="OWNER">
                            <div className="flex items-center gap-2">
                              <Crown className="h-4 w-4 text-yellow-500" />
                              <span>Owner</span>
                            </div>
                          </SelectItem>
                        )}
                        <SelectItem value="ADMIN">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            <span>Admin</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="MEMBER">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Member</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddMemberDialogOpen(false)}
                  disabled={addMemberForm.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addMemberForm.formState.isSubmitting || !addMemberForm.formState.isValid}
                >
                  {addMemberForm.formState.isSubmitting ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          {invitations.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {invitations.length} pending invitation{invitations.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {canManageMembers && (
          <Button onClick={() => setIsAddMemberDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            <SelectItem value="owner">Owners</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="member">Members</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" title="Bookmark view">
          <Bookmark className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Refresh"
          onClick={fetchMembers}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              {canManageMembers && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageMembers ? 6 : 5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="rounded-full bg-muted p-3">
                      <UserCog className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium">No members found</p>
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? "Try a different search term" : "Invite members to collaborate"}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers
                .slice(0, parseInt(itemsPerPage))
                .map((member, index) => (
                  <TableRow key={member.id}>
                    <TableCell className="text-center font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {member.user.image ? (
                            <Image
                              src={member.user.image}
                              alt={member.user.name || member.user.email}
                              width={32}
                              height={32}
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium">
                              {(member.user.name?.[0] || member.user.email[0]).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {member.user.name || "Unnamed User"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{member.user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeClass(member.role)}`}>
                          {member.role}
                        </span>
                      </div>
                    </TableCell>
                    {canManageMembers && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canChangeRole && member.role !== "OWNER" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditRoleDialog(member)}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                          )}
                          {member.role !== "OWNER" && currentUserRole === "OWNER" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pending Invitations Section */}
      {invitations.length > 0 && canManageMembers && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Pending Invitations ({invitations.length})
          </h3>
          <div className="rounded-lg border bg-muted/30">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(invitation.role)}
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getRoleBadgeClass(invitation.role)}`}>
                          {invitation.role}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredMembers.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {startItem}–{endItem} of {totalItems} member{totalItems !== 1 ? "s" : ""}
          </span>
          <Select value={itemsPerPage} onValueChange={setItemsPerPage}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 per page</SelectItem>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
              <SelectItem value="100">100 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}