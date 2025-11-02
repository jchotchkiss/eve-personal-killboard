import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const shipTypeCache = new Map<number, string>()
const systemCache = new Map<number, string>()

async function getShipTypeName(shipTypeId: number | null): Promise<string> {
  if (!shipTypeId) return 'Unknown'
  if (shipTypeCache.has(shipTypeId)) return shipTypeCache.get(shipTypeId)!

  try {
    const response = await fetch(
      `https://esi.eveonline.com/latest/universe/types/${shipTypeId}/`
    )
    if (!response.ok) return 'Unknown'
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
  if (systemCache.has(systemId)) return systemCache.get(systemId)!

  try {
    const response = await fetch(
      `https://esi.eveonline.com/latest/universe/systems/${systemId}/`
    )
    if (!response.ok) return 'Unknown'
    const data = await response.json()
    systemCache.set(systemId, data.name)
    return data.name
  } catch (error) {
    console.error(`Error fetching system ${systemId}:`, error)
    return 'Unknown'
  }
}

async function getFullKillmail(killmailId: number, hash: string): Promise<any> {
  try {
    const response = await fetch(
      `https://esi.eveonline.com/latest/killmails/${killmailId}/${hash}/`
    )
    if (!response.ok) {
      console.error(`ESI killmail fetch failed: ${response.status}`)
      return null
    }
    return await response.json()
  } catch (error) {
    console.error(`Error fetching killmail ${killmailId}:`, error)
    return null
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
      return NextResponse.json(
        { error: `ZKB API error: ${zkbResponse.status}` },
        { status: zkbResponse.status }
      )
    }

    const zkbKillmails = await zkbResponse.json()
    console.log(`Received ${zkbKillmails.length} killmail IDs from ZKillboard`)

    let inserted = 0
    let skipped = 0
    let errors = 0

    for (const zkbKm of zkbKillmails) {
      try {
        // Fetch FULL killmail from ESI
        const fullKm = await getFullKillmail(zkbKm.killmail_id, zkbKm.zkb.hash)
        if (!fullKm) {
          console.error(`Failed to fetch full killmail ${zkbKm.killmail_id}`)
          errors++
          continue
        }

        // Fetch ship and system names
        const shipName = await getShipTypeName(fullKm.victim?.ship_type_id)
        const systemName = await getSystemName(fullKm.solar_system_id)

        const { error } = await supabase
          .from('killmails')
          .insert({
            killmail_id: zkbKm.killmail_id,
            killmail_hash: zkbKm.zkb.hash,
            killmail_time: fullKm.killmail_time,
            solar_system_id: fullKm.solar_system_id,
            solar_system_name: systemName,
            region_id: null,
            region_name: null,
            victim_character_id: fullKm.victim?.character_id || null,
            victim_character_name: fullKm.victim?.character_name || 'Unknown',
            victim_corporation_id: fullKm.victim?.corporation_id || null,
            victim_ship_type_id: fullKm.victim?.ship_type_id || null,
            victim_ship_name: shipName,
            total_value: zkbKm.zkb.totalValue || 0,
            fitted_value: zkbKm.zkb.fittedValue || 0,
            destroyed_value: zkbKm.zkb.destroyedValue || 0,
            dropped_value: zkbKm.zkb.droppedValue || 0,
            is_solo: zkbKm.zkb.solo || false,
            is_npc_kill: zkbKm.zkb.npc || false,
            attacker_count: fullKm.attackers?.length || 0,
            zkb_points: zkbKm.zkb.points || 0,
            raw_killmail: fullKm
          })
          .select()

        if (error) {
          if (error.code === '23505') {
            skipped++
          } else {
            console.error(`Insert error for killmail ${zkbKm.killmail_id}:`, error)
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
