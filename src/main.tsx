import { isDeveloperPopupWindow } from './developer/window'
import { oauthResultFromLocation, publishOauthResult } from './oauth/channel'

const oauthResult = oauthResultFromLocation()
if (oauthResult) {
  publishOauthResult(oauthResult)
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(oauthResult, '*')
    window.close()
  } else {
    document.title = 'Blink — Sign-in complete'
    document.body.innerHTML =
      '<p style="font-family:system-ui,sans-serif;padding:2rem;color:#334155">You can close this window and return to Blink.</p>'
  }
} else if (isDeveloperPopupWindow()) {
  void import('./developer/popup-entry')
} else {
  void import('./app-entry')
}
