// app/api/invites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { BaseApiRoute, ApiError, ForbiddenError } from '@/lib/api/base-api';
import { InvitationStatus, WorkspaceRole } from '../../../../generated/prisma/enums';
import { sendMail } from '@/services/mailing.service';
import { createWorkspaceInvitationEmail } from '@/services/email-template';

class InvitesRoute extends BaseApiRoute {
  // GET /api/invites - Get all invitations (sent and received, all statuses)
  protected async GET(): Promise<NextResponse> {
    const [sentInvites, receivedInvites] = await Promise.all([
      // All invitations sent by the current user
      this.dbOperation(() =>
        prisma.workspaceInvitation.findMany({
          where: { invitedById: this.currentUser.id },
          include: {
            workspace: { select: { id: true, name: true } },
            invitedTo: { select: { id: true, name: true, email: true, image: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      ),
      // All invitations received by the current user
      this.dbOperation(() =>
        prisma.workspaceInvitation.findMany({
          where: {
            OR: [
              { invitedToId: this.currentUser.id },
              { email: this.currentUser.email },
            ],
          },
          include: {
            workspace: { select: { id: true, name: true } },
            invitedBy: { select: { id: true, name: true, email: true, image: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      ),
    ]);

    return this.json({ sent: sentInvites, received: receivedInvites });
  }

  // PUT /api/invites - Respond to an invitation (accept/reject)
  protected async PUT(): Promise<NextResponse> {
    const { invitationToken, status } = await this.request.json();

    if (!invitationToken || !status) {
      throw new ApiError(400, 'Invalid request. invitationToken and status are required.');
    }

    if (!Object.values(InvitationStatus).includes(status)) {
      throw new ApiError(400, 'Invalid status value');
    }

    // Check if invitation exists and belongs to current user
    const invitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.findFirst({
        where: {
          token: invitationToken,
          invitedToId: this.currentUser.id,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        include: { workspace: true }
      })
    );

    if (!invitation) {
      throw new ApiError(404, 'Invitation not found, expired, or already processed');
    }

    // Update invitation status
    const updatedInvitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.update({
        where: { token: invitationToken },
        data: { status }
      })
    );

    // If accepting, add user to workspace using the role stored on the invitation
    if (status === InvitationStatus.ACCEPTED) {
      try {
        const existingMember = await this.dbOperation(() =>
          prisma.workspaceMember.findFirst({
            where: {
              userId: this.currentUser.id,
              workspaceId: invitation.workspaceId
            }
          })
        );

        if (existingMember) {
          await this.dbOperation(() =>
            prisma.workspaceInvitation.update({
              where: { token: invitationToken },
              data: { memberId: existingMember.id }
            })
          );

          return this.json({
            message: 'You are already a member of this workspace',
            invitation: updatedInvitation,
            isAlreadyMember: true
          });
        }

        // Role comes from the invitation record, not the request body
        const workspaceMember = await this.dbOperation(() =>
          prisma.workspaceMember.create({
            data: {
              userId: this.currentUser.id,
              workspaceId: invitation.workspaceId,
              role: invitation.role,
            }
          })
        );

        await this.dbOperation(() =>
          prisma.workspaceInvitation.update({
            where: { token: invitationToken },
            data: { memberId: workspaceMember.id }
          })
        );

        return this.json({ 
          message: 'Successfully joined workspace',
          invitation: updatedInvitation,
          workspaceMember: {
            id: workspaceMember.id,
            role: workspaceMember.role,
            workspaceId: workspaceMember.workspaceId,
            workspaceName: invitation.workspace.name
          }
        });

      } catch (error: any) {
        if (error.message?.includes('Unique constraint')) {
          return this.json({ 
            message: 'You are already a member of this workspace',
            invitation: updatedInvitation,
            isAlreadyMember: true
          }, 409);
        }
        throw error;
      }
    }

    // If rejecting, just update status
    return this.json({ 
      message: `Invitation ${status.toLowerCase()}`,
      invitation: updatedInvitation
    });
  }

  // POST /api/invites - Create a new invitation
  protected async POST(): Promise<NextResponse> {
    const { workspaceId, email, role = 'MEMBER' } = await this.request.json();
    
    if (!workspaceId || !email) {
      throw new ApiError(400, 'workspaceId and email are required');
    }

    // Check if user has permission to invite to this workspace
    const isAuthorized = await this.dbOperation(() =>
      prisma.workspaceMember.findFirst({
        where: {
          userId: this.currentUser.id,
          workspaceId: workspaceId,
          role: {
            in: ['OWNER', 'ADMIN']
          }
        }
      })
    );

    if (!isAuthorized) {
      throw new ForbiddenError('You do not have permission to invite users to this workspace');
    }

    // Find if user exists
    const userToInvite = await this.dbOperation(() =>
      prisma.user.findUnique({
        where: { email }
      })
    );

    // Check if user is already a member
    if (userToInvite) {
      const existingMember = await this.dbOperation(() =>
        prisma.workspaceMember.findFirst({
          where: {
            userId: userToInvite.id,
            workspaceId: workspaceId
          }
        })
      );

      if (existingMember) {
        throw new ApiError(409, 'User is already a member of this workspace');
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.findFirst({
        where: {
          workspaceId: workspaceId,
          OR: [
            { email: email },
            { invitedToId: userToInvite?.id || null }
          ],
          status: 'PENDING',
          expiresAt: {
            gt: new Date()
          }
        }
      })
    );

    if (existingInvitation) {
      return this.json({ 
        message: 'A pending invitation already exists for this user/email',
        invitation: existingInvitation
      }, 409);
    }

    // Get workspace details and inviter info
    const workspace = await this.dbOperation(() =>
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true }
      })
    );

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Cryptographically secure 32-byte token — replaces the insecure Math.random() approach
    const invitationToken = randomBytes(32).toString('hex');

    const invitationData: any = {
      workspaceId: workspaceId,
      invitedById: this.currentUser.id,
      status: 'PENDING',
      token: invitationToken,
      expiresAt: expiresAt,
      role: role as WorkspaceRole
    };

    if (userToInvite) {
      invitationData.invitedToId = userToInvite.id;
    } else {
      invitationData.email = email;
    }

    const invitation = await this.dbOperation(() =>
      prisma.workspaceInvitation.create({
        data: invitationData,
        include: {
          workspace: {
            select: { name: true }
          }
        }
      })
    );

    // Send invitation email (fire and forget - don't block on errors)
    try {
      const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL}/invites/${invitation.id}?token=${invitationToken}`;
      
      const emailHtml = createWorkspaceInvitationEmail(
        workspace?.name || 'Workspace',
        this.currentUser.name || this.currentUser.email || 'A team member',
        invitationLink,
        expiresAt,
        role,
      );

      await sendMail({
        recipient: email,
        subject: userToInvite 
          ? `📬 You're invited to join "${workspace?.name}" workspace`
          : `📬 Register to join "${workspace?.name}" workspace`,
        message: emailHtml,
      });

      // Send confirmation to inviter
      const statusText = userToInvite ? 'invited' : 'sent a registration link to';
      const inviterEmailHtml = `
        <p>Hi ${this.currentUser.name || 'there'},</p>
        <p>You've successfully ${statusText} <strong>${email}</strong> to join the workspace <strong>"${workspace?.name}"</strong>.</p>
        <p>The invitation expires on ${expiresAt.toLocaleDateString()}.</p>
        <p>You can track invitation status from your dashboard.</p>
      `;

      await sendMail({
        recipient: this.currentUser.email,
        subject: `✅ Invitation sent to ${email}`,
        message: inviterEmailHtml,
      });

    } catch (emailError) {
      // Don't throw - email failure shouldn't break the invitation
      console.error('Failed to send invitation email:', emailError);
    }

    return this.json({ 
      message: userToInvite ? 'Invitation sent successfully' : 'Registration invitation sent successfully',
      invitation: invitation,
      userExists: !!userToInvite
    }, 201);
  }
}

// Export handlers
const route = new InvitesRoute();
export const GET = (req: NextRequest) => route.handle(req, { params: Promise.resolve({}) });
export const PUT = (req: NextRequest) => route.handle(req, { params: Promise.resolve({}) });
export const POST = (req: NextRequest) => route.handle(req, { params: Promise.resolve({}) });