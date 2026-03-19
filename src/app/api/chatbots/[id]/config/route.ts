// app/api/chatbots/[chatbotId]/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouterParams {
  params: Promise<{id: string}>
}

export async function GET(
  request: NextRequest,
  context: RouterParams
) {
  try {
    // Get chatbot by ID
    const { id } = await context.params;

    const chatbot = await prisma.chatbot.findUnique({
      where: {
        id: id,
      },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  }
                }
              }
            }
          }
        },
        form: true,
        knowledgeBases: {
          select: {
            id: true,
            name: true,
            type: true,
          }
        },
        logic: { // Changed from 'logics' to 'logic' (singular, 1:1 relationship)
          include: {
            // No longer need to include separate models as they're consolidated
            // into JSON fields in ChatbotLogic
          }
        }
      }
    });

    if (!chatbot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    // Parse suggestions if they exist
    let suggestions: string[] = [];
    if (chatbot.suggestions) {
      try {
        suggestions = Array.isArray(chatbot.suggestions) 
          ? chatbot.suggestions 
          : JSON.parse(chatbot.suggestions as string);
      } catch (error) {
        console.error('Error parsing suggestions:', error);
      }
    }

    // Parse logic configurations
    let leadCollectionConfig = null;
    let linkButtonConfig = null;
    let meetingScheduleConfig = null;
    let triggers: any[] = [];

    if (chatbot.logic) {
      // Parse JSON configs
      try {
        if (chatbot.logic.leadCollectionConfig && typeof chatbot.logic.leadCollectionConfig === 'string') {
          leadCollectionConfig = JSON.parse(chatbot.logic.leadCollectionConfig);
        }
        if (chatbot.logic.linkButtonConfig && typeof chatbot.logic.linkButtonConfig === 'string') {
          linkButtonConfig = JSON.parse(chatbot.logic.linkButtonConfig);
        }
        if (chatbot.logic.meetingScheduleConfig && typeof chatbot.logic.meetingScheduleConfig === 'string') {
          meetingScheduleConfig = JSON.parse(chatbot.logic.meetingScheduleConfig);
        }
        if (chatbot.logic.triggers && typeof chatbot.logic.triggers === 'string') {
          triggers = JSON.parse(chatbot.logic.triggers);
        }
      } catch (error) {
        console.error('Error parsing logic configurations:', error);
      }
    }

    // Format response
    const response = {
      id: chatbot.id,
      name: chatbot.name,
      description: chatbot.description,
      greeting: chatbot.greeting,
      suggestions,
      icon: chatbot.icon,
      avatar: chatbot.avatar,
      popup_onload: chatbot.popup_onload,
      directive: chatbot.directive,
      model: chatbot.model,
      max_tokens: chatbot.max_tokens,
      temperature: chatbot.temperature,
      createdAt: chatbot.createdAt,
      updatedAt: chatbot.updatedAt,
      
      // Workspace info
      workspace: {
        id: chatbot.workspace.id,
        name: chatbot.workspace.name,
      },
      
      // Lead form
      leadForm: chatbot.form ? {
        id: chatbot.form.id,
        title: chatbot.form.title,
        description: chatbot.form.description,
        fields: chatbot.form.fields,
        leadTiming: chatbot.form.leadTiming,
        leadFormStyle: chatbot.form.leadFormStyle,
        cadence: chatbot.form.cadence,
        successMessage: chatbot.form.successMessage,
        redirectUrl: chatbot.form.redirectUrl,
        autoClose: chatbot.form.autoClose,
        showThankYou: chatbot.form.showThankYou,
        notifyEmail: chatbot.form.notifyEmail,
        webhookUrl: chatbot.form.webhookUrl,
      } : null,
      
      // Knowledge bases
      knowledgeBases: chatbot.knowledgeBases.map(kb => ({
        id: kb.id,
        name: kb.name,
        type: kb.type,
      })),
      
      // Logic configuration (consolidated)
      logic: chatbot.logic ? {
        id: chatbot.logic.id,
        name: chatbot.logic.name,
        description: chatbot.logic.description,
        isActive: chatbot.logic.isActive,
        
        // Feature configurations
        leadCollectionEnabled: chatbot.logic.leadCollectionEnabled,
        leadCollectionConfig,
        
        linkButtonEnabled: chatbot.logic.linkButtonEnabled,
        linkButtonConfig,
        
        meetingScheduleEnabled: chatbot.logic.meetingScheduleEnabled,
        meetingScheduleConfig,
        
        // Triggers
        triggers,
        
        createdAt: chatbot.logic.createdAt,
        updatedAt: chatbot.logic.updatedAt,
      } : null,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching chatbot config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chatbot configuration' },
      { status: 500 }
    );
  }
}