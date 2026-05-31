"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Mail, User, ShieldCheck, Info, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

export default function AccountPage() {
  const { data: session } = useSession()
  const user = session?.user

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "U"

  // ── Delete account state ──────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [blockedWorkspaces, setBlockedWorkspaces] = useState<string[]>([])

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setBlockedWorkspaces([])
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      const data = await res.json()

      if (res.status === 409) {
        // User is the sole owner of workspaces
        setBlockedWorkspaces(data.workspaces ?? [])
        setDeleting(false)
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast.success('Account deleted. Signing you out…')
      setTimeout(() => signOut({ callbackUrl: '/' }), 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  const emailMatches = confirmEmail.trim().toLowerCase() === (user?.email ?? '').toLowerCase()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground text-sm mt-1">Your profile and account details.</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your identity as synced from the central account service.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar + name block */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-xl">
              <AvatarImage src={user?.image ?? ""} alt={user?.name ?? ""} />
              <AvatarFallback className="rounded-xl text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg leading-tight">{user?.name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{user?.email ?? "—"}</p>
              {(user as any)?.role && (
                <Badge variant="secondary" className="mt-1.5 capitalize text-xs">
                  {(user as any).role.toLowerCase()}
                </Badge>
              )}
            </div>
          </div>

          {/* Detail rows */}
          <div className="divide-y rounded-lg border">
            <Row icon={<User className="h-4 w-4" />} label="Full name" value={user?.name ?? "—"} />
            <Row icon={<Mail className="h-4 w-4" />} label="Email" value={user?.email ?? "—"} />
            <Row
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Role"
              value={(user as any)?.role ? (user as any).role.charAt(0) + (user as any).role.slice(1).toLowerCase() : "User"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>
          Your profile details are managed through the central authentication service.
          To update your name, email, or profile picture, please visit your account settings there.
        </p>
      </div>

      {/* Danger Zone — Delete Account */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Deleting your account will permanently remove:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Your profile and authentication data</li>
            <li>Your membership from all workspaces</li>
            <li>All pending invitations you have sent</li>
          </ul>
          <p className="text-xs pt-1">
            <span className="font-medium text-foreground">Note:</span> If you are the sole owner of a workspace, you must transfer ownership or delete that workspace before you can delete your account.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { setDeleteDialogOpen(true); setBlockedWorkspaces([]); setConfirmEmail("") }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete my account
          </Button>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete account permanently?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will <span className="font-semibold text-foreground">permanently</span> delete
                  your account and remove all your data. This cannot be undone.
                </p>

                {/* Blocked workspaces error */}
                {blockedWorkspaces.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-xs space-y-1">
                    <p className="font-semibold">Cannot delete account</p>
                    <p>You are the sole owner of the following workspace(s). Transfer ownership or delete them first:</p>
                    <ul className="list-disc list-inside pl-1">
                      {blockedWorkspaces.map((ws) => (
                        <li key={ws}>{ws}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="confirm-email" className="text-foreground font-medium">
                    Type your email address to confirm
                  </Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    placeholder={user?.email ?? "your@email.com"}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setConfirmEmail("")}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!emailMatches || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
