import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const shipTypeCache = new Map<number, string>()
const systemCache = new Map<number, string>()

async function getShipTypeName(shipTypeId: number | null): Promise<string> {
  if (!shipTypeId) return 'Unknown'
  if (shipTypeCache.has(shipTypeId)) {
    return shipTypeCache.get(shipTypeId)!
  }

  try {
    const response = await fetch(
      `https://esi.eveonline.com/latest/universe/types/${shipTypeId}/`
    )
    if (!response.ok) {
      console.error(`ESI ship lookup failed: ${response.status}`)
      return 'Unknown'
    }

    const data = await response.json()
    shipTypeCache.set(shipTypeId, data.name)
    return data.name
  } catch (error) {
    console.error(`Error fetching ship type ${shipTypeId}:`, error)
    return 'Unknown'
  }
}

async function getSystemName(systemId: number | null): Promise<string> {
  if (!systemId) return 'Unknown'
  if (systemCache.has(systemId)) {
    return systemCache.get(systemId)!
  }

  try {
    const response = await fetch(
      `https://esi.eveonline.com/latest/universe/systems/${systemId}/`
    )
    if (!response.ok) {
      console.error(`ESI system lookup failed: ${response.status}`)
      return 'Unknown'
    }

    const data = await response.json()
    systemCache.set(systemId, data.name)
    return data.name
  } catch (error) {
    console.error(`Error fetching system ${systemId}:`, error)
    return 'Unknown'
  }
}

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
        // Fetch ship and system names from ESI
        const shipName = await getShipTypeName(km.victim?.ship_type_id)
        const systemName = await getSystemName(km.solar_system_id)

        console.log(`Processing killmail ${km.killmail_id}: ship=${shipName}, system=${systemName}`)

        const { error } = await supabase
          .from('killmails')
          .insert({
            killmail_id: km.killmail_id,
            killmail_hash: km.zkb.hash,
            killmail_time: km.killmail_time || new Date().toISOString(),
            solar_system_id: km.solar_system_id || 30000142,
            solar_system_name: systemName,
            region_id: km.region_id || null,
            region_name: km.region_name || null,
            victim_character_id: km.victim?.character_id || null,
            victim_character_name: km.victim?.character_name || 'Unknown',
            victim_corporation_id: km.victim?.corporation_id || null,
            victim_ship_type_id: km.victim?.ship_type_id || null,
            victim_ship_name: shipName,
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
