import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const permitId = formData.get("permitId") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "File is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!permitId) {
      return new Response(
        JSON.stringify({ error: "Permit ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const fileName = `spt_${permitId}_${Date.now()}.pdf`;
    const filePath = `spt/${permitId}/${fileName}`;

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();

    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/permits/${filePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-upsert": "true",
        },
        body: fileBuffer,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
    }

    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/permits/${filePath}`;

    return new Response(
      JSON.stringify({
        success: true,
        url: fileUrl,
        fileName: file.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
