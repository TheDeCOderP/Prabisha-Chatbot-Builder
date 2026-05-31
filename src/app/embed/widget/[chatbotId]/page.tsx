// app/embed/widget/[chatbotId]/page.tsx
import { notFound } from 'next/navigation';
import ChatbotWidget from '@/components/features/chatbot-widget';

interface PageProps {
  params: Promise<{
    chatbotId: string;
  }>;
}

export default async function WidgetPage({ params }: PageProps) {
  const { chatbotId } = await params;

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/chatbots/${chatbotId}`,
      { next: { tags: [`chatbot-config-${chatbotId}`], revalidate: 600 } }
    );

    if (!response.ok) {
      notFound();
    }

    const chatbot = await response.json();

    return <ChatbotWidget initialChatbotData={chatbot} chatbotId={chatbotId} />;
  } catch {
    notFound();
  }
}