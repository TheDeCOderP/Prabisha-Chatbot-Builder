import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/crypto';

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // 1. Validation
  if (!code || !state) {
    return NextResponse.redirect(new URL('/accounts?error=missing_auth_data', origin));
  }

  try {
    const { chatbotId, returnUrl } = JSON.parse(decodeURIComponent(state));
    
    if(!chatbotId) {
      return NextResponse.redirect(new URL('/accounts?error=invalid_state', origin));
    }

    let accessToken: string;
    let refreshToken: string | null = null;
    let expiresAt: Date | null = null;
    let profileData: { id: string; name: string; image?: string | null } = { id: '', name: '' };

    // This MUST match exactly what you have in the Meta/LinkedIn Dashboards
    const redirectUri = `${origin}/api/connect/${platform}/callback`;

    // 2. Platform Specific Exchange Logic
    if (platform === 'facebook' || platform === 'instagram') {
      const isInstagram = platform === 'instagram';
      const tokenHost = isInstagram ? 'api.instagram.com' : 'graph.facebook.com';
      
      // Step A: Exchange for short-lived token
      // FIX: Added 'grant_type' which was the cause of your error
      const tokenRes = await fetch(`https://${tokenHost}/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: isInstagram ? process.env.INSTAGRAM_CLIENT_ID! : process.env.FACEBOOK_CLIENT_ID!,
          client_secret: isInstagram ? process.env.INSTAGRAM_CLIENT_SECRET! : process.env.FACEBOOK_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          code,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData.error_message || tokenData.error?.message || "Short-lived token exchange failed");
      }

      // Step B: Exchange for long-lived token (60 days)
      const longLivedHost = isInstagram ? 'graph.instagram.com' : 'graph.facebook.com';
      const exchangeType = isInstagram ? 'ig_exchange_token' : 'fb_exchange_token';
      const secret = isInstagram ? process.env.INSTAGRAM_CLIENT_SECRET! : process.env.FACEBOOK_CLIENT_SECRET!;
      const clientId = isInstagram ? process.env.INSTAGRAM_CLIENT_ID! : process.env.FACEBOOK_CLIENT_ID!;

      const llRes = await fetch(
        `https://${longLivedHost}/access_token?grant_type=${exchangeType}&client_id=${clientId}&client_secret=${secret}&${exchangeType}=${tokenData.access_token}`
      );
      
      const llData = await llRes.json();
      
      accessToken = llData.access_token || tokenData.access_token;
      // Default to 60 days if expires_in isn't provided
      const expiresIn = llData.expires_in || 5184000; 
      expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Step C: Fetch Profile
      const profileUrl = isInstagram 
        ? `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
        : `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`;
      
      const pRes = await fetch(profileUrl);
      const pData = await pRes.json();
      profileData = {
        id: pData.id,
        name: pData.username || pData.name || 'Unknown User',
        image: null
      };

    } else if (platform === 'linkedin') {
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_PAGES_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_PAGES_CLIENT_SECRET!,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error_description || "LinkedIn token exchange failed");

      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token || null;
      expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

      const pRes = await fetch("https://api.linkedin.com/v2/me", {
        headers: { 
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0"
        },
      });
      
      const pData = await pRes.json();
      
      if (!pRes.ok) {
        throw new Error(`LinkedIn Profile Error: ${pRes.statusText}`);
      }

      profileData = {
        id: pData.id,
        name: `${pData.localizedFirstName} ${pData.localizedLastName}`.trim() || 'LinkedIn User',
        image: null
      };
    } else {
      throw new Error("Unsupported platform");
    }

    // 3. Encrypt and Upsert into Connections Model
    const encryptedAccess = await encryptToken(accessToken);
    const encryptedRefresh = refreshToken ? await encryptToken(refreshToken) : null;

    await prisma.connections.upsert({
      where: {
        platform_platformUserId: {
          platform: platform.toUpperCase() as any,
          platformUserId: profileData.id,
        },
      },
      update: {
        chatbotId, 
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        platformUsername: profileData.name,
        platformUserImage: profileData.image,
        lastSyncedAt: new Date(),
      },
      create: {
        chatbotId,
        platform: platform.toUpperCase() as any,
        platformUserId: profileData.id,
        platformUsername: profileData.name,
        platformUserImage: profileData.image,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
      },
    });

    // 4. Final Redirect
    const successUrl = new URL(returnUrl || '/accounts', origin);
    successUrl.searchParams.set('success', 'true');
    successUrl.searchParams.set('platform', platform);
    return NextResponse.redirect(successUrl.toString());

  } catch (error: any) {
    console.error(`${platform} Callback Error Details:`, error);
    const errorUrl = new URL('/accounts', origin);
    errorUrl.searchParams.set('error', 'connection_failed');
    errorUrl.searchParams.set('message', error.message || 'Unknown error');
    return NextResponse.redirect(errorUrl.toString());
  }
}