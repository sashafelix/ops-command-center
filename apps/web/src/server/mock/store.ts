import { seed } from "./seed";

/**
 * In-process mock store. A singleton across the Next process — survives
 * route-handler invocations within the same dev server.
 */

declare global {
  // eslint-disable-next-line no-var
  var __ops_mock_store: typeof seed | undefined;
}

export const mockStore: typeof seed = globalThis.__ops_mock_store ?? seed;
if (!globalThis.__ops_mock_store) globalThis.__ops_mock_store = mockStore;
