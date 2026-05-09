/** Stable DOM target for overlays (modals, sheets). Keeps React portals out of direct body child churn. */
export function getPortalContainer() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('tp-portal-root') || document.body;
}
