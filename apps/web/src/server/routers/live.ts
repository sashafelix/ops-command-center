import { protectedProcedure, router } from "../trpc";
import { mockStore } from "../mock/store";

export const liveRouter = router({
  /** Current top-priority session for the NOW PLAYING strip. */
  now: protectedProcedure.query(() => mockStore.nowPlaying),

  /** KPI row on the LIVE board. */
  kpi: protectedProcedure.query(() => mockStore.kpi),

  /** Sidebar nav badge counts. Disappear on zero per HANDOFF acceptance. */
  navBadges: protectedProcedure.query(() => mockStore.navBadges),
});
