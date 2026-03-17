"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Facebook, Instagram, Linkedin, Plus, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Manage pages and post content.',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    description: 'Schedule posts and manage comments.',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    description: 'Connect with your professional network.',
  }
]

export default function ConnectionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const chatbotId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);

  // Fetch existing connections from your backend
  const fetchConnections = useCallback(async () => {
    if (!chatbotId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/connect?chatbotId=${chatbotId}`);
      const data = await res.json();
      if (data.success) {
        setConnections(data.connections);
      }
    } catch (error) {
      toast.error("Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, [chatbotId]);

  useEffect(() => {
    fetchConnections();
    
    // Check for success URL params from the callback redirect
    if (searchParams.get('success') === 'true') {
      toast.success(`${searchParams.get('platform')} connected successfully!`);
    }
  }, [fetchConnections, searchParams]);

  const handleConnect = (platformId: string) => {
    if (!chatbotId) {
      toast.error("Please select a chatbot first");
      return;
    }

    // Build state object - ensured it matches your callback route logic
    const state = encodeURIComponent(JSON.stringify({
      chatbotId: chatbotId,
      returnUrl: window.location.pathname
    }));

    // Redirect to unified auth route
    window.location.href = `/api/connect/${platformId}/auth?chatbotId=${chatbotId}&state=${state}`;
  }

  const isConnected = (platformId: string) => {
    return connections.find(c => c.platform.toLowerCase() === platformId.toLowerCase());
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Social Connections</h1>
            <p className="text-muted-foreground mt-1">
              Link your social media profiles to enable AI-powered automation.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchConnections} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </div>

      {!chatbotId ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground/60 mb-4" />
            <h3 className="text-xl font-semibold">No Chatbot Context</h3>
            <p className="text-sm text-muted-foreground max-w-[250px] text-center mt-2">
              Select a chatbot from the dashboard to configure its social media reach.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
          {PLATFORMS.map((platform) => {
            const connection = isConnected(platform.id);
            
            return (
              <Card key={platform.id} className="relative flex flex-col transition-all hover:border-primary/50">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className={`p-3 rounded-xl ${platform.bgColor} ${platform.color}`}>
                    <platform.icon size={28} />
                  </div>
                  {connection && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-2 py-1">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </CardHeader>
                
                <CardContent className="flex-1">
                  <CardTitle className="text-xl mb-1">{platform.name}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {platform.description}
                  </CardDescription>
                  
                  {connection && (
                    <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Account</p>
                      <p className="text-sm font-semibold truncate">{connection.platformUsername || 'Active Session'}</p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2">
                  {connection ? (
                    <div className="flex w-full gap-2">
                       <Button 
                        variant="secondary" 
                        className="w-full"
                        onClick={() => handleConnect(platform.id)}
                      >
                        Reconnect
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      className="w-full shadow-sm" 
                      onClick={() => handleConnect(platform.id)}
                      disabled={loading}
                    >
                      {loading ? <Skeleton className="h-4 w-20" /> : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Connect {platform.name}
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  )
}