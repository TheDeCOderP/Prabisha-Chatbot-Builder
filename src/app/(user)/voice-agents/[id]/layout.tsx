"use client"

import React from 'react';
import { usePathname } from 'next/navigation';
import VoiceAgentPreview from '@/components/features/voice-agent-preview';

function VoiceAgentLayoutContent({ children, agentId }: { children: React.ReactNode, agentId: string }) {
    return (
        <div className='flex w-full max-h-[calc(100vh-7rem)] h-full'>
            {/* Left Column: Settings (Renders your page.tsx) */}
            <div className="w-full lg:w-1/2 border-r border-border overflow-y-auto no-scrollbar pr-4">
                {children}
            </div>

            {/* Right Column: AI Voice Orb Preview */}
            <div className="hidden lg:flex lg:flex-col w-1/2 relative bg-muted/10 rounded-r-xl overflow-hidden shadow-inner border-l border-border">
                {/* The glowing orb component */}
                <div className="flex-1 flex items-center justify-center">
                    <VoiceAgentPreview  agentId={agentId} />
                </div>
            </div>
        </div>
    );
}

export default function VoiceAgentLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    
    // Extract agent ID from the pathname (e.g., /voice-agents/12345)
    const extractVoiceAgentIdFromPathname = (path: string): string | null => {
        const match = path.match(/^\/voice-agents\/([^\/]+)/);
        return match ? match[1] : null;
    };
    
    const agentId = extractVoiceAgentIdFromPathname(pathname);

    // Safeguard in case the pathname doesn't contain a valid ID
    if (!agentId) {
        console.error('Could not extract agent ID from pathname:', pathname);
        return <div className="p-6">Error: Invalid voice agent URL</div>;
    }

    return (
        // If you create a VoiceAgentProvider in the future to share state between the layout and the orb, wrap it here
        <VoiceAgentLayoutContent agentId={agentId}>
            {children}
        </VoiceAgentLayoutContent>
    )
}