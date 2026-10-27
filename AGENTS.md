# 給之後的代理人

這個 repo 是 Emil 所有吉他練習工具的唯一家。新工具加在這裡，不要再開一個 repo。

## 約定

- 每個工具一個子資料夾，從 repo 根目錄算起。現在有 `chord/`、`metronome/`、`log/`、`fretboard/`（都已上線）。之後的工具同樣各開一個新資料夾。
- 共用程式只放 `shared/`，每個工具用相對路徑 import，不要複製一份：
  - `shared/diagram.js`：指板與和弦圖 SVG
  - `shared/theory.js`：包在 `vendor/tonal` 上的理論
  - `shared/audio.js`：撥弦，只用 `shared/samples/` 的錄音。載入失敗就顯示錯誤、不出聲
  - `shared/tone.js`：吉他音色選擇，各工具共用
  - `shared/styles/base.css`：全站樣式
  - `shared/pitch.js`：空弦音高，給上面幾個模組用
  - `shared/boxes.js`：五聲框 1–5，和弦頁和指板訓練共用
- 第三方程式庫只放 `vendor/`，每個目錄附上授權檔。不要用 CDN。更新用 `node scripts/vendor.mjs`，而且只收 MIT 或相容授權。
- 工具自己的邏輯、文案、樣式留在該工具的資料夾。第二個工具也需要同一段程式時，再升到 `shared/`。
- 新工具要在 `shared/registry.js` 加一筆。首頁只讀這份清單來畫工具卡，不要在 `index.html` 手寫。
- 維持純靜態 HTML、CSS、原生 JS ES modules。不要後端，也不要為了開啟頁面而建置。
- 介面文字用繁體中文（zh-Hant-TW）。Dorian、shell voicing、guide tone 這類音樂詞可以留英文。
- 狀態放 `localStorage` 和網址 hash。第一次載入後要能離線，也要能在 iPhone Safari 使用。

## 節拍器網址 hash

學習地圖用這個 hash 直接打開一個預設。出現下面任一參數時，以 hash 為準，沒寫的用預設，不跟這台裝置的 `localStorage` 混在一起。完全沒有 hash 時才讀 `guitar-tools.metronome.v1`。

參數接在 `#` 後面，格式同 query string。斜線可以寫 `/` 或 `%2F`。實作在 `metronome/timing.js` 的 `parseHash` / `serializeHash`。

| 參數 | 值 | 預設 |
| --- | --- | --- |
| `bpm` | 30–300 的整數。一拍是拍號的分母：4/4 是四分音符，6/8、7/8、12/8 是八分音符 | `100` |
| `meter` | `2/4` `3/4` `4/4` `5/4` `6/8` `7/8` `12/8` | `4/4` |
| `subdivision` | `quarter` `eighth` `triplet` `sixteenth`，把每一拍分成 1、2、3、4 聲 | `quarter` |
| `swing` | 50–75 的整數。只有 `subdivision=eighth` 聽得到。50 是平直八分，67 約三連音 2:1，75 是 3:1。數字是第一個八分音符佔這一拍的百分比 | `50` |
| `accents` | 每拍一個字，長度必須等於拍號分子。`a` 重音、`n` 普通、`m` 靜音。靜音的那一拍，細分也不響。長度不合就回到該拍號的預設 | `4/4` 是 `annn`。6/8、12/8 每三拍的第一拍是 `a` |
| `mute` | `出聲/靜音` 的小節數，例如 `2/2`。`0` 或 `off` 代表關閉 | `2/0` |
| `ladder` | `起始-目標-每段增加-每段小節`，例如 `80-120-5-4`。目標比較小就往下走。`off` 代表關閉 | `off` |

`volume`（0–100，預設 80）和 `flash`（`1` 開拍點閃光）可以省略。階梯關著但數字被改過時，頁面會寫 `ladder=off:90-130-4-2` 這種形式；學習地圖不用產生它，寫 `off` 或省略即可。

60 BPM、八分音符、只在第 2 與第 4 拍點擊：

```
metronome/#bpm=60&meter=4/4&subdivision=eighth&swing=50&accents=mama
```

`accents=mama` 是第 1、3 拍靜音，第 2、4 拍重音。頁面載入後可能補上 `mute=2/0&ladder=off`，聽到的拍相同。

## 學習地圖嵌入

學習地圖（https://emilwu.github.io/guitar-learning-map/）會把工具嵌在 iframe，或用 `?from=map` 打開。這兩種情況都顯示「← 回學習地圖」。在 iframe 裡連結用 `target="_top"`，並隱藏站頭、站尾，版面收緊。判斷和連結在 `shared/embed.js`，由 `shared/pwa.js` 載入，所以每個有載入 pwa 的工具都會有。`shared/embed-boot.js` 放在各頁 `<head>`，iframe 一解析就加上 `is-embedded`，避免先閃出站頭。

各工具的 `<head>` 保留這一行（首頁沒有 `../`）：

```html
<script src="../shared/embed-boot.js"></script>
```

不要加 `X-Frame-Options`，也不要加會擋住同一個 GitHub Pages origin 的 `Content-Security-Policy` `frame-ancestors`。學習地圖和這個站都在 `emilwu.github.io`，嵌入必須成功。

## 練習紀錄網址 hash

學習地圖的「練習」做完，用這個 hash 打開練習紀錄並預填表單，不會自動儲存。出現下面任一參數就以 hash 為準。完全沒有這些參數時，表單是空白（日期是今天）。實作在 `log/log.js` 的 `parseHash` / `serializeHash`。

參數接在 `#` 後面，格式同 query string。中文用一般的百分號編碼。

| 參數 | 值 |
| --- | --- |
| `stage` | 自由文字。純數字會在 Markdown 裡寫成 `Stage 2` 這種 |
| `week` | 自由文字。純數字會寫成 `第 3 週` |
| `exercise` | 練習名稱 |
| `tool` | `chord`、`metronome`、`fretboard`、`other`。其他文字當成 `other` |
| `bpm` | 1–400 的整數。空的或超出範圍就省略 |
| `date` | 選填，`YYYY-MM-DD`。省略則用今天 |
| `minutes` | 選填，分鐘，可以是小數 |
| `seconds` | 選填，秒，會加在分鐘上 |
| `rating` | 選填，1–5 的整數，乾淨度／穩定度 |
| `stuck` | 選填，卡點。太長時網址會把這段拿掉，表單裡仍可寫到 2000 字 |

Stage 2、第 3 週、練習「八分音符」、節拍器、60 BPM：

```
log/#stage=2&week=3&exercise=八分音符&tool=metronome&bpm=60
```

紀錄存在 `localStorage` 的 `guitar-tools.log.v1`。計時器另外存在 `guitar-tools.log.timer.v1`。計時中離開分頁會照牆鐘繼續走，停止只把時長填進表單，要按儲存才會留下。匯出的 Markdown 是一張表：日期、Stage/週、練習、時長、BPM、評分、卡點，給計畫裡的 `PRACTICE_LOG.md` 貼上。

節拍器頁有「記錄這次練習」，開到上面的 hash，並帶上當下聽到的 BPM 與 `tool=metronome`。若節拍器網址有 `?from=map`，連結會保留它。

## 吉他音色

真實錄音放在 `shared/samples/<guitar>/`。這些 mp3 是從 Emil 的錄音原檔切分、轉檔產生的，不要個別手動修改。重錄時從新的原檔整批重新產生、整組替換，同時更新 `manifest.json` 並升級 `sw.js` 的快取版本。每個吉他一個資料夾，檔名是 `s{弦}f{格}.mp3`（弦 1–6，1 是高音 E），旁邊有 `manifest.json`。目前有 `greco`（顯示名稱 Greco）和 `yamaha`（顯示名稱 Yamaha），都錄了空弦和 4、8、12 格。

再加一把吉他時：

1. 新增 `shared/samples/<id>/`，沿用同樣的檔名和 manifest。
2. 在 `shared/samples/index.js` 的 `GUITARS` 加一筆 `{ id, folder, name }`。
3. 在 `sw.js` 的 `SAMPLE_GUITARS` 加上同一個 id，第一次載入才會把取樣存進離線快取。

每個要出吉他聲的工具都用 `shared/audio.js` 撥弦，並用 `mountToneSelect`（`shared/tone.js`）畫出「吉他音色」。選擇寫在 `localStorage` 的 `guitar-tools.tone.v1`，所有工具讀同一把。只有登記過的吉他。舊的 `synth` 會改寫成 Greco。取樣還在載入時排隊，載入失敗顯示「取樣載入失敗，請重新整理」，不要另做合成撥弦。節拍器的點擊不是吉他音色，留在 `metronome/`。

## 指板訓練的 hash

`fretboard/` 已上線。學習地圖要深連時，用 `fretboard/#` 後面的查詢字串，不要為了預設另開頁面。沒寫的參數用預設。升記號寫成 `%23`。

| 參數 | 值 | 預設 |
| --- | --- | --- |
| `mode` | `find` 找音、`name` 識音、`interval` 音程、`scale` 音階 | `find` |
| `imode` | `locate` 找出音程、`name` 說出音程 | `locate` |
| `strings` | `1`–`6` 的數字，`1` 是高音 E，例如 `321` | `654321` |
| `frets` | `最小-最大`，0 到 15，例如 `0-12` | `0-12` |
| `naturals` | `1` 或 `0` | `0` |
| `timer` | 秒數，`0` 表示不計時 | `0` |
| `spell` | `sharp` 或 `flat` | `sharp` |
| `sound` | `1` 或 `0` | `1` |
| `key` | 音名，例如 `A`、`Bb`、`F%23` | `A` |
| `scale` | `major`、`minor`、`maj-pent`、`min-pent`、`blues` | `min-pent` |
| `shape` | CAGED：`C`、`A`、`G`、`E`、`D`。五聲第 1 框是 `E` | `E` |
| `degrees` | 級數，逗號分開，例如 `b3,3,5,b7`。`#4` 會收成 `b5` | 十二個級數 |

例子：`fretboard/#mode=find&naturals=1&frets=0-12&timer=60`、`fretboard/#mode=scale&key=A&scale=min-pent&shape=E`。設定另外寫在 `localStorage` 的 `guitar-tools.fretboard.v1`，統計在 `guitar-tools.fretboard.stats.v1`。五聲框的格子資料在 `shared/boxes.js`，和弦頁也用同一份。
