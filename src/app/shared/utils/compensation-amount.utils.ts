/**
 * Single source of truth for "does this listing have a loss & damage
 * compensation amount set?" — used everywhere the UI decides between
 * showing "Up to X ֏" and "Not specified" (spec tile, pickup row, protection
 * card + its intro variant, booking-page row, create-wizard step 5 preview,
 * admin inspect row) and by the edit page's "amount missing" notice.
 *
 * An amount counts as set only when it's a finite number STRICTLY GREATER
 * THAN ZERO. `0` is deliberately treated the same as `null`/`undefined`:
 * the field's own validator requires >= 1,000, so a stored `0` can only be
 * legacy data (the old optional deposit validator allowed it, and the
 * depositAmount -> compensationAmount rename preserved values) — rendering
 * "Up to 0 ֏" would be actively wrong, not just imprecise.
 *
 * Before this helper existed, each component re-implemented its own check
 * inconsistently: some tested `> 0`, others only `!== null` — the latter
 * rendered "Up to 0 ֏" for a legacy `0` listing instead of "Not specified"
 * (confirmed bug, fixed by centralizing the rule here).
 */
export function isCompensationAmountSet(
  amount: number | null | undefined,
): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}
