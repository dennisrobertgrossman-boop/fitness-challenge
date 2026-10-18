import { normalize } from './normalize';
// Metro resolves provider.android.ts / provider.ios.ts / provider.ts per platform.
import { provider } from './provider';
import type { HealthSyncResult, SyncOptions } from './types';

export { provider as healthProvider };
export type { HealthProvider, HealthSyncResult } from './types';

export async function syncHealth(opts: SyncOptions): Promise<HealthSyncResult> {
  const raw = await provider.read({ days: opts.days });
  return normalize(raw, opts.memberId, opts.profile);
}
