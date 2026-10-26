# 吉他練習工具

給 Stage 1–2 的靜態練習頁。風格以 Jazz 為主，也涵蓋 Neo Soul、Funk、Post Rock、Fusion、Blues、J-Rock／J-Pop。用 GitHub Pages 從 `main` 分支的根目錄發布即可，這個 repo 不需要建置步驟。

## 工具

| 代號 | 名稱 | 狀態 |
| --- | --- | --- |
| T1 | [和弦探索器](chord/) | 可用 |
| T2 | [節拍器](metronome/) | 可用 |
| T3 | 練習紀錄 | 即將推出 |
| T4 | [指板訓練](fretboard/) | 可用 |

和弦探索器可以：

- 輸入和弦符號（`C`、`Am7`、`G7`、`Dm7b5`、`Cmaj9`、`E7#9`、`sus4`、`dim7`）。只打性質時，先當成 C。
- 看最多 6 個按法，跨度不超過 4 格：常用開放／封閉、E 型與 A 型封閉、shell voicing（R-3-7、R-7-3）、上四弦 Drop 2。點一下撥弦，預設用 Greco 的錄音，也可以改成 Yamaha 或合成。
- 看組成音、音程與公式，整支指板依音程標色。
- 看 1-2-3 弦與 2-3-4 弦的三和弦根音位置和兩個轉位，並標出離目前按法最近的一個。
- 選音階：maj 用 major pentatonic、Ionian、Lydian；m 用 minor pentatonic、Dorian、Aeolian；7 用 Mixolydian、Blues；m7b5 用 Locrian。落點音是和弦音，避免音是卡在和弦音上方半音的音階音（Lydian 的 #4、Blues 的藍調音除外）。
- 五聲框 1–5。第 1 框的根音在第 6 弦，所以 A minor pentatonic 第 1 框在第 5 格。
- 接下一個和弦，或選 V7→I、ii–V–I、IV→iv。下一個按法取總半音移動最少的握法，並畫出共同音與 guide tone（3、7 音）。

狀態寫在網址 hash 和 `localStorage`。例如 `chord/#chord=Am7&next=D7`。

節拍器可以：

- BPM 30–300：數字、滑桿、±1、±5、點拍。
- 拍號 2/4、3/4、4/4、5/4、6/8、7/8、12/8。BPM 是分母那一拍的速度。
- 細分：四分、八分、三連音、十六分。八分可以 Swing，從 50% 平直到 75%；67% 接近三連音 2:1。
- 點每一拍切換重音、普通、靜音。Jazz 預設只在第 2 與第 4 拍點擊。
- 靜音小節：出聲 N 小節、關掉 M 小節，用來練內在拍。
- BPM 階梯：起始、目標、每段增加、每段小節。走到目標後維持那個速度。
- 大拍點給譜架看，可開閃光。重音、正拍、細分的聲音不一樣。空白鍵開始或停止，方向鍵調目前聽到的 BPM。

點擊用 Web Audio 的 lookahead 排在音訊時鐘上。喚醒計時器只負責把下一段點擊排進去，拍距不靠它。分頁在背景時會一次排比較長的時間；瀏覽器若把分頁整個暫停，回到前景會對齊，不會補點一長串。iOS 可能在背景直接停掉聲音。

### 節拍器網址 hash

學習地圖用 hash 直接打開一個預設。只要出現下面任一參數，就以 hash 為準，沒寫的用預設，不跟這台裝置存的設定混用。沒有 hash 時才讀 `localStorage` 的 `guitar-tools.metronome.v1`。參數接在 `#` 後面，斜線寫 `/` 或 `%2F` 都可以。

| 參數 | 值 | 預設 |
| --- | --- | --- |
| `bpm` | 30–300 的整數 | `100` |
| `meter` | `2/4` `3/4` `4/4` `5/4` `6/8` `7/8` `12/8` | `4/4` |
| `subdivision` | `quarter` `eighth` `triplet` `sixteenth` | `quarter` |
| `swing` | 50–75。只有八分音符聽得到。50 平直，67 約三連音 2:1，75 是 3:1 | `50` |
| `accents` | 每拍一個字，長度等於拍號分子。`a` 重音、`n` 普通、`m` 靜音 | `4/4` 為 `annn` |
| `mute` | `出聲/靜音` 小節，例如 `2/2`。`0` 表示關閉 | `2/0` |
| `ladder` | `起始-目標-每段增加-每段小節`，例如 `80-120-5-4`。`off` 表示關閉 | `off` |

`volume`（0–100，預設 80）和 `flash`（`1` 開閃光）可以省略。階梯關著但數字被改過時，網址會變成 `ladder=off:90-130-4-2`。學習地圖寫 `off` 或省略即可。

60 BPM、八分音符、只在 2 與 4 拍點擊：

```
metronome/#bpm=60&meter=4/4&subdivision=eighth&swing=50&accents=mama
```

`accents=mama` 是第 1、3 拍靜音，第 2、4 拍重音。打開之後網址可能多出 `mute=2/0&ladder=off`，聽到的拍一樣。

指板訓練可以：

- 找音：看到音名，把選定弦與品格範圍裡的每一格都點出來。
- 識音：指板亮一個點，從 12 個音名裡選。C# 和 Db 都算對，可以改偏好的寫法。
- 音程：給一個根音，找出 3、b3、5、b7 這些級數；或看兩個點，說出音程。b5 與 #4、#5 與 b6 算同一個。
- 音階／五聲框：選調、音階（大調、自然小調、大調五聲、小調五聲、藍調 Blues）和 CAGED 框，靠記憶把框點滿再對答案。五聲第 1 框是 E 型，根音在第 6 弦。
- 每條弦可以單獨開關，品格有 0–12、0–15 和自訂。可以只練自然音，也可以計時（例如 60 秒）。
- 答題時用同一組吉他音色撥弦：Greco、Yamaha 或合成。
- 桌面可用鍵盤。識音把 z 列當鋼琴（z 是 C，黑鍵是 s d g h j）。Enter 看答案或下一題。
- 每個音、每一弦的正確率和平均反應時間留在這台裝置，指板上用熱圖標出比較不穩的格子，可以清除統計。

### 指板訓練的網址 hash

學習地圖可以用 hash 深連到一組預設。寫在 `fretboard/#` 後面，用 `&` 相接。沒寫的參數用預設。升記號寫成 `%23`，例如 `key=F%23`。

| 參數 | 意思 | 預設 |
| --- | --- | --- |
| `mode` | `find` 找音、`name` 識音、`interval` 音程、`scale` 音階 | `find` |
| `imode` | 音程子模式：`locate` 找出音程、`name` 說出音程 | `locate` |
| `strings` | 要練的弦，`1` 是高音 E | `654321` |
| `frets` | 品格範圍，含兩端，最大 15 | `0-12` |
| `naturals` | `1` 只練自然音，`0` 十二個音 | `0` |
| `timer` | 秒數，`0` 是不計時 | `0` |
| `spell` | `sharp` 升記號、`flat` 降記號 | `sharp` |
| `sound` | `1` 答題時出聲，`0` 靜音 | `1` |
| `key` | 音階的調，例如 `A`、`Bb`、`F%23` | `A` |
| `scale` | `major`、`minor`、`maj-pent`、`min-pent`、`blues` | `min-pent` |
| `shape` | CAGED：`C`、`A`、`G`、`E`、`D` | `E` |
| `degrees` | 音程要出現的級數，逗號分開 | `R,b2,2,b3,3,4,b5,5,#5,6,b7,7` |

例如：

- 找音，只練自然音，0–12 格，60 秒：`fretboard/#mode=find&naturals=1&frets=0-12&timer=60`
- 識音，降記號，只練 1–3 弦：`fretboard/#mode=name&spell=flat&strings=321`
- 找出 b3、3、5、b7：`fretboard/#mode=interval&imode=locate&degrees=b3,3,5,b7`
- 說出兩個點的音程：`fretboard/#mode=interval&imode=name`
- A 小調五聲 E 型（第 1 框）：`fretboard/#mode=scale&key=A&scale=min-pent&shape=E`

## 一個 repo，之後的工具都放這裡

這個 repo 是所有練習工具的家，不要再開新的 repo。每個工具一個子資料夾：`chord/`、`metronome/`、`fretboard/` 已上線，`log/` 是即將推出的骨架。新工具同樣在根目錄開資料夾，從 `shared/` 引用指板 SVG、理論、撥弦和全站樣式，第三方程式庫只用 `vendor/`，並在 `shared/registry.js` 登記一筆。首頁的工具卡只讀這份清單。約定寫在 [AGENTS.md](AGENTS.md)。

## 在本機開啟

需要一個靜態檔案伺服器（ES modules 不能用 `file://`）。

```bash
python3 -m http.server 8765
```

然後開 <http://127.0.0.1:8765/>。手機 Safari 用同一個區域網路位址即可。

第一次載入會註冊 service worker，把頁面、樣式、腳本和 `vendor/` 存進瀏覽器。之後可以關網路再重新整理。

## 測試

```bash
node --test test/*.test.js
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
9. 打開節拍器的 60 BPM 八分音符預設（hash 是 `bpm=60&meter=4/4&subdivision=eighth&swing=50&accents=mama`），第 1 與第 3 拍靜音、第 2 與第 4 拍是重音。空白鍵可以開始，方向鍵可以調 BPM。
10. 把視窗縮到手機寬度，開始、點拍、拍點都點得到，大數字在譜架距離仍看得清。
11. 打開指板訓練的找音（`fretboard/#mode=find&naturals=1&frets=0-12&timer=60`），把範圍裡的每一格點完再看答案。識音、音程、A 小調五聲 E 型也各走一輪。手機寬度下指板可以橫向捲動，音名按鈕點得到。

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

- T3 練習紀錄只有資料夾和「即將推出」頁，功能還沒做。
- 節拍器的點擊是合成的，不是鼓組。Swing 只作用在八分音符；67% 是三連音 2:1 的整數近似（實際約 66.7%）。
- BPM 是拍號分母的速度。靜音小節時大數字不跟每一拍跳。階梯走到目標後會停在目標速度。
- 分頁在背景時用音訊時鐘排程。瀏覽器若把計時器拉得很慢，仍靠較長的預排撐住；若整個頁面被暫停，回到前景會對齊而不補點。iOS 可能在背景直接停掉聲音。
- 指板訓練用標準調弦，品格收到第 15 格。音階框會挑落在所選範圍裡的那個八度，框本身不切開；放不進 15 格的把位不會出現。
- 只練自然音時，找音和識音只出 C D E F G A B；音階的調也只留這七個。音程的根音同樣限自然音，目標音仍可能是變化音。
- 指板統計跟設定分開存在這台裝置。清除統計不會清設定，也不會清吉他音色。
- shell voicing 只按 R、3、7，九和弦的 9 音與 m7b5 的 b5 要看指板，不一定在 shell 裡。
- Drop 2 只做上四弦。
- 減七的 bb7 在音名上會顯示成較好讀的等音（例如 Bbb 顯示成 A），音程仍標 bb7。
- 撥弦預設用 Greco 的錄音，也可以選 Yamaha。同一弦挑最近的取樣，用播放速度移調；超過 12 格就從 12 格往上移。取樣載不到時才用 Karplus–Strong。
- 吉他音色存在 `localStorage` 的 `guitar-tools.tone.v1`，之後的工具共用。
- 離線要等第一次載入把 service worker 裝好，再開一次。
- 這個變更沒有替你打開 GitHub Pages。
