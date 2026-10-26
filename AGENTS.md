# 給之後的代理人

這個 repo 是 Emil 所有吉他練習工具的唯一家。新工具加在這裡，不要再開一個 repo。

## 約定

- 每個工具一個子資料夾，從 repo 根目錄算起。現在有 `chord/`（已上線）、`metronome/`、`log/`、`fretboard/`（骨架，即將推出）。之後的工具同樣各開一個新資料夾。
- 共用程式只放 `shared/`，每個工具用相對路徑 import，不要複製一份：
  - `shared/diagram.js`：指板與和弦圖 SVG
  - `shared/theory.js`：包在 `vendor/tonal` 上的理論
  - `shared/audio.js`：Web Audio 撥弦
  - `shared/styles/base.css`：全站樣式
  - `shared/pitch.js`：空弦音高，給上面幾個模組用
- 第三方程式庫只放 `vendor/`，每個目錄附上授權檔。不要用 CDN。更新用 `node scripts/vendor.mjs`，而且只收 MIT 或相容授權。
- 工具自己的邏輯、文案、樣式留在該工具的資料夾。第二個工具也需要同一段程式時，再升到 `shared/`。
- 新工具要在 `shared/registry.js` 加一筆。首頁只讀這份清單來畫工具卡，不要在 `index.html` 手寫。
- 維持純靜態 HTML、CSS、原生 JS ES modules。不要後端，也不要為了開啟頁面而建置。
- 介面文字用繁體中文（zh-Hant-TW）。Dorian、shell voicing、guide tone 這類音樂詞可以留英文。
- 狀態放 `localStorage` 和網址 hash。第一次載入後要能離線，也要能在 iPhone Safari 使用。
