"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  GraphicStage,
  graphicSchema,
  type GraphicDocument,
} from "@/lib/graphics";
import { preloadGraphic } from "@/lib/playout";
function mediaToken(value: unknown, token: string): unknown {
  if (typeof value === "string" && value.startsWith("/api/assets/")) {
    const u = new URL(value, location.origin);
    u.searchParams.set("token", token);
    return u.pathname + u.search;
  }
  if (Array.isArray(value)) return value.map((v) => mediaToken(v, token));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, mediaToken(v, token)]),
    );
  return value;
}
export function Output() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [graphic, setGraphic] = useState<GraphicDocument | null>(null);
  const version = useRef(-1);
  const received = useRef(-1);
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout>;
    let stream: EventSource | null = null;
    const key = `tgiq-output:${token}`;
    const apply = async (
      p: { version: number; graphic: GraphicDocument | null },
      saved = false,
    ) => {
      if (!Number.isInteger(p.version) || p.version <= received.current) return;
      received.current = p.version;
      const started = performance.now();
      const parsed = p.graphic === null ? null : graphicSchema.parse(p.graphic);
      const next = mediaToken(parsed, token) as GraphicDocument | null;
      await preloadGraphic(next);
      if (
        active &&
        p.version >= received.current &&
        p.version > version.current
      ) {
        version.current = p.version;
        setGraphic(next);
        if (!saved)
          try {
            localStorage.setItem(key, JSON.stringify(p));
          } catch {}
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            performance.measure("tgiq-output-switch", {
              start: started,
              end: performance.now(),
            }),
          ),
        );
      }
    };
    const connect = () => {
      if (!active) return;
      stream = new EventSource(
        `/api/program/events?token=${encodeURIComponent(token)}`,
      );
      stream.addEventListener("state", (event) => {
        try {
          apply(JSON.parse((event as MessageEvent).data)).catch(() => {});
        } catch {}
      });
      stream.onerror = () => {
        stream?.close();
        fetch(`/api/program?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        })
          .then(async (r) => {
            if (r.status === 401) {
              if (active) {
                setGraphic(null);
                localStorage.removeItem(key);
              }
              return;
            }
            if (r.ok) await apply(await r.json());
          })
          .catch(() => {})
          .finally(() => {
            if (active) retry = setTimeout(connect, 1000);
          });
      };
    };
    // This device's last approved frame survives a network outage/reload; the server remains authoritative.
    try {
      const saved = localStorage.getItem(key);
      if (saved) apply(JSON.parse(saved), true).catch(() => {});
    } catch {}
    connect();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      active = false;
      clearTimeout(retry);
      stream?.close();
    };
  }, [token]);
  return (
    <main className="broadcast-output" aria-label="Broadcast output">
      <GraphicStage graphic={graphic} />
    </main>
  );
}
