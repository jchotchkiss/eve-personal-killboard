import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code`)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.EVE_CLIENT_ID}:${process.env.EVE_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=authorization_code&code=${code}`
    })

    const tokens = await tokenResponse.json()

    // Verify character
    const verifyResponse = await fetch('https://login.eveonline.com/oauth/verify', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    })

    const characterData = await verifyResponse.json()
    console.log('Character authenticated:', characterData.CharacterName)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Use Supabase RPC with correct headers
    const upsertUrl = `${supabaseUrl}/rest/v1/rpc/upsert_user`

    const upsertResponse = await fetch(upsertUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceRoleKey || '',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_eve_character_id: characterData.CharacterID,
        p_eve_character_name: characterData.CharacterName,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token,
        p_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      })
    })

    console.log('Upsert response status:', upsertResponse.status)

    if (!upsertResponse.ok) {
      const responseText = await upsertResponse.text()
      console.error('Upsert failed:', upsertResponse.status, responseText.substring(0, 200))
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=database_error`)
    }

    // Don't parse JSON for VOID responses (status 204)
    if (upsertResponse.status === 204) {
      console.log('Upsert successful (VOID response)')
    } else {
      const upsertData = await upsertResponse.json()
      console.log('Upsert successful:', upsertData)
    }

    console.log('Redirecting to dashboard')
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`)

  } catch (error) {
    console.error('Auth error:', error instanceof Error ? error.message : String(error))
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=auth_failed`)
  }
}
