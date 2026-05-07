// app/api/invites/[invitationId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BaseApiRoute, ApiError, ForbiddenError } from '@/lib/api/base-api';

interface RouteParams {
  params: Promise<{ invitationId: string }>
}

class InvitationDetailRoute extends BaseApiRoute {
  private invitationId!: string;
  private token!: string;

  async handle(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
    // Extract URL params before calling super
    const resolvedParams = await params;
    this.invitationId = resolvedParams.invitationId;
    
    // Extract token from query params
    const { searchParams } = new URL(request.url);
    this.token = searchParams.get('token') || '';
    
    return super.handle(request, { params });
  }

  // GET is public - anyone with valid token can view
  protected skipAuth(): boolean {
    return this.request.method === 'GET';
  }

  // GET /api/invites/[invitationId] - View invitation details (public)
  protected async GET(): Promise<NextResponse> {
    if (!this.token) {
      throw new ApiError(400, 'Token is required');
    }

    const now = new Date();
    
    const invitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.findUnique({
        where: { 
          id: this.invitationId,
          token: this.token,
          expiresAt: { gt: now },
          status: 'PENDING'
        },
        include: {
          workspace: {
            select: { id: true, name: true, createdAt: true },
          },
          invitedBy: {
            select: { id: true, name: true, email: true, image: true },
          },
          invitedTo: {
            select: { id: true, name: true, email: true, image: true },
          },
          member: {
            select: {
              id: true,
              role: true,
              user: {
                select: { id: true, name: true, email: true, image: true },
              }
            }
          }
        },
      })
    );

    if (!invitation) {
      // Check for expired invitation
      const expiredInvitation = await this.dbOperation(() =>
        prisma.workspaceInvitation.findFirst({
          where: {
            id: this.invitationId,
            token: this.token,
            expiresAt: { lte: now }
          }
        })
      );

      if (expiredInvitation) {
        await this.dbOperation(() =>
          prisma.workspaceInvitation.update({
            where: { id: this.invitationId },
            data: { status: 'EXPIRED' }
          })
        );
        
        throw new ApiError(410, 'Invitation has expired', 'EXPIRED');
      }

      // Check other statuses
      const statusChecks = ['REVOKED', 'ACCEPTED'] as const;
      for (const status of statusChecks) {
        const invitationWithStatus = await this.dbOperation(() =>
          prisma.workspaceInvitation.findFirst({
            where: {
              id: this.invitationId,
              token: this.token,
              status
            }
          })
        );

        if (invitationWithStatus) {
          throw new ApiError(410, `Invitation has been ${status.toLowerCase()}`, status);
        }
      }

      throw new ApiError(404, 'Invalid or not found invitation');
    }

    // Build response
    const responseData = {
      id: invitation.id,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
      role: invitation.role,
      email: invitation.email,
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
        createdAt: invitation.workspace.createdAt,
      },
      invitedBy: {
        id: invitation.invitedBy.id,
        name: invitation.invitedBy.name,
        email: invitation.invitedBy.email,
        image: invitation.invitedBy.image,
      },
      invitedTo: invitation.invitedTo ? {
        id: invitation.invitedTo.id,
        name: invitation.invitedTo.name,
        email: invitation.invitedTo.email,
        image: invitation.invitedTo.image,
      } : null,
      member: invitation.member ? {
        id: invitation.member.id,
        role: invitation.member.role,
        user: {
          id: invitation.member.user.id,
          name: invitation.member.user.name,
          email: invitation.member.user.email,
          image: invitation.member.user.image,
        }
      } : null,
      createdAt: invitation.createdAt,
    };

    return this.json({ invitation: responseData });
  }

  // DELETE /api/invites/[invitationId] - Revoke invitation (requires auth)
  protected async DELETE(): Promise<NextResponse> {
    const invitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.findUnique({
        where: { id: this.invitationId },
        include: { workspace: true }
      })
    );

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found');
    }

    // Check if current user is the inviter OR workspace admin/owner
    const isInviter = invitation.invitedById === this.currentUser.id;
    
    if (!isInviter) {
      const workspaceMember = await this.dbOperation(() =>
        prisma.workspaceMember.findFirst({
          where: {
            userId: this.currentUser.id,
            workspaceId: invitation.workspaceId,
            role: { in: ['OWNER', 'ADMIN'] }
          }
        })
      );

      if (!workspaceMember) {
        throw new ForbiddenError('You do not have permission to revoke this invitation');
      }
    }

    const updatedInvitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.update({
        where: { id: this.invitationId },
        data: { status: 'REVOKED' },
        include: {
          workspace: { select: { name: true } }
        }
      })
    );

    return this.json({ 
      message: 'Invitation revoked successfully',
      workspaceName: updatedInvitation.workspace.name
    });
  }

  // POST /api/invites/[invitationId] - Respond to invitation (requires auth)
  protected async POST(): Promise<NextResponse> {
    const { action } = await this.request.json();

    if (!this.token) {
      throw new ApiError(400, 'Token is required');
    }

    if (!['accept', 'reject'].includes(action)) {
      throw new ApiError(400, 'Invalid action. Must be "accept" or "reject"');
    }

    const now = new Date();
    const invitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.findUnique({
        where: { 
          id: this.invitationId,
          token: this.token,
          expiresAt: { gt: now },
          status: 'PENDING'
        },
        include: {
          workspace: true,
          invitedTo: true
        }
      })
    );

    if (!invitation) {
      throw new ApiError(404, 'Invalid, expired, or already processed invitation');
    }

    const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
    
    // Update invitation status
    const updatedInvitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.update({
        where: { id: this.invitationId },
        data: { status }
      })
    );

    if (action === 'accept') {
      try {
        await this.dbOperation(() =>
          prisma.workspaceMember.create({
            data: {
              userId: this.currentUser.id,
              workspaceId: invitation.workspaceId,
              role: 'MEMBER',
              invitations: { connect: { id: this.invitationId } }
            }
          })
        );
      } catch (error: any) {
        if (error.message?.includes('Unique constraint')) {
          throw new ApiError(409, 'You are already a member of this workspace', 'ALREADY_MEMBER');
        }
        throw error;
      }
    }

    return this.json({ 
      message: `Invitation ${action}ed successfully`,
      status,
      workspaceId: invitation.workspaceId
    });
  }
}

// Export handlers
const route = new InvitationDetailRoute();
export const GET = (req: NextRequest, { params }: RouteParams) => route.handle(req, { params });
export const DELETE = (req: NextRequest, { params }: RouteParams) => route.handle(req, { params });
export const POST = (req: NextRequest, { params }: RouteParams) => route.handle(req, { params });