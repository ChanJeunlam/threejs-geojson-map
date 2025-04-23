"use client"
import MapVisualization from "@/components/map-visualization"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div className="relative w-full h-screen">
        <MapVisualization />
      </div>
    </main>
  )
}
