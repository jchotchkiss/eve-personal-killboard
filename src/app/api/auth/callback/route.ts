if (!supabase) {
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=config_error`)
}