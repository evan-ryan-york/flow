import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  // This endpoint helps debug environment variable issues
  const envCheck = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT_SET',
    allNextPublicVars: Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')),
    nodeEnv: process.env.NODE_ENV,
  };

  return NextResponse.json(envCheck);
}
