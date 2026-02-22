import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface FormFieldJson {
  id: string;
  label: string;
  required: boolean;
  type: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, formId, chatbotId, conversationId } = body;

    // 1. Basic Validation
    if (!formId || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const chatbotForm = await prisma.chatbotForm.findUnique({
      where: { id: formId },
    });

    if (!chatbotForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // 2. Advanced Validation & Mapping
    // Since your frontend sends Labels (e.g., "Full Name") instead of IDs,
    // we map them here to ensure 'required' checks pass.
    const errors: Record<string, string> = {};
    const fields = (chatbotForm.fields as unknown as FormFieldJson[]) || [];
    const normalizedData: Record<string, any> = {};

    for (const field of fields) {
      // Check if data exists under the ID or the Label
      const value = data[field.id] !== undefined ? data[field.id] : data[field.label];
      
      if (field.required && (!value || value.toString().trim() === '')) {
        errors[field.id] = `${field.label} is required`;
      }
      
      // Store the value under the ID for consistent database storage
      if (value !== undefined) {
        normalizedData[field.id] = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
    }

    // 3. Prevent Duplicate Submissions for the same conversation
    if (conversationId) {
      const existingLead = await prisma.lead.findFirst({
        where: { chatbotId, conversationId },
      });

      if (existingLead) {
        return NextResponse.json(
          { error: 'A lead has already been submitted for this conversation.' },
          { status: 400 }
        );
      }
    }

    // 4. Create Lead
    const lead = await prisma.lead.create({
      data: {
        formId,
        chatbotId,
        data: normalizedData, // Storing mapped data
        conversationId,
      },
    });

    // 5. Link to Conversation
    if (conversationId) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { leadId: lead.id },
      });
    }

    // 6. Notifications (Logic remains the same)
    if (chatbotForm.notifyEmail) {
      console.log('Notification triggered for:', chatbotForm.notifyEmail);
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      successMessage: chatbotForm.successMessage || "Thank you! We'll be in touch soon.",
      redirectUrl: chatbotForm.redirectUrl,
      autoClose: chatbotForm.autoClose,
      showThankYou: chatbotForm.showThankYou,
    });

  } catch (error) {
    console.error('Lead Submission Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- GET and DELETE methods remain identical to your original provided code ---
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');
    const workspaceId = searchParams.get('workspaceId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    let whereClause: any = {
      chatbot: {
        workspace: { members: { some: { userId: user.id } } }
      }
    };

    if (workspaceId) whereClause.chatbot.workspaceId = workspaceId;
    if (chatbotId) whereClause.chatbotId = chatbotId;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where: whereClause,
        include: {
          chatbot: { select: { id: true, name: true, workspace: { select: { id: true, name: true } } } },
          form: true,
          conversation: {
            select: {
              messages: { take: 1, orderBy: { createdAt: 'asc' }, select: { content: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      leads: leads.map(l => ({
        ...l,
        conversationPreview: l.conversation?.messages?.[0]?.content?.substring(0, 100) || '',
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!session || !leadId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    await prisma.lead.delete({ where: { id: leadId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}