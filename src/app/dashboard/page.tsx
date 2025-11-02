'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function Dashboard() {
  const [killmails, setKillmails] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchKillmails = async () => {
      const { data, error } = await supabase
        .from('killmails')
        .select('*')
        .order('killmail_time', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching killmails:', error)
      } else {
        console.log('Raw data from Supabase:', data)
        console.log('First killmail:', data?.[0])
        setKillmails(data || [])
      }
      setLoading(false)
    }

    fetchKillmails()
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Killboard Dashboard</h1>
      <p className="text-gray-300 mb-4">Welcome to your EVE Online killboard!</p>

      {loading ? (
        <p className="text-gray-400">Loading killmails...</p>
      ) : killmails.length === 0 ? (
        <p className="text-gray-400">No killmails yet. Check back after your next engagement!</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-gray-300">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-2">Kill Time</th>
                <th className="px-4 py-2">Victim</th>
                <th className="px-4 py-2">Ship</th>
                <th className="px-4 py-2">System</th>
                <th className="px-4 py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {killmails.map((km) => (
                <tr key={km.id} className="border-b border-slate-700 hover:bg-slate-800">
                  <td className="px-4 py-2">{new Date(km.killmail_time).toLocaleString()}</td>
                  <td className="px-4 py-2">{km.victim_character_name || 'N/A'}</td>
                  <td className="px-4 py-2">{km.victim_ship_name || 'N/A'}</td>
                  <td className="px-4 py-2">{km.solar_system_name || 'N/A'}</td>
                  <td className="px-4 py-2">{(km.total_value / 1000000).toFixed(2)}M ISK</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
