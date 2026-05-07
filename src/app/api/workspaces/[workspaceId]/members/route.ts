// app/api/workspaces/[workspaceId]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BaseApiRoute, ApiError, ForbiddenError } from '@/lib/api/base-api';

interface RouterParams {
  params: Promise<{ workspaceId: string }>
}

class WorkspaceMembersRoute extends BaseApiRoute {
  private workspaceId!: string;

  async handle(request: NextRequest, { params }: RouterParams): Promise<NextResponse> {
    // Extract workspaceId before calling super.handle
    const resolvedParams = await params;
    this.workspaceId = resolvedParams.workspaceId;
    return super.handle(request, { params });
  }

  // GET /api/workspaces/[workspaceId]/members - Get all members of a workspace
  protected async GET(): Promise<NextResponse> {
    // Check if user has access to this workspace
    const userWorkspace = await this.dbOperation(() =>
      prisma.workspaceMember.findFirst({
        where: {
          userId: this.currentUser.id,
          workspaceId: this.workspaceId,
        },
      })
    );

    if (!userWorkspace) {
      throw new ForbiddenError('You do not have access to this workspace');
    }

    // Get all members of the workspace with user details
    const members = await this.dbOperation(() =>
      prisma.workspaceMember.findMany({
        where: { workspaceId: this.workspaceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // OWNER, ADMIN, MEMBER
        ],
      })
    );

    // Transform to include createdAt from the member record
    const transformedMembers = members.map(member => ({
      id: member.id,
      role: member.role,
      userId: member.userId,
      workspaceId: member.workspaceId,
      user: member.user,
    }));

    return this.json(transformedMembers);
  }

  // POST /api/workspaces/[workspaceId]/members - Add a member to workspace (for existing users)
  protected async POST(): Promise<NextResponse> {
    const body = await this.request.json();
    const { email, role = 'MEMBER' } = body;

    if (!email || typeof email !== 'string') {
      throw new ApiError(400, 'Email is required');
    }

    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
      throw new ApiError(400, 'Invalid role. Must be OWNER, ADMIN, or MEMBER');
    }

    // Check if current user has permission to add members
    const currentUserMember = await this.dbOperation(() =>
      prisma.workspaceMember.findFirst({
        where: {
          userId: this.currentUser.id,
          workspaceId: this.workspaceId,
        },
      })
    );

    if (!currentUserMember) {
      throw new ForbiddenError('You do not have access to this workspace');
    }

    // Only OWNER and ADMIN can add members
    if (currentUserMember.role !== 'OWNER' && currentUserMember.role !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to add members');
    }

    // Find the user to add
    const userToAdd = await this.dbOperation(() =>
      prisma.user.findUnique({
        where: { email },
      })
    );

    if (!userToAdd) {
      throw new ApiError(404, 'User not found. Please ask them to sign up first.');
    }

    // Check if user is already a member
    const existingMember = await this.dbOperation(() =>
      prisma.workspaceMember.findFirst({
        where: {
          userId: userToAdd.id,
          workspaceId: this.workspaceId,
        },
      })
    );

    if (existingMember) {
      throw new ApiError(409, 'User is already a member of this workspace');
    }

    // Only OWNER can add another OWNER
    if (role === 'OWNER' && currentUserMember.role !== 'OWNER') {
      throw new ForbiddenError('Only workspace owners can add other owners');
    }

    // Create workspace member
    const newMember = await this.dbOperation(() =>
      prisma.workspaceMember.create({
        data: {
          userId: userToAdd.id,
          workspaceId: this.workspaceId,
          role: role as 'OWNER' | 'ADMIN' | 'MEMBER',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
      })
    );

    return this.json(
      {
        message: 'Member added successfully',
        member: {
          id: newMember.id,
          role: newMember.role,
          userId: newMember.userId,
          workspaceId: newMember.workspaceId,
          user: newMember.user,
        },
      },
      201
    );
  }
}

// Export route handlers
const route = new WorkspaceMembersRoute();
export const GET = (req: NextRequest, { params }: RouterParams) => route.handle(req, { params });
export const POST = (req: NextRequest, { params }: RouterParams) => route.handle(req, { params });