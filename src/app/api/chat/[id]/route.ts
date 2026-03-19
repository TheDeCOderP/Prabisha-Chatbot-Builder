import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma';
import { upload } from '@/lib/cloudinary'

interface RouterParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id } = await context.params;

    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
      include: {
        theme: true,
        form: true,
        logic: true
      }
    })

    if (!chatbot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
    }

    return NextResponse.json(chatbot)
  } catch (error) {
    console.error('Error fetching chatbot:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: RouterParams) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    
    // 1. Extract Chatbot Fields
    const name = formData.get('name') as string | null;
    const description = formData.get('description') as string | null;
    const directive = formData.get('directive') as string | null;
    const model = formData.get('model') as string | null;
    const temperature = formData.get('temperature') as string | null;
    const popup_onload = formData.get('popup_onload') as string | null;
    
    // JSON fields need parsing from string if sent via FormData
    const greeting = formData.get('greeting') as string | null;
    const suggestions = formData.get('suggestions') as string | null;

    // Files
    const avatarFile = formData.get('avatar') as File | null;
    const iconFile = formData.get('icon') as File | null;

    // 2. Handle File Uploads
    let avatarUrl: string | undefined;
    if (avatarFile && avatarFile.size > 0) {
      avatarUrl = await upload(avatarFile, 'chatbot-avatars');
    }

    let iconUrl: string | undefined;
    if (iconFile && iconFile.size > 0) {
      iconUrl = await upload(iconFile, 'chatbot-icons');
    }

    // 3. Prepare Update Data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== null) updateData.description = description;
    if (directive) updateData.directive = directive;
    if (model) updateData.model = model;
    if (temperature) updateData.temperature = parseFloat(temperature);
    if (popup_onload !== null) updateData.popup_onload = popup_onload === 'true';
    if (avatarUrl) updateData.avatar = avatarUrl;
    if (iconUrl) updateData.icon = iconUrl;

    // Parse JSON arrays safely
    if (greeting) {
      try { updateData.greeting = JSON.parse(greeting); } catch (e) { console.error("Greeting parse error", e) }
    }
    if (suggestions) {
      try { updateData.suggestions = JSON.parse(suggestions); } catch (e) { console.error("Suggestions parse error", e) }
    }

    // 4. Update Database
    const updatedChatbot = await prisma.chatbot.update({
      where: { id },
      data: updateData,
      include: { theme: true }
    });

    return NextResponse.json({ 
      message: 'Chatbot updated successfully',
      chatbot: updatedChatbot 
    });

  } catch (error) {
    console.error('Error updating chatbot', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouterParams) {
  try {
    const { id } = await context.params;

    // Transaction ensures all related data is wiped safely
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversation: { chatbotId: id } } }),
      prisma.lead.deleteMany({ where: { chatbotId: id } }),
      prisma.documentVector.deleteMany({ where: { chatbotId: id } }), // Added as per your new schema
      prisma.document.deleteMany({ where: { knowledgeBase: { chatbotId: id } } }),
      prisma.conversation.deleteMany({ where: { chatbotId: id } }),
      prisma.knowledgeBase.deleteMany({ where: { chatbotId: id } }),
      prisma.chatbotForm.deleteMany({ where: { chatbotId: id } }),
      prisma.chatbotLogic.deleteMany({ where: { chatbotId: id } }),
      prisma.chatbotTheme.deleteMany({ where: { chatbotId: id } }), // Added cleanup for theme
      prisma.chatbot.delete({ where: { id } }),
    ]);

    return NextResponse.json({ message: 'Chatbot deleted successfully' });
  } catch (error) {
    console.error('Error deleting chatbot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}