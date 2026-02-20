import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

// GET - Fetch chatbot theme
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: chatbotId } = await params;

    // Verify user has access to this chatbot
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        workspace: {
          members: {
            some: {
              userId: token.sub,
            },
          },
        },
      },
      include: {
        theme: true,
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    return NextResponse.json({ theme: chatbot.theme });
  } catch (error) {
    console.error('Error fetching theme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update chatbot theme
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req });
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: chatbotId } = await params;
    const body = await req.json();

    // Verify user has access to this chatbot
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        workspace: {
          members: {
            some: {
              userId: token.sub,
            },
          },
        },
      },
      include: {
        theme: true,
      },
    });

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    // Update or create theme
    const theme = await prisma.chatbotTheme.upsert({
      where: {
        chatbotId: chatbotId,
      },
      update: {
        // Widget settings
        widgetIcon: body.widgetIcon,
        widgetIconType: body.widgetIconType,
        widgetText: body.widgetText,
        widgetSize: body.widgetSize,
        widgetSizeMobile: body.widgetSizeMobile,
        widgetColor: body.widgetColor,
        widgetShape: body.widgetShape,
        widgetBorder: body.widgetBorder,
        widgetBgColor: body.widgetBgColor,
        widgetPosition: body.widgetPosition,
        widgetPadding: body.widgetPadding,
        widgetMargin: body.widgetMargin,
        popup_onload: body.popup_onload,
        // Window theme colors
        headerBgColor: body.headerBgColor,
        headerTextColor: body.headerTextColor,
        botMessageBgColor: body.botMessageBgColor,
        botMessageTextColor: body.botMessageTextColor,
        userMessageBgColor: body.userMessageBgColor,
        userMessageTextColor: body.userMessageTextColor,
        inputBgColor: body.inputBgColor,
        inputBorderColor: body.inputBorderColor,
        inputButtonColor: body.inputButtonColor,
        closeButtonColor: body.closeButtonColor,
        closeButtonBgColor: body.closeButtonBgColor,
        quickSuggestionBgColor: body.quickSuggestionBgColor,
        quickSuggestionTextColor: body.quickSuggestionTextColor,
      },
      create: {
        chatbotId: chatbotId,
        // Widget settings
        widgetIcon: body.widgetIcon,
        widgetIconType: body.widgetIconType,
        widgetText: body.widgetText,
        widgetSize: body.widgetSize,
        widgetSizeMobile: body.widgetSizeMobile,
        widgetColor: body.widgetColor,
        widgetShape: body.widgetShape,
        widgetBorder: body.widgetBorder,
        widgetBgColor: body.widgetBgColor,
        widgetPosition: body.widgetPosition,
        widgetPadding: body.widgetPadding,
        widgetMargin: body.widgetMargin,
        popup_onload: body.popup_onload,
        // Window theme colors
        headerBgColor: body.headerBgColor,
        headerTextColor: body.headerTextColor,
        botMessageBgColor: body.botMessageBgColor,
        botMessageTextColor: body.botMessageTextColor,
        userMessageBgColor: body.userMessageBgColor,
        userMessageTextColor: body.userMessageTextColor,
        inputBgColor: body.inputBgColor,
        inputBorderColor: body.inputBorderColor,
        inputButtonColor: body.inputButtonColor,
        closeButtonColor: body.closeButtonColor,
        closeButtonBgColor: body.closeButtonBgColor,
        quickSuggestionBgColor: body.quickSuggestionBgColor,
        quickSuggestionTextColor: body.quickSuggestionTextColor,
      },
    });

    return NextResponse.json({ theme });
  } catch (error) {
    console.error('Error updating theme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
