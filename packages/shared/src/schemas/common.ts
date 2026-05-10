import { z } from "zod";

export const StatusTone = z.enum(["ok", "warn", "bad", "info", "violet"]);
export type StatusTone = z.infer<typeof StatusTone>;

export const Severity = z.enum(["low", "med", "high"]);
export type Severity = z.infer<typeof Severity>;

export const Iso = z.string().datetime({ offset: true });

export const Role = z.enum(["admin", "sre", "analyst", "viewer", "agent"]);
export type Role = z.infer<typeof Role>;
