import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

type PlatformConfig = {
  authUrl: string;
  clientId: string | undefined;
  scopes: string[];
  scopeSeparator: string;
};

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    clientId: process.env.LINKEDIN_PAGES_CLIENT_ID,
    scopeSeparator: ',',
    scopes: [
      'r_basicprofile',
      'w_organization_social',
      'rw_organization_admin',
      'r_organization_social',
      'r_member_postAnalytics',
      'r_organization_social_feed',
      'w_organization_social_feed'
    ],
  },
  instagram: {
    authUrl: 'https://www.instagram.com/oauth/authorize',
    clientId: process.env.INSTAGRAM_CLIENT_ID,
    scopeSeparator: ',',
    scopes: [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
      'instagram_business_content_publish'
    ],
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    clientId: process.env.FACEBOOK_CLIENT_ID,
    scopeSeparator: ',',
    scopes: [
      'pages_show_list',
      'business_management',
      'pages_read_engagement',
      'pages_manage_posts'
    ],
  }
};

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];

  // 1. Validate Platform
  if (!config) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  // 2. Authentication Check (NextAuth)
  const token = await getToken({ req });
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const chatbotId = req.nextUrl.searchParams.get('chatbotId');
    const returnUrl = req.nextUrl.searchParams.get('returnUrl') || `chatbots/${chatbotId}/connections`;

    // 3. Build Redirect URI
    // Uses NEXTAUTH_URL for consistency across environments
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUri = `${baseUrl}/api/connect/${platform}/callback`;

    // 4. Construct State
    const state = JSON.stringify({ chatbotId, returnUrl });

    // 5. Build Final Auth URL
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.append('client_id', config.clientId || '');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', config.scopes.join(config.scopeSeparator));
    authUrl.searchParams.append('state', state);

    // Optional: Add platform specific params if needed
    if (platform === 'facebook' || platform === 'instagram') {
       // Add specific FB/IG params here if required in the future
    }

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error(`Error in ${platform} authentication:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}