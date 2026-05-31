"use client"

import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, User, ShieldCheck, Info } from "lucide-react"

export default function AccountPage() {
  const { data: session } = useSession()
  const user = session?.user

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "U"

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
