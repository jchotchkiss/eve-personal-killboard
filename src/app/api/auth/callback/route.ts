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
    console.log('Attempting to upsert user via REST API:', characterData.CharacterID)

    // Use Supabase REST API directly instead of SDK
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const restApiUrl = `${supabaseUrl}/rest/v1/users?eve_character_id=eq.${characterData.CharacterID}`

    // First try to update
    const updateResponse = await fetch(restApiUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        eve_character_name: characterData.CharacterName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      })
    })

    console.log('Update response status:', updateResponse.status)

    if (updateResponse.status === 204 || updateResponse.status === 200) {
      // Rows were updated
      console.log('User updated successfully')
    } else if (updateResponse.status === 404) {
      // No rows found, insert new user
      console.log('User not found, inserting new user')
      
      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          eve_character_id: characterData.CharacterID,
          eve_character_name: characterData.CharacterName,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        })
      })

      if (insertResponse.status !== 201) {
        const errorText = await insertResponse.text()
        console.error('Insert failed:', insertResponse.status, errorText)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=database_error`)
      }
    } else {
      const errorText = await updateResponse.text()
      console.error('Update failed:', updateResponse.status, errorText)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=database_error`)
    }

    console.log('User saved successfully:', characterData.CharacterID)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`)

  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=auth_failed`)
  }
}
