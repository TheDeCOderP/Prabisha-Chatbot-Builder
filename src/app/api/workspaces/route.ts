// app/api/workspaces/route.ts
import { NextRequest, NextResponse } from "next/server";
import { BaseApiRoute, NotFoundError } from "@/lib/api/base-api";
import { prisma } from "@/lib/prisma";

class WorkspacesRoute extends BaseApiRoute {
  protected async GET(): Promise<NextResponse> {
    const getWorkspaces = await this.dbOperation(
      () => prisma.workspaceMember.findMany({
        where: { userId: this.currentUser.id },
        include: { workspace: { select: { id: true, name: true, createdAt: true } } },
      }).then(memberships => memberships.map(m => ({
        id: m.workspaceId,
        name: m.workspace.name,
        role: m.role,
        createdAt: m.workspace.createdAt,
      }))),
      "Failed to fetch workspaces"
    );

    return this.json(getWorkspaces);
  }

  protected async POST(): Promise<NextResponse> {
    const json = await this.request.json();
    const { name } = json;

    if (!name || typeof name !== "string") {
      return this.json({ message: "Invalid workspace name" }, 400);
    }

    const createWorkspace = await this.dbOperation(
      () => prisma.workspace.create({
        data: {
          name,
          members: {
            create: {
              userId: this.currentUser.id,
              role: "OWNER",
            },
          },
        },
      }),
      "Failed to create workspace"
    );

    return this.json({
      id: createWorkspace.id,
      name: createWorkspace.name,
      createdAt: createWorkspace.createdAt,
    });
  }
}

export async function GET(request: NextRequest) {
  const route = new WorkspacesRoute();
  return route.handle(request, {});
}

export async function POST(request: NextRequest) {
  const route = new WorkspacesRoute();
  return route.handle(request, {});
}