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

    // Fetch from ZKillboard
    console.log(`Fetching killmails for character ${characterId}...`)
    const zkbResponse = await fetch(
      `https://zkillboard.com/api/characterID/${characterId}/`,
      {
        headers: {
          'User-Agent': 'EVE-Personal-Killboard/1.0 Contact:YourEmail@example.com'
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

    // Store in database
    let inserted = 0
    let skipped = 0
    let errors = 0

    for (const km of zkbKillmails) {
      try {
        // Get full killmail details from ESI
        const esiResponse = await fetch(
          `https://esi.eveonline.com/latest/killmails/${km.killmail_id}/${km.zkb.hash}/`
        )

        if (!esiResponse.ok) {
          console.error(`ESI error for killmail ${km.killmail_id}: ${esiResponse.status}`)
          errors++
          continue
        }

        const fullKillmail = await esiResponse.json()

        const { error } = await supabase
          .from('killmails')
          .insert({
            killmail_id: km.killmail_id,
            killmail_hash: km.zkb.hash,
            killmail_time: fullKillmail.killmail_time,
            solar_system_id: fullKillmail.solar_system_id,
            victim_character_id: fullKillmail.victim.character_id || null,
            victim_ship_type_id: fullKillmail.victim.ship_type_id,
            total_value: km.zkb.totalValue || 0,
            zkb_points: km.zkb.points || 0,
            is_solo: km.zkb.solo || false,
            is_awox: km.zkb.awox || false,
            attacker_count: fullKillmail.attackers?.length || 0,
            raw_killmail: fullKillmail
          })

        if (error) {
          if (error.code === '23505') { // Duplicate key
            skipped++
          } else {
            console.error('Insert error:', error)
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
