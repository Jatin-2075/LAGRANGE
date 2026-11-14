import { useEffect, useRef, useState } from "react";
import type { SiteResult } from "../../api/types";
import { MoonScene } from "../../lib/moonScene";
import { Banner } from "../ui/Banner";
import "./MoonViewer.css";

interface Target {
  latitude: number;
  longitude: number;
}

interface MoonViewerProps {
  sites: SiteResult[];
  selectedSiteId: string | null;
  target: Target | null;
  onSelectSite: (siteId: string) => void;
  onPickPoint: (latitude: number, longitude: number) => void;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function MoonViewer({ sites, selectedSiteId, target, onSelectSite, onPickPoint }: MoonViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MoonScene | null>(null);
  const callbacks = useRef({ onSelectSite, onPickPoint });
  const initialTarget = useRef(target);
  const sitesRef = useRef(sites);
  const [unsupported] = useState(() => !webglAvailable());

  useEffect(() => {
    callbacks.current = { onSelectSite, onPickPoint };
  }, [onSelectSite, onPickPoint]);

  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    try {
      sceneRef.current = new MoonScene(
        container,
        {
          onSelectSite: (id) => callbacks.current.onSelectSite(id),
          onPickPoint: (lat, lon) => callbacks.current.onPickPoint(lat, lon),
        },
        initialTarget.current,
      );
    } catch (error) {
      console.error("Could not start the 3D view:", error);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setSites(sites, selectedSiteId);
  }, [sites, selectedSiteId]);

  useEffect(() => {
    sceneRef.current?.setTarget(target);
  }, [target]);

  useEffect(() => {
    const site = sitesRef.current.find((s) => s.site_id === selectedSiteId);
    if (site) sceneRef.current?.flyTo(site.latitude, site.longitude);
  }, [selectedSiteId]);

  if (unsupported) {
    return (
      <div className="moon-viewer moon-viewer--fallback">
        <Banner tone="warn" title="3D view unavailable">
          This browser or device can't create a WebGL context. Results are still listed alongside.
        </Banner>
      </div>
    );
  }

  return (
    <div
      className="moon-viewer"
      ref={containerRef}
      role="img"
      aria-label="Interactive 3D globe of the Moon. Drag to rotate, scroll to zoom, click to pick a target point."
    />
  );
}
