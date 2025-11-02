import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code`)
  }

  try {
    // Create Supabase client with SERVICE ROLE KEY (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=config_error`)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

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

    // Store user in database
    console.log('Attempting to upsert user:', characterData.CharacterID)
    
    const { error } = await supabase
      .from('users')
      .upsert({
        eve_character_id: characterData.CharacterID,
        eve_character_name: characterData.CharacterName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      }, {
        onConflict: 'eve_character_id'
      })

    if (error) {
      console.error('Database error:', {
        code: error.code,
        message: error.message,
        details: error.details
      })
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=database_error`)
    }

    console.log('User upserted successfully:', characterData.CharacterID)

    // Redirect to dashboard
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`)

  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=auth_failed`)
  }
}
