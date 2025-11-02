import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { characterId, characterName } = await request.json()

    if (!characterId || !characterName) {
      return NextResponse.json(
        { error: 'Missing character ID or name' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Missing config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Fetch from ZKillboard
    const zkbResponse = await fetch(
      `https://zkillboard.com/api/characterID/${characterId}/kills/`,
      {
        headers: {
          'User-Agent': 'EVE-Personal-Killboard/1.0'
        }
      }
    )

    if (!zkbResponse.ok) {
      return NextResponse.json(
        { error: 'ZKB API error' },
        { status: zkbResponse.status }
      )
    }

    const zkbKillmails = await zkbResponse.json()

    // Store in database
    let inserted = 0
    let skipped = 0

    for (const km of zkbKillmails) {
      try {
        const { error } = await supabase
          .from('killmails')
          .insert({
            killmail_id: km.killmail_id,
            killmail_hash: km.killmail_hash,
            killmail_time: new Date(km.killmail_time).toISOString(),
            victim_character_id: km.victim.character_id || null,
            victim_character_name: km.victim.character_name || 'Unknown',
            victim_corporation_id: km.victim.corporation_id || null,
            victim_ship_type_id: km.victim.ship_type_id || null,
            victim_ship_name: km.victim.ship_name || null,
            solar_system_id: km.solar_system_id,
            solar_system_name: km.solar_system_name || null,
            region_id: km.region_id || null,
            region_name: km.region_name || null,
            total_value: km.zkb?.totalValue || 0,
            fitted_value: km.zkb?.fittedValue || 0,
            destroyed_value: km.zkb?.destroyedValue || 0,
            dropped_value: km.zkb?.droppedValue || 0,
            attacker_count: km.attackers?.length || 0,
            zkb_points: km.zkb?.points || 0,
            raw_killmail: km
          })
          .select()

        if (error) {
          if (error.code === '23505') { // Duplicate key
            skipped++
          } else {
            console.error('Insert error:', error)
          }
        } else {
          inserted++
        }
      } catch (error) {
        console.error('Error processing killmail:', error)
      }
    }

    return NextResponse.json({
      success: true,
      totalKillmails: zkbKillmails.length,
      inserted,
      skipped
    })

  } catch (error) {
    console.error('Historical sync error:', error)
    return NextResponse.json(
      { error: 'Historical sync failed' },
      { status: 500 }
    )
  }
}