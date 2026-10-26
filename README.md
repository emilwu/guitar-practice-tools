# 吉他練習工具

給 Stage 1–2 的靜態練習頁。風格以 Jazz 為主，也涵蓋 Neo Soul、Funk、Post Rock、Fusion、Blues、J-Rock／J-Pop。用 GitHub Pages 從 `main` 分支的根目錄發布即可，這個 repo 不需要建置步驟。

## 工具

| 代號 | 名稱 | 狀態 |
| --- | --- | --- |
| T1 | [和弦探索器](chord/) | 可用 |
| T2 | 節拍器 | 即將推出 |
| T3 | 練習紀錄 | 即將推出 |
| T4 | 指板訓練 | 即將推出 |

和弦探索器可以：

- 輸入和弦符號（`C`、`Am7`、`G7`、`Dm7b5`、`Cmaj9`、`E7#9`、`sus4`、`dim7`）。只打性質時，先當成 C。
- 看最多 6 個按法，跨度不超過 4 格：常用開放／封閉、E 型與 A 型封閉、shell voicing（R-3-7、R-7-3）、上四弦 Drop 2。點一下用 Web Audio 撥弦，沒有取樣檔。
- 看組成音、音程與公式，整支指板依音程標色。
- 看 1-2-3 弦與 2-3-4 弦的三和弦根音位置和兩個轉位，並標出離目前按法最近的一個。
- 選音階：maj 用 major pentatonic、Ionian、Lydian；m 用 minor pentatonic、Dorian、Aeolian；7 用 Mixolydian、Blues；m7b5 用 Locrian。落點音是和弦音，避免音是卡在和弦音上方半音的音階音（Lydian 的 #4、Blues 的藍調音除外）。
- 五聲框 1–5。第 1 框的根音在第 6 弦，所以 A minor pentatonic 第 1 框在第 5 格。
- 接下一個和弦，或選 V7→I、ii–V–I、IV→iv。下一個按法取總半音移動最少的握法，並畫出共同音與 guide tone（3、7 音）。

狀態寫在網址 hash 和 `localStorage`。例如 `chord/#chord=Am7&next=D7`。

## 一個 repo，之後的工具都放這裡

這個 repo 是所有練習工具的家，不要再開新的 repo。每個工具一個子資料夾：`chord/` 已上線，`metronome/`、`log/`、`fretboard/` 是即將推出的骨架。新工具同樣在根目錄開資料夾，從 `shared/` 引用指板 SVG、理論、撥弦和全站樣式，第三方程式庫只用 `vendor/`，並在 `shared/registry.js` 登記一筆。首頁的工具卡只讀這份清單。約定寫在 [AGENTS.md](AGENTS.md)。

## 在本機開啟

需要一個靜態檔案伺服器（ES modules 不能用 `file://`）。

```bash
python3 -m http.server 8765
```

然後開 <http://127.0.0.1:8765/>。手機 Safari 用同一個區域網路位址即可。

第一次載入會註冊 service worker，把頁面、樣式、腳本和 `vendor/` 存進瀏覽器。之後可以關網路再重新整理。

## 測試

```bash
node --test test/accept.test.js
```

不需要額外的測試框架。

### 手動驗收清單

1. 開啟和弦頁，依序輸入 `Am7`、`Dm7b5`、`E7#9`、`Cmaj9`、`Csus4`、`Cdim7`，組成音與公式正確。
2. `C`、`Am`、`G7` 至少有 3 個按法，手指跨度不超過 4 格。
3. 點一個按法，聽得到由低到高的撥弦。iPhone 需要先點一下才會出聲。
4. 選 A minor pentatonic，第 1 框在第 6 弦第 5 格。
5. 按「看 C 調 ii–V–I」，guide tone 是 F→F→E 與 C→B→B。
6. 把視窗縮到手機寬度，按鈕可以點，指板可以橫向捲動。
7. 第一次開完後關掉網路，重新整理，首頁和和弦頁仍在。
8. 畫面上的說明是繁體中文；Dorian、shell voicing、guide tone、Drop 2 這些音樂詞保留英文。

## 如何更新 vendor 函式庫

執行時才會下載，網站本身不靠這支腳本。

```bash
node scripts/vendor.mjs
```

目前釘選：

- `@tonaljs/tonal@4.10.0`（MIT）→ `vendor/tonal/tonal.js`，只打包 Chord、Note、Scale、Interval。
- `@tombatossals/chords-db@0.5.1`（MIT）→ `vendor/chords-db/guitar.js`。已拿掉斜槓低音，並只留至少 3 個音、跨度 4 格以內的按法。

腳本會讀每個套件的 `license` 欄位，不是 MIT（或相容的 MIT 宣告）就會中止。授權全文在各目錄的 `LICENSE`。沒有使用 CDN。指板與和弦圖是這個 repo 自己的 SVG，不依賴 fretboard.js。

## 已知限制

- T2 節拍器、T3 練習紀錄、T4 指板訓練只有資料夾和「即將推出」頁，功能還沒做。
- shell voicing 只按 R、3、7，九和弦的 9 音與 m7b5 的 b5 要看指板，不一定在 shell 裡。
- Drop 2 只做上四弦。
- 減七的 bb7 在音名上會顯示成較好讀的等音（例如 Bbb 顯示成 A），音程仍標 bb7。
- 撥弦是 Karplus–Strong 合成，不是吉他取樣。
- 離線要等第一次載入把 service worker 裝好，再開一次。
- 這個變更沒有替你打開 GitHub Pages。
