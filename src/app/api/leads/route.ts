// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BaseApiRoute, ApiError } from '@/lib/api/base-api';

class LeadsRoute extends BaseApiRoute {
  // Allow POST to skip auth (public endpoint)
  protected skipAuth(): boolean {
    return this.request.method === 'POST';
  }

  // POST /api/leads - Public lead submission
  protected async POST(): Promise<NextResponse> {
    const body = await this.request.json();
    const { data, formId, chatbotId, conversationId } = body;

    // Validation
    if (!formId || !data) {
      throw new ApiError(400, 'Missing required fields');
    }

    const chatbotForm = await this.dbOperation(() =>
      prisma.chatbotForm.findUnique({
        where: { id: formId },
      })
    );

    if (!chatbotForm) {
      throw new ApiError(404, 'Form not found');
    }

    // Advanced validation logic...
    const errors: Record<string, string> = {};
    const fields = (chatbotForm.fields as any[]) || [];
    const normalizedData: Record<string, any> = {};

    for (const field of fields) {
      const value = data[field.id] ?? data[field.label];
      
      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.id] = `${field.label} is required`;
      }
      
      if (value !== undefined) {
        normalizedData[field.id] = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      return this.json({ error: 'Validation failed', errors }, 400);
    }

    // Check duplicate submissions
    if (conversationId) {
      const existingLead = await this.dbOperation(() =>
        prisma.lead.findFirst({
          where: { chatbotId, conversationId },
        })
      );

      if (existingLead) {
        throw new ApiError(400, 'A lead has already been submitted for this conversation.');
      }
    }

    // Create lead
    const lead = await this.dbOperation(() =>
      prisma.lead.create({
        data: {
          formId,
          chatbotId,
          data: normalizedData,
          conversationId,
        },
      })
    );

    // Link to conversation
    if (conversationId) {
      await this.dbOperation(() =>
        prisma.conversation.update({
          where: { id: conversationId },
          data: { leadId: lead.id },
        })
      );
    }

    // Notifications
    if (chatbotForm.notifyEmail) {
      console.log('Notification triggered for:', chatbotForm.notifyEmail);
    }

    return this.json({
      success: true,
      leadId: lead.id,
      successMessage: chatbotForm.successMessage || "Thank you! We'll be in touch soon.",
      redirectUrl: chatbotForm.redirectUrl,
      autoClose: chatbotForm.autoClose,
      showThankYou: chatbotForm.showThankYou,
    });
  }

  // GET /api/leads - Fetch leads (requires auth)
  protected async GET(): Promise<NextResponse> {
    const { searchParams } = new URL(this.request.url);
    const chatbotId = searchParams.get('chatbotId');
    const workspaceId = searchParams.get('workspaceId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const skip = (page - 1) * limit;

    const whereClause: any = {
      chatbot: {
        workspace: { members: { some: { userId: this.currentUser.id } } },
      },
    };

    if (workspaceId) whereClause.chatbot.workspaceId = workspaceId;
    if (chatbotId) whereClause.chatbotId = chatbotId;

    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    // Server-side search across the JSON data field (using raw contains on the JSON string)
    // We do this via a raw OR condition on related chatbot name
    if (search) {
      whereClause.OR = [
        { chatbot: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [leads, total] = await Promise.all([
      this.dbOperation(() =>
        prisma.lead.findMany({
          where: whereClause,
          include: {
            chatbot: {
              select: {
                id: true,
                name: true,
                workspace: { select: { id: true, name: true } },
              },
            },
            form: true,
            conversation: {
              select: {
                id: true,
                messages: {
                  take: 1,
                  orderBy: { createdAt: 'asc' },
                  select: { content: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        })
      ),
      this.dbOperation(() => prisma.lead.count({ where: whereClause })),
    ]);

    // Client-side search filter on the JSON data field (for name/email/phone matches)
    const filteredLeads = search
      ? leads.filter((l) => {
          const dataStr = JSON.stringify(l.data).toLowerCase();
          return dataStr.includes(search.toLowerCase());
        })
      : leads;

    return this.json({
      leads: filteredLeads.map((l) => ({
        ...l,
        conversationPreview: l.conversation?.messages?.[0]?.content?.substring(0, 100) || '',
      })),
      pagination: {
        page,
        limit,
        total: search ? filteredLeads.length : total,
        totalPages: Math.ceil((search ? filteredLeads.length : total) / limit),
      },
    });
  }

  // DELETE /api/leads - Delete lead (requires auth)
  protected async DELETE(): Promise<NextResponse> {
    const { searchParams } = new URL(this.request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      throw new ApiError(400, 'leadId is required');
    }

    await this.dbOperation(() =>
      prisma.lead.delete({ where: { id: leadId } })
    );

    return this.json({ success: true });
  }
}

// Export handlers
const route = new LeadsRoute();
export const POST = (req: NextRequest) => route.handle(req, { params: Promise.resolve({}) });
export const GET = (req: NextRequest) => route.handle(req, { params: Promise.resolve({}) });
export const DELETE = (req: NextRequest) => route.handle(req, { params: Promise.resolve({}) });