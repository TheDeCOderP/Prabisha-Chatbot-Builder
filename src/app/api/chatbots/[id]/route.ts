import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import cloudinary, { upload } from '@/lib/cloudinary'

interface RouterParams {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouterParams
) {
  try {
    const { id } = await context.params;

    // Find the chatbot
    const chatbot = await prisma.chatbot.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        greeting: true,
        directive: true,
        theme: true,
        icon: true,
        iconSize: true,
        iconColor: true,
        iconShape: true,
        iconBorder: true,
        iconBgColor: true,
        avatar: true,
        avatarSize: true,
        avatarColor: true,
        avatarBorder: true,
        avatarBgColor: true,
        popup_onload: true,
      }
    })

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(chatbot)
  } catch (error) {
    console.error('Error fetching chatbot:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouterParams) {
  try {
    const { id } = await context.params;
    
    // Use FormData instead of JSON for file uploads
    const formData = await request.formData();
    
    // Extract fields from formData
    const name = formData.get('name') as string | null;
    const avatarFile = formData.get('avatar') as File | null;
    const iconFile = formData.get('icon') as File | null;
    const theme = formData.get('theme') as string | null;
    const iconSize = formData.get('iconSize') as string | null;
    const iconColor = formData.get('iconColor') as string | null;
    const iconShape = formData.get('iconShape') as string | null;
    const iconBorder = formData.get('iconBorder') as string | null;
    const iconBgColor = formData.get('iconBgColor') as string | null;
    const avatarSize = formData.get('avatarSize') as string | null;
    const avatarColor = formData.get('avatarColor') as string | null;
    const avatarBorder = formData.get('avatarBorder') as string | null;
    const avatarBgColor = formData.get('avatarBgColor') as string | null;
    const popup_onload = formData.get('popup_onload') as string | null;
    const greeting = formData.get('greeting') as string | null;
    const directive = formData.get('directive') as string | null;

    if (!id) {
      return NextResponse.json(
        { error: 'Chatbot ID is required' },
        { status: 400 }
      )
    }

    const existingChatbot = await prisma.chatbot.findUnique({
      where: { id },
    });

    if (!existingChatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    // Upload avatar to Cloudinary if provided
    let avatarUrl: string | undefined;
    if (avatarFile && avatarFile.size > 0) {
      try {
        avatarUrl = await upload(avatarFile, 'chatbot-avatars');
      } catch (error) {
        console.error('Error uploading avatar:', error);
        return NextResponse.json(
          { error: 'Failed to upload avatar image' },
          { status: 500 }
        );
      }
    }

    // Upload icon to Cloudinary if provided
    let iconUrl: string | undefined;
    if (iconFile && iconFile.size > 0) {
      try {
        iconUrl = await upload(iconFile, 'chatbot-icons');
      } catch (error) {
        console.error('Error uploading icon:', error);
        return NextResponse.json(
          { error: 'Failed to upload icon image' },
          { status: 500 }
        );
      }
    }

    // Validate iconShape and avatarBorder against the enum values
    const validIconShapes = ['ROUND', 'SQUARE', 'ROUNDED_SQUARE'];
    const validBorderTypes = ['FLAT', 'ROUND', 'ROUNDED_FLAT'];
    
    if (iconShape && !validIconShapes.includes(iconShape.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid iconShape. Must be one of: ${validIconShapes.join(', ')}` },
        { status: 400 }
      )
    }

    if (iconBorder && !validBorderTypes.includes(iconBorder.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid iconBorder. Must be one of: ${validBorderTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (avatarBorder && !validBorderTypes.includes(avatarBorder.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid avatarBorder. Must be one of: ${validBorderTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {};
    
    // Add only provided fields to update data
    if (name !== null) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatar = avatarUrl;
    if (theme !== null) updateData.theme = theme;
    if (iconUrl !== undefined) updateData.icon = iconUrl;
    if (iconSize !== null) updateData.iconSize = parseInt(iconSize);
    if (iconColor !== null) updateData.iconColor = iconColor;
    if (iconShape !== null) updateData.iconShape = iconShape.toUpperCase();
    if (iconBorder !== null) updateData.iconBorder = iconBorder.toUpperCase();
    if (iconBgColor !== null) updateData.iconBgColor = iconBgColor;
    if (avatarSize !== null) updateData.avatarSize = parseInt(avatarSize);
    if (avatarColor !== null) updateData.avatarColor = avatarColor;
    if (avatarBorder !== null) updateData.avatarBorder = avatarBorder.toUpperCase();
    if (avatarBgColor !== null) updateData.avatarBgColor = avatarBgColor;
    if (popup_onload !== null) updateData.popup_onload = popup_onload === 'true';
    if (greeting !== null) updateData.greeting = greeting;
    if (directive !== null) updateData.directive = directive;

    const updatedChatbot = await prisma.chatbot.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ 
      message: 'Chatbot updated successfully',
      chatbot: updatedChatbot 
    });
  } catch (error) {
    console.error('Error updating chatbot', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouterParams) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Chatbot ID is required' },
        { status: 400 }
      )
    }

    // Delete all related records first to avoid foreign key constraint issues
    await prisma.$transaction([
      // 1. Deeply nested records
      prisma.document.deleteMany({ where: { knowledgeBase: { chatbotId: id } } }),
      prisma.formField.deleteMany({ where: { leadCollection: { logic: { chatbotId: id } } } }),
      prisma.linkButton.deleteMany({ where: { logic: { chatbotId: id } } }),
      prisma.meetingSchedule.deleteMany({ where: { logic: { chatbotId: id } } }),
      prisma.leadCollection.deleteMany({ where: { logic: { chatbotId: id } } }),
      prisma.message.deleteMany({ where: { conversation: { chatbotId: id } } }),
      prisma.node.deleteMany({ where: { flow: { chatbotId: id } } }),
      prisma.edge.deleteMany({ where: { flow: { chatbotId: id } } }),
      
      // 2. Direct related records
      prisma.lead.deleteMany({ where: { chatbotId: id } }),
      prisma.leadForm.deleteMany({ where: { chatbotId: id } }),
      prisma.flow.deleteMany({ where: { chatbotId: id } }),
      prisma.conversation.deleteMany({ where: { chatbotId: id } }),
      prisma.knowledgeBase.deleteMany({ where: { chatbotId: id } }),
      prisma.logic.deleteMany({ where: { chatbotId: id } }),
      
      // 3. The chatbot itself
      prisma.chatbot.delete({ where: { id } }),
    ]);

    return NextResponse.json({
      message: 'Chatbot deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting chatbot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}