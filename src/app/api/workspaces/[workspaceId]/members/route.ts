// app/api/workspaces/[workspaceId]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouterParams {
  params: Promise<{ workspaceId: string }>
}

// GET /api/workspaces/[workspaceId]/members - Get all members of a workspace
export async function GET(
  request: NextRequest,
  { params }: RouterParams
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;

    // Check if user has access to this workspace
    const userWorkspace = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspaceId: workspaceId,
      },
    });

    if (!userWorkspace) {
      return NextResponse.json(
        { error: 'You do not have access to this workspace' },
        { status: 403 }
      );
    }

    // Get all members of the workspace with user details
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
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
    });

    // Transform to include createdAt from the member record
    const transformedMembers = members.map(member => ({
      id: member.id,
      role: member.role,
      userId: member.userId,
      workspaceId: member.workspaceId,
      user: member.user,
    }));

    return NextResponse.json(transformedMembers);
  } catch (error) {
    console.error('Error fetching workspace members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/[workspaceId]/members - Add a member to workspace (for existing users)
export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;
    const body = await request.json();
    const { email, role = 'MEMBER' } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!['OWNER', 'ADMIN', 'MEMBER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be OWNER, ADMIN, or MEMBER' },
        { status: 400 }
      );
    }

    // Check if current user has permission to add members
    const currentUserMember = await prisma.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        workspaceId,
      },
    });

    if (!currentUserMember) {
      return NextResponse.json(
        { error: 'You do not have access to this workspace' },
        { status: 403 }
      );
    }

    // Only OWNER and ADMIN can add members
    if (currentUserMember.role !== 'OWNER' && currentUserMember.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You do not have permission to add members' },
        { status: 403 }
      );
    }

    // Find the user to add
    const userToAdd = await prisma.user.findUnique({
      where: { email },
    });

    if (!userToAdd) {
      return NextResponse.json(
        { error: 'User not found. Please ask them to sign up first.' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        userId: userToAdd.id,
        workspaceId,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 409 }
      );
    }

    // Only OWNER can add another OWNER
    if (role === 'OWNER' && currentUserMember.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only workspace owners can add other owners' },
        { status: 403 }
      );
    }

    // Create workspace member
    const newMember = await prisma.workspaceMember.create({
      data: {
        userId: userToAdd.id,
        workspaceId,
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
    });

    return NextResponse.json(
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
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding workspace member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}