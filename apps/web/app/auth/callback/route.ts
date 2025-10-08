import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  console.log('🔄 Auth callback called:', {
    url: requestUrl.href,
    hasCode: !!code,
    code: code?.substring(0, 20) + '...'
  });

  if (code) {
    console.log('🔑 Exchanging code for session...');

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error('Cookie set error:', error);
            }
          },
        },
      }
    );

    console.log('🔌 Supabase SSR client created');

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log('📝 Code exchange result:', {
      hasData: !!data,
      hasSession: !!data?.session,
      hasUser: !!data?.user,
      error: error?.message
    });

    if (error) {
      console.error('❌ Auth callback error:', error);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_callback_error&message=${encodeURIComponent(error.message)}`);
    }

    console.log('✅ Session created successfully');
  } else {
    console.log('⚠️ No code provided in callback');
  }

  console.log('🔄 Redirecting to dashboard...');
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
}