// app/invites/[invitationId]/page.tsx
// Public route — accessible without login. Auth is required only to accept/reject.
'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Mail, Building, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface InvitationData {
  id: string;
  token: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED' | 'REJECTED';
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  email: string | null;
  workspace: Workspace;
  invitedBy: UserInfo;
  invitedTo: UserInfo | null;
  member: {
    id: string;
    role: string;
    user: UserInfo;
  } | null;
  createdAt: string;
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: authStatus } = useSession();

  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const invitationId = params.invitationId as string;
  const token = searchParams.get('token');

  const fetchInvitationData = useCallback(async () => {
    if (!token || !invitationId) return;

    try {
      setIsLoading(true);
      setMessage(null);

      const response = await fetch(`/api/invites/${invitationId}?token=${token}`);

      if (response.ok) {
        const data = await response.json();
        setInvitationData(data.invitation);
      } else if (response.status === 410) {
        const error = await response.json();
        setMessage({
          type: 'error',
          text: error.message || 'This invitation is no longer valid.',
        });
      } else {
        const error = await response.json();
        setMessage({
          type: 'error',
          text: error.message || 'Failed to load invitation',
        });
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load invitation details. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, invitationId]);

  useEffect(() => {
    if (!token || !invitationId) {
      setMessage({
        type: 'error',
        text: 'Invalid invitation link. Missing required information.',
      });
      setIsLoading(false);
      return;
    }
    fetchInvitationData();
  }, [token, invitationId, fetchInvitationData]);

  const handleInvitationResponse = async (action: 'accept' | 'reject') => {
    if (!token) return;

    // Redirect to sign in if not authenticated, then come back here
    if (authStatus === 'unauthenticated') {
      const callbackUrl = `/invites/${invitationId}?token=${token}`;
      await signIn('central-auth', { callbackUrl }, { prompt: 'login' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/invites/${invitationId}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || `Invitation ${action}ed successfully!`,
        });

        if (invitationData) {
          setInvitationData({
            ...invitationData,
            status: action === 'accept' ? 'ACCEPTED' : 'REJECTED',
          });
        }

        setTimeout(() => {
          if (action === 'accept') {
            router.push('/chatbots');
          } else {
            router.push('/');
          }
        }, 2000);
      } else if (response.status === 409 && data.status === 'ALREADY_MEMBER') {
        setMessage({
          type: 'error',
          text: data.message || 'You are already a member of this workspace.',
        });
        if (invitationData) {
          setInvitationData({ ...invitationData, status: 'ACCEPTED' });
        }
      } else {
        setMessage({
          type: 'error',
          text: data.message || `Failed to ${action} invitation`,
        });
      }
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
      setMessage({
        type: 'error',
        text: `An error occurred while ${action}ing the invitation`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Missing token or invitation ID
  if (!token || !invitationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center space-x-2 text-destructive">
              <XCircle className="h-6 w-6" />
              <span>Invalid Invitation</span>
            </CardTitle>
            <CardDescription className="text-center">
              This invitation link is missing required information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')} className="w-full">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invitation already processed (not pending)
  if (invitationData && invitationData.status !== 'PENDING') {
    const isAccepted = invitationData.status === 'ACCEPTED';
    const isExpired = invitationData.status === 'EXPIRED';
    const isRevoked = invitationData.status === 'REVOKED';
    const isRejected = invitationData.status === 'REJECTED';
    const isActuallyExpired = new Date(invitationData.expiresAt) < new Date();

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center space-x-2">
              {isAccepted ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span>Invitation Accepted</span>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-destructive" />
                  <span>
                    {isExpired
                      ? 'Invitation Expired'
                      : isRevoked
                      ? 'Invitation Revoked'
                      : isRejected
                      ? 'Invitation Declined'
                      : 'Invitation Processed'}
                  </span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-center">
              {isAccepted
                ? 'You have already accepted this invitation.'
                : isExpired || isActuallyExpired
                ? 'This invitation has expired. Please request a new one.'
                : isRevoked
                ? 'This invitation has been revoked by the sender.'
                : isRejected
                ? 'You have declined this invitation.'
                : `This invitation has been ${invitationData.status.toLowerCase()}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitationData.workspace && (
              <div className="mb-4 p-4 rounded-lg border bg-card">
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{invitationData.workspace.name}</p>
                    <p className="text-sm text-muted-foreground">Workspace</p>
                  </div>
                </div>
              </div>
            )}
            <Button onClick={() => router.push(isAccepted ? '/chatbots' : '/')} className="w-full">
              {isAccepted ? 'Go to Dashboard' : 'Go to Homepage'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main — pending invitation
  const isSignedIn = authStatus === 'authenticated';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold">Workspace Invitation</CardTitle>
          <CardDescription className="text-center">
            You&apos;ve been invited to join a workspace
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {invitationData && (
            <div className="space-y-4">
              {/* Workspace Info */}
              <div className="rounded-lg border p-4 bg-card">
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold text-lg">{invitationData.workspace.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Role:{' '}
                      <span className="font-medium capitalize">
                        {invitationData.role.toLowerCase()}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Inviter Info */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Invited by</p>
                    <p className="text-sm text-muted-foreground">
                      {invitationData.invitedBy.name} ({invitationData.invitedBy.email})
                    </p>
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Invited on:</span>
                    <span>{new Date(invitationData.createdAt).toLocaleDateString()}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Expires:</span>
                    <span>{new Date(invitationData.expiresAt).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-primary">
                  By accepting this invitation, you&apos;ll gain access to this workspace&apos;s
                  chatbots, knowledge bases, and collaboration features as a{' '}
                  <span className="font-semibold capitalize">
                    {invitationData.role.toLowerCase()}
                  </span>
                  .
                </p>
              </div>

              {/* Sign-in notice for unauthenticated users */}
              {!isSignedIn && authStatus !== 'loading' && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    You&apos;ll be asked to sign in before accepting this invitation.
                  </p>
                </div>
              )}

              {/* Signed-in as notice */}
              {isSignedIn && session?.user && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm text-muted-foreground">
                    Signed in as{' '}
                    <span className="font-medium text-foreground">{session.user.email}</span>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => handleInvitationResponse('accept')}
                  disabled={isProcessing || authStatus === 'loading'}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : isSignedIn ? (
                    'Accept Invitation'
                  ) : (
                    'Sign in to Accept'
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleInvitationResponse('reject')}
                  disabled={isProcessing || authStatus === 'loading'}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Declining...
                    </>
                  ) : (
                    'Decline Invitation'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
