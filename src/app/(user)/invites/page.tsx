"use client";

import { toast } from 'sonner';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Loader2, 
  Mail, 
  Send, 
  UserPlus, 
  Check, 
  X, 
  Clock,
  AlertCircle,
  Copy,
  ExternalLink,
  MoreVertical,
  Users
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

// Types
interface Workspace {
  id: string;
  name: string;
}

interface InvitedUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Invitation {
  id: string;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  workspace: Workspace;
  invitedBy?: InvitedUser;
  invitedTo?: InvitedUser;
}

interface WorkspaceMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  workspaceId: string;
  workspaceName: string;
}

export default function InvitesPage() {
  const { data: session, status } = useSession();

  // State
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // New invitation dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [selectedRole, setSelectedRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    if (status === 'authenticated') {
      fetchInvitations();
      fetchWorkspaces();
    }
  }, [status]);

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/invites');
      if (!response.ok) throw new Error('Failed to fetch invitations');

      const data = await response.json();
      // Show pending received invitations (actionable ones)
      setReceivedInvitations((data.received || []).filter((i: Invitation) => i.status === 'PENDING'));
      setSentInvitations(data.sent || []);
    } catch (error) {
      toast.error('Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      
      const workspaces = await response.json();
      setWorkspaces(workspaces || []);
    } catch (error) {
      toast.error('Failed to load workspaces');
    }
  };

  const handleSendInvitation = async () => {
    if (!email || !selectedWorkspace) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: selectedWorkspace,
          email,
          role: selectedRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send invitation');
      }

      toast.success('Invitation sent successfully');

      // Reset form and refresh
      setEmail('');
      setSelectedWorkspace('');
      setSelectedRole('MEMBER');
      setIsDialogOpen(false);
      fetchInvitations();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleRespondToInvitation = async (invitationId: string, action: 'accept' | 'reject') => {
    // Find the token for this invitation
    const invitation = receivedInvitations.find(i => i.id === invitationId);
    if (!invitation?.token) {
      toast.error('Invalid invitation — token missing');
      return;
    }

    try {
      const response = await fetch(`/api/invites/${invitationId}?token=${invitation.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to process invitation');
      }

      toast.success(`Invitation ${action}ed successfully`);
      fetchInvitations();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyInvitationLink = (invitationId: string, token: string) => {
    const invitationLink = `${window.location.origin}/invites/${invitationId}?token=${token}`;
    navigator.clipboard.writeText(invitationLink);
    setCopiedToken(token);

    toast.success('Invitation link copied to clipboard');

    setTimeout(() => setCopiedToken(null), 2000);
  };

  const revokeInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/invites/${invitationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to revoke invitation');

      toast.success('Invitation revoked successfully');

      fetchInvitations();
    } catch (error) {
      toast.error('Failed to revoke invitation');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PENDING: 'default',
      ACCEPTED: 'secondary',
      REJECTED: 'destructive',
      EXPIRED: 'outline',
      REVOKED: 'destructive',
    };

    const icons: Record<string, React.ReactNode> = {
      PENDING: <Clock className="h-3 w-3" />,
      ACCEPTED: <Check className="h-3 w-3" />,
      REJECTED: <X className="h-3 w-3" />,
      EXPIRED: <AlertCircle className="h-3 w-3" />,
      REVOKED: <X className="h-3 w-3" />,
    };

    return (
      <Badge variant={variants[status] || 'default'} className="gap-1">
        {icons[status]}
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invitations</h1>
          <p className="text-muted-foreground">
            Manage workspace invitations sent and received
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Invite to Workspace</DialogTitle>
              <DialogDescription>
                Send an invitation to collaborate on a workspace
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace">Workspace</Label>
                <Select 
                  value={selectedWorkspace} 
                  onValueChange={setSelectedWorkspace}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a workspace">
                      {selectedWorkspace ? (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {workspaces.find(w => w.id === selectedWorkspace)?.name}
                        </div>
                      ) : (
                        "Select a workspace"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.id} value={workspace.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {workspace.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={selectedRole} 
                  onValueChange={(value: 'MEMBER' | 'ADMIN') => setSelectedRole(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Members can view and edit, Admins can manage members and settings
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSendInvitation} disabled={isSending}>
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">
            Received
            <Badge variant="secondary" className="ml-2">
              {receivedInvitations.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent
            <Badge variant="secondary" className="ml-2">
              {sentInvitations.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Received Invitations Tab */}
        <TabsContent value="received" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invitations to Join Workspaces</CardTitle>
              <CardDescription>
                Accept or decline invitations to collaborate on workspaces
              </CardDescription>
            </CardHeader>
            <CardContent>
              {receivedInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No pending invitations</h3>
                  <p className="text-muted-foreground">
                    You don't have any pending workspace invitations
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receivedInvitations.map((invitation) => (
                    <Card key={invitation.id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={invitation.invitedBy?.image || undefined} />
                              <AvatarFallback>
                                {invitation.invitedBy?.name?.[0] || invitation.invitedBy?.email?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">
                                  {invitation.workspace.name}
                                </h4>
                                {getStatusBadge(invitation.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Invited by {invitation.invitedBy?.name || invitation.invitedBy?.email}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Expires {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}</span>
                                <span>•</span>
                                <span>Sent {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                          {invitation.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRespondToInvitation(invitation.id, 'reject')}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRespondToInvitation(invitation.id, 'accept')}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Accept
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sent Invitations Tab */}
        <TabsContent value="sent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invitations You've Sent</CardTitle>
              <CardDescription>
                Manage invitations you've sent to other users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sentInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No sent invitations</h3>
                  <p className="text-muted-foreground">
                    You haven't sent any workspace invitations yet
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workspace</TableHead>
                        <TableHead>Invited User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentInvitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">
                            {invitation.workspace.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={invitation.invitedTo?.image || undefined} />
                                <AvatarFallback>
                                  {invitation.invitedTo?.name?.[0] || invitation.invitedTo?.email?.[0] || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {invitation.invitedTo?.name || invitation.invitedTo?.email}
                                </div>
                                {invitation.invitedTo?.name && (
                                  <div className="text-sm text-muted-foreground">
                                    {invitation.invitedTo?.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invitation.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => copyInvitationLink(invitation.id, invitation.token)}
                                  className="flex items-center gap-2"
                                >
                                  <Copy className="h-4 w-4" />
                                  {copiedToken === invitation.token ? 'Copied!' : 'Copy Link'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {invitation.status === 'PENDING' && (
                                  <DropdownMenuItem
                                    onClick={() => revokeInvitation(invitation.id)}
                                    className="text-destructive"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Revoke Invitation
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sentInvitations.filter(i => i.status === 'PENDING').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sentInvitations.filter(i => i.status === 'ACCEPTED').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Expired/Rejected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sentInvitations.filter(i => i.status === 'EXPIRED' || i.status === 'REJECTED').length}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-semibold">1</span>
                </div>
                <h4 className="font-semibold">Send Invitation</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Invite users by email to collaborate on your workspaces
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-semibold">2</span>
                </div>
                <h4 className="font-semibold">User Accepts</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Users receive an email notification and can accept the invitation
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-semibold">3</span>
                </div>
                <h4 className="font-semibold">Start Collaborating</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Users gain access to the workspace and can start collaborating
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}