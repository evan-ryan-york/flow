import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create admin client with service role key
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify the user from their JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Delete all user data via the database function
  const { error: dataError } = await supabase.rpc('delete_user_data', {
    target_user_id: user.id,
  })

  if (dataError) {
    console.error('Failed to delete user data:', dataError)
    return new Response(JSON.stringify({ error: 'Failed to delete account data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Delete the auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(user.id)

  if (authError) {
    console.error('Failed to delete auth user:', authError)
    return new Response(JSON.stringify({ error: 'Failed to delete auth user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
