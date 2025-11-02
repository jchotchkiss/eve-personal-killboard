import { NextRequest, NextResponse } from 'next/server'

// This endpoint is called by Vercel's cron
export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('authorization')
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/killmails/sync`,
      {
        method: 'POST',
      }
    )

    const data = await response.json()

    return NextResponse.json({
      success: true,
      result: data
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    )
  }
}