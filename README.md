# Digital Card Booth — Web App Camera Card Generator

Client-side only (no backend, no database). Works on GitHub Pages.

## Files
- `index.html` — camera view + preview/download screens
- `style.css` — mobile-first dark UI
- `app.js` — camera access, countdown capture, canvas compositing, download
- `assets/frame.png` — the card template overlay (placeholder — **replace this with your real design**, 1080×1350px, transparent background where the photo should show through)

## Run locally
Camera access requires HTTPS or `localhost`. Opening `index.html` directly (`file://`) will NOT work.

```bash
# any static server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000 on your phone (same Wi-Fi) or on desktop
```

## Deploy to GitHub Pages
1. Push this folder's contents to a GitHub repo (root, or a `/docs` folder).
2. Repo → Settings → Pages → Source: select the branch/folder.
3. GitHub Pages serves over HTTPS automatically, so camera access will work on iOS Safari and Android Chrome.
4. Generate a QR code pointing at the published URL for your booth signage.

## Customizing
- Swap `assets/frame.png` for your real NFT/event card design (keep it 1080×1350, PNG with transparency in the photo area).
- Card code / date text position is set in `app.js` inside the `composite()` function — adjust the `fillText` coordinates to match your frame's text area, or delete those lines if your frame doesn't need them.
- Colors, fonts, and the scan-line/HUD styling live in `style.css` (`:root` variables at the top).
- Countdown length: change `COUNTDOWN_FROM` in `app.js`.
- Output size: change `OUTPUT_W` / `OUTPUT_H` in `app.js` (must match your frame's aspect ratio).

## Saving to the camera roll (iOS + Android)
Tapping "บันทึกรูปภาพ" tries these in order:
1. **Web Share API with a file** (`navigator.share`) — opens the native share sheet with a direct "Save Image" / "Save to Photos" option. Works on modern iOS Safari and Android Chrome, one tap.
2. **`<a download>`** — fallback for desktop and browsers without file-sharing support.
3. **Long-press the image** — always works as a manual fallback, because the result is rendered as a real `<img>` (not a `<canvas>` — iOS Safari's long-press "Save Image" menu does not appear on canvas elements).

If someone opens the link from an in-app browser (LINE, Messenger, Instagram, etc.), camera access and downloads can be blocked entirely by that app's webview. The page detects common in-app browser user agents and shows a hint telling people to open the link in Safari/Chrome instead — for a booth, put the QR code destination through a normal browser to sidestep this.
