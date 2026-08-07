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
    const vehicleId = formData.get("vehicleId") as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "File is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!vehicleId) {
      return new Response(
        JSON.stringify({ error: "Vehicle ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "File must be an image (JPEG, PNG, or WebP)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: "File size must not exceed 5MB" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `vehicle_${vehicleId}_${Date.now()}.${ext}`;
    const filePath = `${vehicleId}/${fileName}`;

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();

    const uploadResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/vehicles/${filePath}`,
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
      const errText = await uploadResponse.text();
      throw new Error(`Storage upload failed: ${uploadResponse.statusText} - ${errText}`);
    }

    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/vehicles/${filePath}`;

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
