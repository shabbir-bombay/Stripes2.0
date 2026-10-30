"use client";

import { useState } from "react";
import { api } from "./api";
import { usePolling } from "./usePolling";
import type { ServiceMode, ServiceStatus } from "@/lib/types";

const MODES: { mode: ServiceMode; label: string }[] = [
  { mode: "on", label: "On" },
  { mode: "off", label: "Off" },
  { mode: "automatic", label: "Automatic" },
];

/** The admin's open/closed control. Polls, so a change made by another admin shows up here too. */
export function ServiceSwitch() {
  const { data: service, error, refresh } = usePolling<ServiceStatus>("/api/service-status");
  const [saving, setSaving] = useState<ServiceMode>();
  const [saveError, setSaveError] = useState<string>();

  async function choose(mode: ServiceMode) {
    setSaving(mode);
    setSaveError(undefined);
    try {
      await api<ServiceStatus>("/api/admin/service", "PUT", { mode });
      await refresh();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(undefined);
    }
  }

  const mode = saving ?? service?.mode;
  return (
    <section className="card stack" aria-labelledby="service-heading">
      <h2 id="service-heading">Service</h2>
      <p role="status" className={`banner ${service ? (service.open ? "open" : "closed") : ""}`}>
        {service
          ? service.open ? "Open: students can request rides." : "Closed: students can't request rides."
          : error ?? "Checking the service…"}
      </p>
      <fieldset className="segmented" disabled={!service || !!saving}>
        <legend>Mode</legend>
        {MODES.map((option) => (
          <label key={option.mode} className="segment">
            <input type="radio" name="service-mode" checked={mode === option.mode} onChange={() => choose(option.mode)} />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <p className="field-hint">Automatic follows the weekly service hours. Until hours are set up, it counts as closed.</p>
      {saveError && <p role="alert" className="form-error">{saveError}</p>}
    </section>
  );
}
