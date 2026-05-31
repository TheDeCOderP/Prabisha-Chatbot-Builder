// GDPR Art. 17 — Right to Erasure
// DELETE /api/account  → permanently deletes the calling user's account and all
// associated data (workspaces where they are the sole owner, chatbots, leads,
// conversations, knowledge bases, invitations).
//
// If the user is the sole OWNER of a workspace they must transfer ownership or
// delete the workspace first.  This prevents orphaned workspaces.

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = token.sub;

    // ── Safety check: block deletion if user is the sole OWNER of any workspace ──
    const ownedWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId, role: 'OWNER' },
      select: { workspaceId: true },
    });

    const blockedWorkspaces: string[] = [];

    for (const { workspaceId } of ownedWorkspaces) {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        // This user is the last owner — deletion would orphan the workspace
        const ws = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        });
        blockedWorkspaces.push(ws?.name ?? workspaceId);
      }
    }

    if (blockedWorkspaces.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete account',
          reason:
            'You are the sole owner of one or more workspaces. ' +
            'Please transfer ownership or delete them before deleting your account.',
          workspaces: blockedWorkspaces,
        },
        { status: 409 }
      );
    }

    // ── Delete all user data in a transaction ──────────────────────────────────
    await prisma.$transaction(async (tx) => {
      // 1. Remove workspace memberships (cascades handle most child data)
      await tx.workspaceMember.deleteMany({ where: { userId } });

      // 2. Revoke all pending invitations sent by this user
      await tx.workspaceInvitation.updateMany({
        where: { invitedById: userId, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      // 3. Nullify accepted invitation references (keep audit trail, remove PII link)
      await tx.workspaceInvitation.updateMany({
        where: { invitedToId: userId },
        data: { invitedToId: null, email: null },
      });

      // 4. Delete the user record itself
      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json(
      { message: 'Account and all associated data deleted successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again or contact support.' },
      { status: 500 }
    );
  }
}

// GET /api/account — return a summary of what data will be deleted (data preview)
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = token.sub;

    const [memberships, sentInvites, receivedInvites] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { userId },
        include: {
          workspace: {
            select: {
              name: true,
              _count: { select: { chatbots: true } },
            },
          },
        },
      }),
      prisma.workspaceInvitation.count({ where: { invitedById: userId, status: 'PENDING' } }),
      prisma.workspaceInvitation.count({ where: { invitedToId: userId } }),
    ]);

    return NextResponse.json({
      summary: {
        workspaceMemberships: memberships.length,
        workspacesOwned: memberships.filter((m) => m.role === 'OWNER').length,
        pendingInvitesSent: sentInvites,
        invitationsReceived: receivedInvites,
        workspaces: memberships.map((m) => ({
          name: m.workspace.name,
          role: m.role,
          chatbotCount: m.workspace._count.chatbots,
        })),
      },
    });
  } catch (error) {
    console.error('Account data preview error:', error);
    return NextResponse.json({ error: 'Failed to fetch account data' }, { status: 500 });
  }
}
