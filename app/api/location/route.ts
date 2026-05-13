import { NextRequest, NextResponse } from "next/server";
import { Trino } from "trino-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Default to today in JST
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const defaultDate = jstNow.toISOString().split("T")[0];
  const dateStr = searchParams.get("date") || defaultDate;

  const trino = Trino.create({
    server: process.env.TRINO_SERVER_URL || "http://localhost:8080",
    catalog: process.env.TRINO_CATALOG || "iceberg",
    schema: "life_gold",
  });

  try {
    // Fetch stays for the requested date
    const staysIter = await trino.query({
      query: `
        SELECT
          stay_pk,
          place_name,
          place_id,
          lat,
          lng,
          CAST(arrived_at AS VARCHAR),
          CAST(departed_at AS VARCHAR),
          duration_min
        FROM life_gold.mrt_location_stays
        WHERE stay_date = DATE '${dateStr}'
        ORDER BY arrived_at ASC
      `,
      user: "dashboard-api",
    });

    const stayRows: any[] = [];
    for await (const result of staysIter) {
      if (result.error) throw new Error(result.error.message);
      if (result.data) stayRows.push(...result.data);
    }

    const stays = stayRows.map((row) => ({
      stayPk: row[0] as string,
      placeName: (row[1] as string) || "Unknown Place",
      placeId: row[2] as string | null,
      lat: Number(row[3]),
      lng: Number(row[4]),
      arrivedAt: row[5] as string,
      departedAt: row[6] as string,
      durationMin: Number(row[7] || 0),
    }));

    // Fetch routes for the requested date
    const routesIter = await trino.query({
      query: `
        SELECT
          route_pk,
          transport_mode,
          CAST(started_at AS VARCHAR),
          CAST(ended_at AS VARCHAR),
          distance_meters,
          route_json
        FROM life_gold.mrt_location_routes
        WHERE route_date = DATE '${dateStr}'
        ORDER BY started_at ASC
      `,
      user: "dashboard-api",
    });

    const routeRows: any[] = [];
    for await (const result of routesIter) {
      if (result.error) throw new Error(result.error.message);
      if (result.data) routeRows.push(...result.data);
    }

    const transits = routeRows.map((row) => {
      let points: { lat: number; lng: number }[] = [];
      try {
        const parsed = JSON.parse(row[5] || "[]");
        if (Array.isArray(parsed)) {
          points = parsed.map((p: any) => ({
            lat: Number(p.lat),
            lng: Number(p.lng),
          }));
        }
      } catch {
        // ignore parse errors
      }
      return {
        routePk: row[0] as string,
        transportMode: (row[1] as string) || "UNKNOWN",
        startedAt: row[2] as string,
        endedAt: row[3] as string,
        distanceMeters: row[4] ? Number(row[4]) : null,
        points,
      };
    });

    return NextResponse.json({ stays, transits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
