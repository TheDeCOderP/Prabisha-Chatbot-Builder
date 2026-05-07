// lib/api/base-route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../generated/prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Resource not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export abstract class BaseApiRoute {
  protected request!: NextRequest;
  protected params!: Record<string, string>;
  protected session!: any;
  protected currentUser!: any;

  // Main handler with automatic error catching
  async handle(request: NextRequest, { params }: any): Promise<NextResponse> {
    try {
      this.request = request;
      this.params = await params;
      
      // Auto-authenticate for all routes
      await this.authenticate();
      
      // Route to specific HTTP method handler
      switch (request.method) {
        case "GET":
          return await this.GET();
        case "POST":
          return await this.POST();
        case "PUT":
          return await this.PUT();
        case "PATCH":
          return await this.PATCH();
        case "DELETE":
          return await this.DELETE();
        default:
          throw new ApiError(405, `Method ${request.method} not allowed`);
      }
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Auto-authentication
  protected async authenticate() {
    this.session = await getServerSession(authOptions);
    if (!this.session?.user?.email) {
      throw new UnauthorizedError();
    }

    this.currentUser = await prisma.user.findUnique({
      where: { email: this.session.user.email },
    });

    if (!this.currentUser) {
      throw new NotFoundError("User not found");
    }
  }

  // Helper for database operations with error handling
  protected async dbOperation<T>(
    operation: () => Promise<T>,
    errorMessage?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2025":
            throw new NotFoundError(errorMessage || "Record not found");
          case "P2002":
            throw new ApiError(409, "Duplicate entry", "DUPLICATE");
          default:
            throw new ApiError(500, "Database error");
        }
      }
      throw error;
    }
  }

  // JSON response helper
  protected json(data: any, status: number = 200): NextResponse {
    return NextResponse.json(data, { status });
  }

  // Error handler
  protected handleError(error: unknown): NextResponse {
    console.error(`[${this.constructor.name}] Error:`, error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }

  // Abstract methods to be implemented by child classes
  protected async GET(): Promise<NextResponse> {
    throw new ApiError(405, "GET method not implemented");
  }

  protected async POST(): Promise<NextResponse> {
    throw new ApiError(405, "POST method not implemented");
  }

  protected async PUT(): Promise<NextResponse> {
    throw new ApiError(405, "PUT method not implemented");
  }

  protected async PATCH(): Promise<NextResponse> {
    throw new ApiError(405, "PATCH method not implemented");
  }

  protected async DELETE(): Promise<NextResponse> {
    throw new ApiError(405, "DELETE method not implemented");
  }
}