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
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    console.log(`Fetching killmails for character ${characterId}...`)
    const zkbResponse = await fetch(
      `https://zkillboard.com/api/characterID/${characterId}/`,
      {
        headers: {
          'User-Agent': 'EVE-Personal-Killboard/1.0'
        }
      }
    )

    if (!zkbResponse.ok) {
      console.error(`ZKB API error: ${zkbResponse.status}`)
      return NextResponse.json(
        { error: `ZKB API error: ${zkbResponse.status}` },
        { status: zkbResponse.status }
      )
    }

    const zkbKillmails = await zkbResponse.json()
    console.log(`Received ${zkbKillmails.length} killmails from ZKillboard`)

    let inserted = 0
    let skipped = 0
    let errors = 0

    for (const km of zkbKillmails) {
      try {
        const { error } = await supabase
          .from('killmails')
          .insert({
            killmail_id: km.killmail_id,
            killmail_hash: km.zkb.hash,
            killmail_time: km.killmail_time || new Date().toISOString(), // Fallback to now
            solar_system_id: km.solar_system_id,
            solar_system_name: km.solar_system_name || 'Unknown',
            region_id: km.region_id || null,
            region_name: km.region_name || null,
            victim_character_id: km.victim?.character_id || null,
            victim_character_name: km.victim?.character_name || 'Unknown',
            victim_corporation_id: km.victim?.corporation_id || null,
            victim_ship_type_id: km.victim?.ship_type_id || null,
            victim_ship_name: km.victim?.ship_name || null,
            total_value: km.zkb.totalValue || 0,
            fitted_value: km.zkb.fittedValue || 0,
            destroyed_value: km.zkb.destroyedValue || 0,
            dropped_value: km.zkb.droppedValue || 0,
            is_solo: km.zkb.solo || false,
            is_npc_kill: km.zkb.npc || false,
            attacker_count: km.attackers?.length || 0,
            zkb_points: km.zkb.points || 0,
            raw_killmail: km
          })
          .select()

        if (error) {
          if (error.code === '23505') {
            skipped++
          } else {
            console.error(`Insert error for killmail ${km.killmail_id}:`, error)
            errors++
          }
        } else {
          inserted++
        }
      } catch (error) {
        console.error('Error processing killmail:', error)
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      totalKillmails: zkbKillmails.length,
      inserted,
      skipped,
      errors
    })

  } catch (error) {
    console.error('Historical sync error:', error)
    return NextResponse.json(
      { error: 'Historical sync failed', details: String(error) },
      { status: 500 }
    )
  }
}
