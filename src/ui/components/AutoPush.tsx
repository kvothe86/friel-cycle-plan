import { useEffect, useMemo } from 'react';
import { eventFor, contentHash } from '../../engine/push';
import { useCredentials, usePlanHorizon, usePushSettings, useToday } from '../../store/hooks';
import { useSyncStore } from '../../store/sync';

/** Delay so a burst of changes (sync, availability edits) results in one push. */
export const AUTO_PUSH_DELAY_MS = 3000;

/**
 * Pushes the plan whenever its content changes, if auto-push is on.
 * Keyed on a hash of the would-be events, so re-renders don't trigger pushes.
 */
export function AutoPush() {
  const today = useToday();
  const creds = useCredentials();
  const { auto } = usePushSettings();
  const days = usePlanHorizon(today);
  const syncing = useSyncStore((s) => s.status === 'syncing');
  const push = useSyncStore((s) => s.push);

  const key = useMemo(
    () => days?.map((d) => `${d.date}:${d.kind}:${(() => { const e = eventFor(d); return e ? contentHash(e) : ''; })()}`).join('|'),
    [days],
  );

  useEffect(() => {
    if (!auto || !creds || !days || !key || syncing) return;
    const t = setTimeout(() => void push(days), AUTO_PUSH_DELAY_MS);
    return () => clearTimeout(t);
    // `days` changes identity with `key`; keying on `key` avoids pushes on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, creds, key, syncing, push]);

  return null;
}
