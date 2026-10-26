# 給之後的代理人

這個 repo 是 Emil 所有吉他練習工具的唯一家。新工具加在這裡，不要再開一個 repo。

## 約定

- 每個工具一個子資料夾，從 repo 根目錄算起。現在有 `chord/`（已上線）、`metronome/`、`log/`、`fretboard/`（骨架，即將推出）。之後的工具同樣各開一個新資料夾。
- 共用程式只放 `shared/`，每個工具用相對路徑 import，不要複製一份：
  - `shared/diagram.js`：指板與和弦圖 SVG
  - `shared/theory.js`：包在 `vendor/tonal` 上的理論
  - `shared/audio.js`：撥弦。優先播 `shared/samples/` 的錄音，載入失敗才用 Karplus–Strong 合成
  - `shared/tone.js`：吉他音色選擇，各工具共用
  - `shared/styles/base.css`：全站樣式
  - `shared/pitch.js`：空弦音高，給上面幾個模組用
- 第三方程式庫只放 `vendor/`，每個目錄附上授權檔。不要用 CDN。更新用 `node scripts/vendor.mjs`，而且只收 MIT 或相容授權。
- 工具自己的邏輯、文案、樣式留在該工具的資料夾。第二個工具也需要同一段程式時，再升到 `shared/`。
- 新工具要在 `shared/registry.js` 加一筆。首頁只讀這份清單來畫工具卡，不要在 `index.html` 手寫。
- 維持純靜態 HTML、CSS、原生 JS ES modules。不要後端，也不要為了開啟頁面而建置。
- 介面文字用繁體中文（zh-Hant-TW）。Dorian、shell voicing、guide tone 這類音樂詞可以留英文。
- 狀態放 `localStorage` 和網址 hash。第一次載入後要能離線，也要能在 iPhone Safari 使用。

## 吉他音色

真實錄音放在 `shared/samples/<guitar>/`。不要改已經收進來的 mp3。每個吉他一個資料夾，檔名是 `s{弦}f{格}.mp3`（弦 1–6，1 是高音 E），旁邊有 `manifest.json`。目前有 `greco`（顯示名稱 Greco）和 `yamaha`（顯示名稱 Yamaha），都錄了空弦和 4、8、12 格。

再加一把吉他時：

1. 新增 `shared/samples/<id>/`，沿用同樣的檔名和 manifest。
2. 在 `shared/samples/index.js` 的 `GUITARS` 加一筆 `{ id, folder, name }`。
3. 在 `sw.js` 的 `SAMPLE_GUITARS` 加上同一個 id，第一次載入才會把取樣存進離線快取。

每個工具都用 `shared/audio.js` 撥弦，並用 `mountToneSelect`（`shared/tone.js`）畫出「吉他音色」。選擇寫在 `localStorage` 的 `guitar-tools.tone.v1`，所有工具讀同一把。選「合成」，或取樣還沒進快取、載入失敗時，回到 Karplus–Strong。
