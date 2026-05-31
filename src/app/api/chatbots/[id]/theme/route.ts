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
console.log('Received theme update request:', { chatbotId, body });
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

    const themeData = {
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
      // Custom position
      widgetCustomPosition: body.widgetCustomPosition,
      widgetTop: body.widgetTop ?? null,
      widgetBottom: body.widgetBottom ?? null,
      widgetLeft: body.widgetLeft ?? null,
      widgetRight: body.widgetRight ?? null,
      // Window size
      windowWidth: body.windowWidth,
      windowHeight: body.windowHeight,
      // Window style
      windowBorderRadius: body.windowBorderRadius,
      fontSize: body.fontSize,
      // Feature toggles
      showPoweredBy: body.showPoweredBy,
      showMic: body.showMic,
      showEmoji: body.showEmoji,
      showTTS: body.showTTS,
      showNewChat: body.showNewChat,
      showLanguageSwitcher: body.showLanguageSwitcher,
      // Lead card
      leadCardMessage: body.leadCardMessage,
      // Window theme colors
      messageBgColor: body.messageBgColor,
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
    };

    // Update or create theme
    const theme = await prisma.chatbotTheme.upsert({
      where: { chatbotId },
      update: themeData,
      create: { chatbotId, ...themeData },
    });

    return NextResponse.json({ theme });
  } catch (error) {
    console.error('Error updating theme:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
