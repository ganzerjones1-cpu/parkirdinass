import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { username } = await req.json();

    if (!username) {
      return new Response(JSON.stringify({ error: "Username wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user by username using service role (bypasses RLS, needed for unauthenticated request)
    const { data: userData, error: userError } = await serviceClient
      .from("users")
      .select("id, username")
      .eq("username", username)
      .eq("status_akun", "Aktif")
      .maybeSingle();

    if (userError) throw userError;

    if (!userData) {
      // Don't reveal whether the username exists
      return new Response(
        JSON.stringify({ success: true, message: "Jika username terdaftar, permintaan akan diproses" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate reset token
    const resetToken =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const { error: insertError } = await serviceClient
      .from("password_reset_requests")
      .insert({
        user_id: userData.id,
        reset_token: resetToken,
        status: "pending",
      });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, message: "Permintaan reset password telah dikirim" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("request-password-reset error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
