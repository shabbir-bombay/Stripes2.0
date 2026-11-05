import type { ServiceMode, ServiceStatus } from "../types";
import { db } from "./db";
import { scheduleStatus } from "./schedule";

export const SERVICE_MODES: ServiceMode[] = ["automatic", "on", "off"];

/** Whether students can request rides right now, and the largest party one request can hold. */
export async function serviceStatus(): Promise<ServiceStatus> {
  const [service, carts] = await Promise.all([
    db.service.findUnique({ where: { id: 1 } }),
    db.cart.aggregate({ where: { active: true }, _max: { seats: true } }),
  ]);
  const mode = service?.mode ?? "automatic";
  const seats = carts._max.seats;
  const maxPartySize = seats ? seats - 1 : 1;
  if (mode !== "automatic") return { open: mode === "on", mode, nextChange: null, maxPartySize };

  const { open, nextChange } = scheduleStatus(await db.serviceRule.findMany());
  return { open, mode, nextChange: nextChange?.toISOString() ?? null, maxPartySize };
}

export async function setServiceMode(mode: ServiceMode) {
  await db.service.upsert({ where: { id: 1 }, update: { mode }, create: { id: 1, mode } });
  return serviceStatus();
}
