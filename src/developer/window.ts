import { isDesktopApp } from '../desktop'

export const DEVELOPER_POPUP_QUERY = 'blink-dev'
export const DEVELOPER_POPUP_NAME = 'blink-developer-tools'

export function isDeveloperPopupWindow(): boolean {
  return new URLSearchParams(window.location.search).get(DEVELOPER_POPUP_QUERY) === '1'
}

export function developerPopupHref(): string {
  const url = new URL(window.location.href)
  url.searchParams.set(DEVELOPER_POPUP_QUERY, '1')
  url.hash = ''
  return url.toString()
}

let popup: Window | null = null

export function openDeveloperPopup(): Window | null {
  if (isDesktopApp()) {
    void openDesktopDeveloperWindow()
    return null
  }
  if (popup && !popup.closed) {
    popup.focus()
    return popup
  }
  popup = window.open(
    developerPopupHref(),
    DEVELOPER_POPUP_NAME,
    'popup=yes,width=440,height=780,left=72,top=72,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes',
  )
  return popup
}

async function openDesktopDeveloperWindow(): Promise<void> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  const existing = await WebviewWindow.getByLabel('developer')
  if (existing) {
    await existing.show()
    await existing.setFocus()
    return
  }
  new WebviewWindow('developer', {
    url: developerPopupHref(),
    title: 'Blink Developer',
    width: 440,
    height: 780,
    x: 72,
    y: 72,
    resizable: true,
  })
}
