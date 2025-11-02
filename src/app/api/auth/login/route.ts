import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authUrl = `https://login.eveonline.com/v2/oauth/authorize/` +
    `?response_type=code` +
    `&redirect_uri=${encodeURIComponent(process.env.EVE_CALLBACK_URL!)}` +
    `&client_id=${process.env.EVE_CLIENT_ID}` +
    `&scope=esi-killmails.read_killmails.v1` +
    `&state=${Math.random().toString(36).substring(7)}`

  return NextResponse.redirect(authUrl)
}