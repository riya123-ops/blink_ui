const POPUP_WIDTH = 600
const POPUP_HEIGHT = 720

export function oauthPopupFeatures(): string {
  const left = window.screenX + Math.max(0, (window.outerWidth - POPUP_WIDTH) / 2)
  const top = window.screenY + Math.max(0, (window.outerHeight - POPUP_HEIGHT) / 2)
  return `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},status=no,menubar=no,toolbar=no,resizable=yes,scrollbars=yes`
}

export function isPopupBlocked(popup: Window | null): boolean {
  if (!popup) return true
  try {
    return popup.closed
  } catch {
    return true
  }
}

/** Open a blank window in the same tick as the click so popup blockers allow it. */
export function openOauthPlaceholder(name: string, label: string): Window | null {
  const popup = window.open('about:blank', name, oauthPopupFeatures())
  if (isPopupBlocked(popup) || !popup) return null
  try {
    popup.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Connecting…</title></head>
<body style="margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#334155;display:flex;align-items:center;justify-content:center;height:100vh">
  <p style="font-size:0.95rem">Connecting to ${label}…</p>
</body></html>`)
    popup.document.close()
  } catch {
    // Some browsers lock about:blank; navigating later still works.
  }
  return popup
}

export function navigateOauthPopup(popup: Window, url: string): boolean {
  try {
    popup.location.replace(url)
    popup.focus()
    return !popup.closed
  } catch {
    return false
  }
}

export function openOauthOnGesture(url: string, name: string): Window | null {
  const popup = window.open(url, name, oauthPopupFeatures())
  if (!isPopupBlocked(popup) && popup) {
    popup.focus()
    return popup
  }
  const tab = window.open(url, name)
  if (isPopupBlocked(tab) || !tab) return null
  tab.focus()
  return tab
}

export function watchOauthWindow(popup: Window, onClosed: () => void): () => void {
  const timer = window.setInterval(() => {
    if (isPopupBlocked(popup)) {
      window.clearInterval(timer)
      onClosed()
    }
  }, 400)
  return () => window.clearInterval(timer)
}
