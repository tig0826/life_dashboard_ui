"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LeafletMap, LatLngBoundsExpression } from "leaflet"

export interface StayPoint {
  lat: number
  lng: number
  placeName: string
  arrivedAt: string
  departedAt: string
  durationMin: number
}

export interface TransitRoute {
  routePk: string
  transportMode: string
  points: { lat: number; lng: number }[]
}

interface LocationMapProps {
  stays: StayPoint[]
  transits: TransitRoute[]
}

const TRANSIT_COLORS: Record<string, string> = {
  WALKING: "#22d3ee",
  CYCLING: "#86efac",
  IN_BUS: "#fbbf24",
  IN_TRAIN: "#a78bfa",
  IN_PASSENGER_VEHICLE: "#f87171",
  UNKNOWN: "#94a3b8",
}

function getTransitColor(mode: string): string {
  return TRANSIT_COLORS[mode] ?? TRANSIT_COLORS.UNKNOWN
}

export default function LocationMap({ stays, transits }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Lazy-load Leaflet only on client side
    let L: typeof import("leaflet")
    let mounted = true

    import("leaflet").then((leafletModule) => {
      if (!mounted || !containerRef.current) return
      L = leafletModule.default ?? leafletModule

      // Prevent double-init
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      })
      mapRef.current = map

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map)

      const allLatLngs: [number, number][] = []

      // Draw transit routes as polylines (outline + color = glow effect)
      for (const transit of transits) {
        if (transit.points.length < 2) continue
        const latlngs = transit.points.map((p) => [p.lat, p.lng] as [number, number])
        allLatLngs.push(...latlngs)
        // White outline for contrast
        L.polyline(latlngs, {
          color: "#ffffff",
          weight: 7,
          opacity: 0.5,
        }).addTo(map)
        // Colored line on top
        L.polyline(latlngs, {
          color: getTransitColor(transit.transportMode),
          weight: 4,
          opacity: 1,
        }).addTo(map)
      }

      // Draw stay locations as circle markers
      for (const stay of stays) {
        const latlng: [number, number] = [stay.lat, stay.lng]
        allLatLngs.push(latlng)

        const arrivedTime = stay.arrivedAt
          ? new Date(stay.arrivedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
          : "--"
        const departedTime = stay.departedAt
          ? new Date(stay.departedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
          : "--"

        const marker = L.circleMarker(latlng, {
          radius: 8,
          fillColor: "oklch(0.6 0.18 250)" ,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map)

        marker.bindTooltip(
          `<div style="font-size:12px;font-weight:bold">${stay.placeName}</div>` +
            `<div style="font-size:11px;color:#aaa">${arrivedTime} – ${departedTime} (${stay.durationMin}min)</div>`,
          { sticky: true }
        )
      }

      // Fit bounds to all points, fall back to Tokyo if empty
      if (allLatLngs.length > 0) {
        map.fitBounds(allLatLngs as LatLngBoundsExpression, { padding: [20, 20], maxZoom: 15 })
      } else {
        map.setView([35.6812, 139.7671], 12)
      }
    })

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [stays, transits])

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
}
