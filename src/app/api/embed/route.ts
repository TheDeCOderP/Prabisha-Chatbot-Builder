// app/api/embed/route.ts
//
// DEPRECATED. This endpoint used to serve a second, divergent embed loader that did
// NOT read the chatbot's dashboard config (it only applied a postMessage theme, always
// rendered a 💬 emoji button, and hard-coded the iframe origin from an env var that can
// be undefined at the edge). That caused "my config doesn't apply on the website" bugs.
//
// The canonical loader is now `/embed.js` (public/embed.js) which fetches the live DB
// config, supports all embed modes, icons, styling and voice. We permanently redirect
// here so any old snippet pointing at `/api/embed` transparently loads the correct
// script instead of the broken duplicate.
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL('/embed.js', request.nextUrl.origin);
  return NextResponse.redirect(url, 308);
}
