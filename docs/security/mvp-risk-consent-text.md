# MVP User-Facing Trading Risk Notice and Live Consent Text

Use these texts directly in UI components (`banner`, `modal`, `checkbox consent`) and API/legal references for MVP.

## 1) Risk Notice (Short Banner)

### EN
Automated trading can lead to rapid losses, including loss of your full allocated capital. Use LIVE mode only if you understand and accept this risk.

### PL
Automatyczny handel moze prowadzic do szybkich strat, w tym utraty calosci przydzielonego kapitalu. Uzywaj trybu LIVE tylko, jesli rozumiesz i akceptujesz to ryzyko.

## 2) Risk Notice (Detailed Modal)

### EN
CryptoSparrow is an execution tool, not financial advice.  
Past results do not guarantee future performance.  
In LIVE mode, orders may be executed automatically and may result in partial or total capital loss due to market volatility, slippage, latency, exchange issues, or strategy errors.  
You are solely responsible for strategy configuration, risk limits, and account activity.

### PL
CryptoSparrow jest narzedziem wykonawczym, a nie doradztwem finansowym.  
Wyniki historyczne nie gwarantuja przyszlych rezultatow.  
W trybie LIVE zlecenia moga byc wykonywane automatycznie i moga prowadzic do czesciowej lub calkowitej utraty kapitalu z powodu zmiennosci rynku, poslizgu cenowego, opoznien, problemow gieldy lub bledow strategii.  
Pelna odpowiedzialnosc za konfiguracje strategii, limity ryzyka i aktywnosc konta spoczywa na uzytkowniku.

## 3) LIVE Consent Checkbox Text

### EN
I understand the risks of automated live trading, including possible full capital loss, and I explicitly consent to enable LIVE execution for this bot.

### PL
Rozumiem ryzyka automatycznego handlu na zywo, w tym mozliwa pelna utrate kapitalu, i wyraznie zgadzam sie na wlaczenie wykonywania LIVE dla tego bota.

## 4) LIVE Confirmation CTA

### EN
Enable LIVE and accept risk

### PL
Wlacz LIVE i zaakceptuj ryzyko

## 5) Recommended Consent Logging Payload (MVP)
When consent is accepted, log an audit event with:
- `event`: `live_consent.accepted`
- `userId`
- `botId`
- `mode`: `LIVE`
- `consentTextVersion`: `mvp-v1`
- `timestamp`
- `ip` (if available)
- `userAgent` (if available)

## 6) Text Versioning Rule
- Keep current version tag as `mvp-v1`.
- Any wording change must bump version (for example `mvp-v2`) and be reflected in audit logs.
