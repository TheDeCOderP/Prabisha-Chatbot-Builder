import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    let workspaceId = searchParams.get('workspaceId') as string;

    // Get user with workspaces
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        workspaces: {
          include: {
            workspace: {
              include: {
                members: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const chatbots = await prisma.chatbot.findMany({
      where: {
        workspaceId
      },
      select: {
        id: true,
        serialNo: true,
        name: true,
        model: true,
        max_tokens: true,
        temperature: true,
        createdAt: true,
        updatedAt: true,
        icon: true,

        _count: {
          select: {
            conversations: true,
            knowledgeBases: true,
          },
        },
      },
    });

    return NextResponse.json(chatbots);
  } catch (error) {
    console.error('Error fetching chatbots:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/chatbots - Create a new chatbot with default form and logic
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, workspaceId } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Chatbot name is required' },
        { status: 400 }
      );
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // Get user to verify access to workspace
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        workspaces: {
          where: {
            workspaceId: workspaceId
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the workspace
    if (user.workspaces.length === 0) {
      return NextResponse.json(
        { error: 'User does not have access to this workspace' },
        { status: 403 }
      );
    }

    // Default form fields
    const defaultFormFields = [
      {
        id: "1",
        type: "TEXT" as const,
        label: "Full Name",
        required: true,
        placeholder: "Enter your full name",
        order: 0
      },
      {
        id: "2",
        type: "EMAIL" as const,
        label: "Email Address",
        required: true,
        placeholder: "Enter your email address",
        order: 1
      },
      {
        id: "3",
        type: "PHONE" as const,
        label: "Phone Number",
        required: false,
        placeholder: "Enter your phone number",
        order: 2
      },
      {
        id: "4",
        type: "TEXT" as const,
        label: "Company",
        required: false,
        placeholder: "Enter your company name",
        order: 3
      }
    ];

    // Default logic triggers
    const defaultTriggers = [
      {
        type: "KEYWORD" as const,
        keywords: ["help", "support", "contact"],
        position: 0
      },
      {
        type: "END_OF_CONVERSATION" as const,
        position: 1
      }
    ];

    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {

      const lastChatbot = await tx.chatbot.findFirst({
        where: { workspaceId },
        orderBy: { serialNo: "desc" },
        select: { serialNo: true }
      });

      const nextSerialNo = lastChatbot?.serialNo ? lastChatbot.serialNo + 1 : 1;
      // 1. Create the chatbot
      const chatbot = await tx.chatbot.create({
        data: {
          serialNo: nextSerialNo,
          name: name.trim(),
          directive: `
            # Objective: You are an exceptional customer support representative. Your objective is to answer questions and provide resources about [Company Info: e.g., name and brief description of business or project]. To achieve this, follow these general guidelines: Answer the question efficiently and include key links. If a question is not clear, ask follow-up questions.
            # Style: Your communication style should be friendly and professional. Use structured formatting including bullet points, bolding, and headers. Add emojis to make messages more engaging.
            # Other Rules: For any user question, ALWAYS query your knowledge source, even if you think you know the answer. Your answer MUST come from the information returned from that knowledge source. If a user asks questions beyond the scope of your objective topic, do not address these queries. Instead, kindly redirect to something you can help them with instead.
          `,
          workspaceId: workspaceId,
          // Default chatbot settings
          greeting: [
            {
              "en": "How can I help you today?",
              "ar": "كيف يمكنني مساعدتك اليوم؟",
              "fr": "Comment puis-je vous aider aujourd'hui ?",
              "es": "¿Cómo puedo ayudarte hoy?",
              "de": "Wie kann ich Ihnen heute helfen?",
              "pt": "Como posso ajudar hoje?",
              "it": "Come posso aiutarti oggi?",
              "nl": "Hoe kan ik je vandaag helpen?",
              "ru": "Чем я могу вам помочь сегодня?",
              "zh": "今天我能为您提供什么帮助？",
              "ja": "今日はどのようなご用件でしょうか？",
              "ko": "오늘 무엇을 도와드릴까요?",
              "hi": "आज मैं आपकी क्या मदद कर सकता हूँ?"
            }
          ],
          model: "gemini-1.5-flash",
          max_tokens: 500,
          temperature: 0.7,
          suggestions: [
            {
              "en": "How can I contact support?",
              "ar": "كيف يمكنني الاتصال بالدعم؟",
              "fr": "Comment puis-je contacter le support ?",
              "es": "¿Cómo puedo contactar con el soporte?",
              "de": "Wie kann ich den Support kontaktieren?",
              "pt": "Como posso contactar o suporte?",
              "it": "Come posso contattare l'assistenza?",
              "nl": "Hoe kan ik contact opnemen met de ondersteuning?",
              "ru": "Как я могу связаться со службой поддержки?",
              "zh": "如何联系客户支持？",
              "ja": "サポートへの問い合わせ方法を教えてください。",
              "ko": "고객 지원에 어떻게 문의하나요?",
              "hi": "मैं सहायता टीम से कैसे संपर्क कर सकता हूँ?"
            },
            {
              "en": "What are your business hours?",
              "ar": "ما هي ساعات العمل الخاصة بكم؟",
              "fr": "Quelles sont vos heures d'ouverture ?",
              "es": "¿Cuál es su horario comercial?",
              "de": "Was sind Ihre Geschäftszeiten?",
              "pt": "Qual é o seu horário de funcionamento?",
              "it": "Quali sono i vostri orari di apertura?",
              "nl": "Wat zijn uw openingstijden?",
              "ru": "Каков ваш график работы?",
              "zh": "您的营业时间是什么时候？",
              "ja": "営業時間を教えてください。",
              "ko": "영업 시간은 어떻게 되나요?",
              "hi": "आपके व्यवसाय के घंटे क्या हैं?"
            },
            {
              "en": "Can I schedule a demo?",
              "ar": "هل يمكنني تحديد موعد للعرض التجريبي؟",
              "fr": "Puis-je planifier une démonstration ?",
              "es": "¿Puedo programar una demostración?",
              "de": "Kann ich eine Demo vereinbaren?",
              "pt": "Posso agendar uma demonstração?",
              "it": "Posso prenotare una demo?",
              "nl": "Kan ik een demo inplannen?",
              "ru": "Могу ли я запланировать демо-презентацию?",
              "zh": "我可以预约演示吗？",
              "ja": "デモを予約することはできますか？",
              "ko": "데모 일정을 잡을 수 있을까요?",
              "hi": "क्या मैं डेमो शेड्यूल कर सकता हूँ?"
            }
          ]
        }
      });

      // 2. Create the default chatbot form
      const chatbotForm = await tx.chatbotForm.create({
        data: {
          title: "Get in touch",
          description: "We'd love to hear from you! Please fill out this form and we'll get back to you soon.",
          fields: defaultFormFields,
          leadTiming: "END",
          leadFormStyle: "EMBEDDED",
          cadence: "ALL_AT_ONCE",
          successMessage: "Thank you for your submission! We'll contact you within 24 hours.",
          autoClose: true,
          showThankYou: true,
          chatbotId: chatbot.id
        }
      });

      // 3. Create the default chatbot logic
      const chatbotLogic = await tx.chatbotLogic.create({
        data: {
          name: `${name.trim()} Logic`,
          description: `Logic configuration for ${name.trim()} chatbot`,
          isActive: true,
          leadCollectionEnabled: true,
          leadCollectionConfig: {
            enabled: true,
            formTitle: "Get in touch",
            formDesc: "We'd love to hear from you!",
            leadTiming: "END",
            leadFormStyle: "EMBEDDED",
            cadence: "ALL_AT_ONCE",
            fields: defaultFormFields,
            successMessage: "Thank you for your submission! We'll contact you within 24 hours.",
            autoClose: true,
            showThankYou: true,
            trigger: {
              type: "KEYWORD",
              keywords: ["help", "support", "contact"]
            }
          },
          linkButtonEnabled: false,
          meetingScheduleEnabled: false,
          triggers: defaultTriggers,
          chatbotId: chatbot.id
        }
      });

      return {
        chatbot,
        form: chatbotForm,
        logic: chatbotLogic
      };
    });

    return NextResponse.json(
      {
        message: 'Chatbot created successfully with default form and logic',
        chatbot: result.chatbot,
        form: result.form,
        logic: result.logic
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating chatbot:', error);

    // Handle specific Prisma errors
    if (error instanceof Error) {
      // Check for unique constraint violation
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A chatbot with this name already exists in this workspace' },
          { status: 409 }
        );
      }

      // Check for foreign key constraint (workspace not found)
      if (error.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}