import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This will be called by a scheduled job
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Missing config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get all users with valid tokens
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .not('access_token', 'is', null)

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    let totalSynced = 0

    for (const user of users || []) {
      try {
        // Fetch killmails from ESI
        const killmails = await fetchCharacterKillmails(user.eve_character_id)
        
        // Store in database
        const inserted = await syncKillmails(supabase, user.id, killmails)
        totalSynced += inserted
      } catch (error) {
        console.error(`Error syncing killmails for user ${user.id}:`, error)
      }
    }

    return NextResponse.json({ 
      success: true, 
      totalSynced 
    })

  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}

// Helper: Fetch killmails from ESI API
async function fetchCharacterKillmails(characterId: number) {
  const response = await fetch(
    `https://esi.eveonline.com/latest/characters/${characterId}/killmails/recent/`,
    {
      headers: {
        'User-Agent': 'EVE-Personal-Killboard (Contact: your-email@example.com)'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`ESI API error: ${response.status}`)
  }

  return response.json()
}

// Helper: Sync killmails to database
async function syncKillmails(supabase: any, userId: number, killmails: any[]) {
  let inserted = 0

  for (const km of killmails) {
    try {
      // Fetch full killmail data from ESI
      const kmResponse = await fetch(
        `https://esi.eveonline.com/latest/killmails/${km.killmail_id}/${km.killmail_hash}/`
      )
      const kmData = await kmResponse.json()

      // Insert into database
      const { error } = await supabase
        .from('killmails')
        .insert({
          killmail_id: kmData.killmail_id,
          killmail_hash: kmData.killmail_hash,
          killmail_time: kmData.kill_time,
          victim_character_id: kmData.victim.character_id,
          victim_character_name: kmData.victim.character_name,
          victim_corporation_id: kmData.victim.corporation_id,
          victim_ship_type_id: kmData.victim.ship_type_id,
          attacker_count: kmData.attackers?.length || 0,
          solar_system_id: kmData.solar_system_id,
          raw_killmail: kmData
        })
        .select()

      if (error && error.code !== '23505') { // Ignore duplicates
        console.error('Insert error:', error)
      } else {
        inserted++
      }
    } catch (error) {
      console.error('Error processing killmail:', error)
    }
  }

  return inserted
}