# Changelog

## Ver1.15.10  2026-06-11 

### Fixed
- Restored MV3 service-worker routing for legacy messages that use `text` instead of `action`, including settings, login, popup buttons, and price-protection settings.
- Prevented the offscreen background document from racing service-worker proxy responses for Chrome API control messages.
- Hardened task lookup so removed or unknown task IDs return a suspended placeholder instead of throwing.
- Guarded content-script calls to removed legacy task handlers to avoid crashes on matching JD pages.
- Fixed JD product price parsing issues, including unsafe SKU URL matching, incorrect jQuery `.each()` callback usage, undeclared presale variable handling, and mobile original-price precedence.
- Added direct synchronization from `https://order.jd.com/center/list.action` into the existing recent-orders database, including order ID, time, SKU, item name, image, quantity, and price extraction.
- Fixed price chart error handling so disabled or failed chart requests show retry UI instead of throwing undefined-variable errors.
- Replaced deprecated `chrome.extension.getURL` usage with `chrome.runtime.getURL`.
- Fixed financial coin reward parsing by wrapping DOM nodes before using jQuery methods.

### Verified
- Production webpack build completes successfully; remaining output is existing bundle-size warnings only.
