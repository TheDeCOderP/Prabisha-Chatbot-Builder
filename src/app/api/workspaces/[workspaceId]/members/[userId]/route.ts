import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BaseApiRoute, ApiError, ForbiddenError, NotFoundError } from '@/lib/api/base-api';

interface RouterParams {
  params: Promise<{ workspaceId: string; userId: string }>;
}

class WorkspaceMemberDetailRoute extends BaseApiRoute {
  private workspaceId!: string;
  private targetUserId!: string;

  async handle(request: NextRequest, { params }: RouterParams): Promise<NextResponse> {
    const resolved = await params;
    this.workspaceId = resolved.workspaceId;
    this.targetUserId = resolved.userId;
    return super.handle(request, { params });
  }

  private async requireCallerRole(allowedRoles: ('OWNER' | 'ADMIN' | 'MEMBER')[]) {
    const callerMember = await prisma.workspaceMember.findFirst({
      where: { userId: this.currentUser.id, workspaceId: this.workspaceId },
    });
    if (!callerMember) throw new ForbiddenError('You are not a member of this workspace');
    if (!allowedRoles.includes(callerMember.role as any)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    return callerMember;
  }

  // PATCH /api/workspaces/[workspaceId]/members/[userId] — update role
  protected async PATCH(): Promise<NextResponse> {
    const callerMember = await this.requireCallerRole(['OWNER', 'ADMIN']);

    const { role } = await this.request.json();
    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
      throw new ApiError(400, 'Invalid role');
    }

    // Only OWNER can assign OWNER role
    if (role === 'OWNER' && callerMember.role !== 'OWNER') {
      throw new ForbiddenError('Only workspace owners can assign the Owner role');
    }

    const target = await prisma.workspaceMember.findFirst({
      where: { userId: this.targetUserId, workspaceId: this.workspaceId },
    });
    if (!target) throw new NotFoundError('Member not found in this workspace');

    // Prevent demoting the last OWNER
    if (target.role === 'OWNER' && role !== 'OWNER') {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: this.workspaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new ApiError(400, 'Cannot demote the last owner of a workspace');
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    return this.json({ message: 'Role updated', member: updated });
  }

  // DELETE /api/workspaces/[workspaceId]/members/[userId] — remove member
  protected async DELETE(): Promise<NextResponse> {
    const callerMember = await this.requireCallerRole(['OWNER', 'ADMIN']);

    const target = await prisma.workspaceMember.findFirst({
      where: { userId: this.targetUserId, workspaceId: this.workspaceId },
    });
    if (!target) throw new NotFoundError('Member not found in this workspace');

    // Only OWNER can remove another OWNER
    if (target.role === 'OWNER' && callerMember.role !== 'OWNER') {
      throw new ForbiddenError('Only workspace owners can remove other owners');
    }

    // Prevent removing the last OWNER
    if (target.role === 'OWNER') {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId: this.workspaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new ApiError(400, 'Cannot remove the last owner of a workspace');
      }
    }

    await prisma.workspaceMember.delete({ where: { id: target.id } });

    return this.json({ message: 'Member removed successfully' });
  }
}

const route = new WorkspaceMemberDetailRoute();
export const PATCH = (req: NextRequest, ctx: RouterParams) => route.handle(req, ctx);
export const DELETE = (req: NextRequest, ctx: RouterParams) => route.handle(req, ctx);
