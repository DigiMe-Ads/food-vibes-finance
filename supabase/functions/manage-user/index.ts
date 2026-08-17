import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build anon client to verify the caller's session and role
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check caller is admin
    const { data: profile, error: profileErr } = await anonClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Permission denied: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build service-role admin client for privileged operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const { action } = body;

    // ── CREATE USER ──────────────────────────────────────────────────────────
    if (action === 'create_user') {
      const { email, password, username, role } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'email and password are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validRoles = ['admin', 'accounts', 'viewer', 'user'];
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create auth user via Admin API (no pgcrypto needed)
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: username || email.split('@')[0] },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert profile with correct role
      const { error: profileError } = await adminClient.from('profiles').upsert({
        id: created.user.id,
        email,
        username: username || email.split('@')[0],
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (profileError) {
        // Clean up auth user if profile upsert fails
        await adminClient.auth.admin.deleteUser(created.user.id);
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ id: created.user.id, email, role }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── DELETE USER ──────────────────────────────────────────────────────────
    if (action === 'delete_user') {
      const { userId } = body;

      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Prevent self-deletion
      if (userId === user.id) {
        return new Response(JSON.stringify({ error: 'You cannot delete your own account.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete profile first (cascade safety), then auth user
      await adminClient.from('profiles').delete().eq('id', userId);
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);

      if (deleteErr) {
        return new Response(JSON.stringify({ error: deleteErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
