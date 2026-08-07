import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AppMetadata {
  role?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: caller, error: callerError } = await anonClient.auth.getUser();
    if (callerError || !caller.data.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRole = (caller.data.user.app_metadata as AppMetadata)?.role;
    if (callerRole !== "super_admin" && callerRole !== "admin_parkir") {
      return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const action = body.action;

    // ── Update password (super_admin only) ──
    if (action === "update_password") {
      if (callerRole !== "super_admin") {
        return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { userId, newPassword } = body as { userId: string; newPassword: string };
      if (!userId || !newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the auth_id for this user
      const { data: userData, error: userError } = await serviceClient
        .from("users")
        .select("auth_id")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !userData?.auth_id) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        userData.auth_id,
        { password: newPassword }
      );

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Also update the plaintext password column for backward compatibility
      await serviceClient
        .from("users")
        .update({ password: newPassword, updated_at: new Date().toISOString() })
        .eq("id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Update username (super_admin only) ──
    if (action === "update_username") {
      if (callerRole !== "super_admin") {
        return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { userId, newUsername } = body as { userId: string; newUsername: string };
      if (!userId || !newUsername) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: userError } = await serviceClient
        .from("users")
        .select("auth_id")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !userData?.auth_id) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newEmail = `${newUsername}@garasi.ttuid`;
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        userData.auth_id,
        { email: newEmail }
      );

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await serviceClient
        .from("users")
        .update({ username: newUsername, updated_at: new Date().toISOString() })
        .eq("id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create user (super_admin only) ──
    if (action === "create_user") {
      if (callerRole !== "super_admin") {
        return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { username, password, role } = body as {
        username: string;
        password: string;
        role: string;
      };

      if (!username || !password || password.length < 6 || !role) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = `${username}@garasi.ttuid`;
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {},
        app_metadata: { role },
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: dbError } = await serviceClient.from("users").insert({
        username,
        password,
        role,
        status_akun: "Aktif",
        auth_id: authData.user.id,
      });

      if (dbError) {
        // Rollback auth account
        await serviceClient.auth.admin.deleteUser(authData.user.id);
        return new Response(JSON.stringify({ error: dbError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create pegawai user (super_admin + admin_parkir) ──
    // Creates a user_pegawai auth account using NIP as username.
    // Returns the public.users id so the caller can link it to an employee.
    if (action === "create_pegawai_user") {
      const { username, password, namaLengkap } = body as {
        username: string;
        password: string;
        namaLengkap?: string;
      };

      if (!username || !password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Invalid input: password min 6 karakter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = `${username}@garasi.ttuid`;
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {},
        app_metadata: { role: "user_pegawai" },
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: dbError } = await serviceClient
        .from("users")
        .insert({
          username,
          password,
          role: "user_pegawai",
          status_akun: "Aktif",
          nama_lengkap: namaLengkap || null,
          auth_id: authData.user.id,
        })
        .select("id")
        .maybeSingle();

      if (dbError || !newUser) {
        await serviceClient.auth.admin.deleteUser(authData.user.id);
        return new Response(JSON.stringify({ error: dbError?.message || "Gagal membuat data pengguna" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Update pegawai password (super_admin + admin_parkir) ──
    if (action === "update_pegawai_password") {
      const { userId, newPassword } = body as { userId: string; newPassword: string };
      if (!userId || !newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: userError } = await serviceClient
        .from("users")
        .select("auth_id")
        .eq("id", userId)
        .maybeSingle();

      if (userError || !userData?.auth_id) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        userData.auth_id,
        { password: newPassword }
      );

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await serviceClient
        .from("users")
        .update({ password: newPassword, updated_at: new Date().toISOString() })
        .eq("id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("admin-users error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
