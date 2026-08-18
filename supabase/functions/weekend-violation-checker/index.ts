import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParkingLog {
  id: string;
  pair_id: string;
  check_out_time: string | null;
  check_in_time: string | null;
  status: string;
}

interface VehicleDriverPair {
  id: string;
  vehicle_id: string;
  employee_id: string;
  qr_code: string;
}

interface Violation {
  id: string;
  pair_id: string;
  consecutive_count: number;
  violation_date: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current date info
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();

    // Check if it's weekend (Saturday = 6, Sunday = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      return new Response(
        JSON.stringify({ message: 'Not a weekend, skipping violation check' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get all active vehicle-driver pairs
    const { data: pairs, error: pairsError } = await supabase
      .from('vehicle_driver_pairs')
      .select('id, vehicle_id, employee_id, qr_code')
      .is('deleted_at', null);

    if (pairsError) throw pairsError;

    const violationsToInsert: any[] = [];
    const vehiclesToBlock: string[] = [];

    // Check each pair for violations
    for (const pair of pairs) {
      // Check if vehicle is currently "Di_Luar_Lahan" (outside parking area)
      const { data: logs, error: logsError } = await supabase
        .from('parking_logs')
        .select('id, pair_id, check_out_time, check_in_time, status')
        .eq('pair_id', pair.id)
        .eq('status', 'Di_Luar_Lahan')
        .order('created_at', { ascending: false })
        .limit(1);

      if (logsError) throw logsError;

      if (logs && logs.length > 0) {
        // Vehicle is outside, check if there's an active permit
        const { data: permits, error: permitsError } = await supabase
          .from('permits')
          .select('id, status')
          .eq('vehicle_id', pair.vehicle_id)
          .eq('status', 'Disetujui')
          .lte('start_date', now.toISOString())
          .gte('end_date', now.toISOString())
          .limit(1);

        if (permitsError) throw permitsError;

        // No active permit found - VIOLATION!
        if (!permits || permits.length === 0) {
          // Check for existing violation this week
          const { data: existingViolations, error: violationsError } = await supabase
            .from('violations')
            .select('id, pair_id, consecutive_count, violation_date')
            .eq('pair_id', pair.id)
            .gte('violation_date', getWeekStart(now).toISOString())
            .lte('violation_date', getWeekEnd(now).toISOString())
            .limit(1);

          if (violationsError) throw violationsError;

          // If no violation recorded this week, record it
          if (!existingViolations || existingViolations.length === 0) {
            // Check previous 2 weeks for consecutive violations
            const previousWeeks = [currentWeek - 1, currentWeek - 2].filter(w => w > 0);
            let consecutiveCount = 1;

            for (const prevWeek of previousWeeks) {
              const { data: prevViolations, error: prevError } = await supabase
                .from('violations')
                .select('id, consecutive_count')
                .eq('pair_id', pair.id)
                .eq('week_number', prevWeek);

              if (prevError) throw prevError;

              if (prevViolations && prevViolations.length > 0) {
                consecutiveCount++;
              } else {
                break;
              }
            }

            const isConsecutive = consecutiveCount >= 2;

            violationsToInsert.push({
              pair_id: pair.id,
              parking_log_id: logs[0].id,
              violation_date: now.toISOString(),
              violation_type: 'Parkir_Libur_Tanpa_Izin',
              week_number: currentWeek,
              is_consecutive: isConsecutive,
              consecutive_count: consecutiveCount,
            });

            // If 3 consecutive violations, block the vehicle
            if (consecutiveCount >= 3) {
              vehiclesToBlock.push(pair.vehicle_id);
            }
          }
        }
      }
    }

    // Insert violations
    if (violationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('violations')
        .insert(violationsToInsert);

      if (insertError) throw insertError;
    }

    // Block vehicles with 3+ consecutive violations
    if (vehiclesToBlock.length > 0) {
      const { error: blockError } = await supabase
        .from('vehicles')
        .update({ status_qr: 'Terblokir' })
        .in('id', vehiclesToBlock);

      if (blockError) throw blockError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        violations_count: violationsToInsert.length,
        vehicles_blocked: vehiclesToBlock.length,
        timestamp: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in violation checker:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper function to get start of week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Helper function to get end of week (Sunday)
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}
