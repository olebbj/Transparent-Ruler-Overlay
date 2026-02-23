# Transparent Ruler Overlay

Transparent on-page ruler overlay for quick UI checks in **px + cm**.

## Mascot

![Capybara measuring a box](assets/capybara-box.png)

## Features

- Toggle overlay from popup or hotkey (`Alt+R` on Windows/Linux, `Option+R` on Mac)
- Horizontal/vertical ruler (`Alt+Shift+R` on Windows/Linux, `Option+Shift+R` on Mac)
- Pixel and centimeter scales in one overlay
- Toggle scales independently (`PX` and `CM`)
- Density presets: `Sparse`, `Normal`, `Dense`
- Adjustable opacity (`20%` to `90%`)
- Adjustable ruler thickness and length
- Color palette themes: `Steel`, `Graphite`, `Ocean`, `Emerald`, `Amber`, `Rose`
- Drag directly with mouse, snap to viewport edges
- Pin in place (`Pin Here`) or pin to start/end side
- Centimeter calibration mode (`bank card 85.60 mm` or `5 cm` reference)
- Per-domain saved orientation/position/pin/snap
- Global saved opacity/density/theme/scales/thickness/calibration

## Local install

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the project folder.

## How To Use

1. Open any regular website (`http` or `https`).
2. Open the extension popup and click **Turn On**.
3. Choose ruler orientation:
   `Horizontal` or `Vertical`.
4. Drag the ruler with mouse to position it.
5. If needed, lock position with:
   `Pin Here`, `Pin Top/Left`, or `Pin Bottom/Right`.
6. Use **Unpin** to make the ruler movable again.
7. Adjust appearance:
   `Opacity`, `Thickness`, `Length`, `Palette`, and `Tick Density`.
8. Toggle scales independently:
   `Show PX scale` and `Show CM scale`.
9. For accurate centimeters, run **Calibrate cm** and save calibration.
10. Use hotkeys:
    `Alt+R` / `Option+R` to toggle,
    `Alt+Shift+R` / `Option+Shift+R` to switch orientation.

## Public Links

- Repository: [https://github.com/cafevoramar/Transparent-Ruler-Overlay](https://github.com/cafevoramar/Transparent-Ruler-Overlay)
- README: [https://github.com/cafevoramar/Transparent-Ruler-Overlay/blob/main/README.md](https://github.com/cafevoramar/Transparent-Ruler-Overlay/blob/main/README.md)
- Privacy Policy: [https://github.com/cafevoramar/Transparent-Ruler-Overlay/blob/main/PRIVACY_POLICY.md](https://github.com/cafevoramar/Transparent-Ruler-Overlay/blob/main/PRIVACY_POLICY.md)
- Store Listing Draft: [https://github.com/cafevoramar/Transparent-Ruler-Overlay/blob/main/STORE_LISTING.md](https://github.com/cafevoramar/Transparent-Ruler-Overlay/blob/main/STORE_LISTING.md)

## Notes

- Works on regular `http/https` pages.
- On internal browser pages (`chrome://...`) overlays are blocked by browser security.
- Calibration is device-specific and stored locally.
- To use mascot-based icons, place image at `assets/capybara-box.png` and run `bash scripts/regenerate_icons_from_mascot.sh`.

## Donate

Support development on Ko-fi:
[https://ko-fi.com/qqq0315](https://ko-fi.com/qqq0315)
