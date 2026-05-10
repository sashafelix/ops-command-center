import { z } from "zod";
import { Iso } from "./common";

export const NotificationLevel = z.enum(["info", "warn", "bad"]);

export const Notification = z.object({
  id: z.string(),
  level: NotificationLevel,
  title: z.string(),
  body: z.string(),
  ts: Iso,
  read: z.boolean(),
  target_url: z.string().optional(),
});
export type Notification = z.infer<typeof Notification>;
