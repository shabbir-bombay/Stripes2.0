"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/Button";
import { Field, SelectField } from "@/components/Field";
import { ServiceSwitch } from "@/components/ServiceSwitch";
import { usePolling } from "@/components/usePolling";
import type { ServiceRule, ServiceRuleInput } from "@/lib/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "21:30" as "9:30 PM". */
function clock(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** The same words the schedule follows: an end before the start runs past midnight; equal times are the whole day. */
function hours({ start, end }: ServiceRuleInput) {
  if (start === end) return "All day";
  return `${clock(start)} to ${clock(end)}${end < start ? " the next day" : ""}`;
}

export default function HoursPage() {
  const { data: rules, error, refresh } = usePolling<ServiceRule[]>("/api/admin/service-rules", 15_000);

  return (
    <main className="page stack">
      <h1>Service hours</h1>
      <ServiceSwitch />
      <RuleForm title="Add hours" submitLabel="Add hours" initial={{ day: 1, start: "20:00", end: "02:00" }} save={async (rule) => {
        await api("/api/admin/service-rules", "POST", rule);
        await refresh();
      }} />
      {error && <p role="alert" className="form-error">{error}</p>}
      {!rules && !error && <p role="status">Loading hours…</p>}
      {rules?.length === 0 && <p className="muted">No hours yet, so automatic mode stays closed.</p>}
      {DAYS.map((name, day) => {
        const ofDay = rules?.filter((rule) => rule.day === day) ?? [];
        return ofDay.length === 0 ? null : (
          <section key={day} className="stack" aria-label={name}>
            <h2>{name}</h2>
            {ofDay.map((rule) => <RuleCard key={rule.id} rule={rule} reload={refresh} />)}
          </section>
        );
      })}
    </main>
  );
}

function RuleCard({ rule, reload }: { rule: ServiceRule; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/admin/service-rules/${rule.id}`, "DELETE");
      await reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <RuleForm
        title={`Change ${DAYS[rule.day]}, ${hours(rule)}`}
        submitLabel="Save"
        initial={rule}
        cancel={() => setEditing(false)}
        save={async (update) => {
          await api(`/api/admin/service-rules/${rule.id}`, "PUT", update);
          await reload();
          setEditing(false);
        }}
      />
    );
  }

  return (
    <article className="card stack">
      <p className="banner-title">{hours(rule)}</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="ride-actions">
        <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>Edit</Button>
        <Button variant="secondary" onClick={remove} disabled={busy}>{busy ? "Removing…" : "Remove"}</Button>
      </div>
    </article>
  );
}

function RuleForm({ title, submitLabel, initial, save, cancel }: {
  title: string;
  submitLabel: string;
  initial: ServiceRuleInput;
  save: (rule: ServiceRuleInput) => Promise<void>;
  cancel?: () => void;
}) {
  const [day, setDay] = useState(initial.day);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await save({ day, start, end });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{title}</h2>
      <SelectField label="Day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
        {DAYS.map((name, value) => <option key={value} value={value}>{name}</option>)}
      </SelectField>
      <Field label="Opens" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
      <Field label="Closes" type="time" hint="Earlier than the opening time means the next day. The same time means all day." value={end} onChange={(e) => setEnd(e.target.value)} required />
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="ride-actions">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : submitLabel}</Button>
        {cancel && <Button type="button" variant="secondary" onClick={cancel} disabled={busy}>Back</Button>}
      </div>
    </form>
  );
}
