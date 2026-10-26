/** Short Traditional Chinese notes per chord quality. Music terms stay in English. */

const COPY = {
  major: {
    title: "大三和弦",
    body: "穩定的主和弦或大調 IV。聽起來開、亮，沒有一定要解決的拉力。J-Pop、J-Rock 的副歌、Post Rock 的長音牆，還有 Blues 的 I 和弦，都常停在這裡。",
  },
  minor: {
    title: "小三和弦",
    body: "小調的主和弦，或大調的 ii、iii、vi。比大三和弦暗一點，但還是安定。Neo Soul 的循環、J-Rock 的副歌前段、Post Rock 的乾淨分解都很常見。",
  },
  "7": {
    title: "屬七和弦",
    body: "功能上要把音樂拉回 I。3 音和 b7 音就是 guide tone。Blues 可以一直停在 7 和弦不解決；Funk 用它做一個和弦的節奏 vamp；Jazz 的 ii–V–I 裡，V7 負責把句子送回家。",
  },
  maj7: {
    title: "大七和弦",
    body: "大三和弦加上大七度，亮但比較柔軟。Jazz 的 Imaj7、Neo Soul 的墊底和弦、J-Pop 的轉折都愛用。大七度不要彈得太重，讓它浮在上面。",
  },
  m7: {
    title: "小七和弦",
    body: "小三和弦加 b7。Jazz 的 ii7、Neo Soul 與 Funk 的長循環、Fusion 的 modal vamp 都是它。搭 Dorian 時，大六度是色彩，和弦音才是落點。",
  },
  m7b5: {
    title: "半減七和弦 m7b5",
    body: "小三、減五、b7，也寫成 ø。大調 ii–V–I 的小調版本裡，它是 iiø，後面常接 V7 再回 i。Jazz 標準曲很常見；shell voicing 先抓住 R、b3、b7，減五度在指板上補。",
  },
  dim: {
    title: "減三和弦",
    body: "小三加減五，張力很尖，通常是路過。可以把一個和弦音當成目標，半音解決到下一個和弦。J-Rock 的過門、Jazz 的經過和弦會短暫用到。",
  },
  dim7: {
    title: "減七和弦",
    body: "小三、減五、減七，四個音彼此都是小三度。任何一個音都能當根音，所以同一個把位可以滑去四個地方。Jazz 用來連到下一個屬七或主和弦；不要停太久。",
  },
  aug: {
    title: "增三和弦",
    body: "大三加增五，聽起來懸空。常用來把一個大三和弦的五度往上推半音，再解決。Fusion 與 Post Rock 的轉場可以拿它當一個很短的顏色。",
  },
  aug7: {
    title: "增五屬七",
    body: "屬七的五度被升高，張力比一般 V7 更尖。guide tone 還是 3 和 b7，#5 負責把聲音往外推。Jazz 的 V7 可以用它代替普通的屬七，再解決到 I。",
  },
  sus2: {
    title: "sus2",
    body: "用 2 音代替 3 音，沒有大小調的決定。Post Rock 與 J-Rock 的分解、Funk 的乾淨切音都很適合。它不要求解決，可以一直懸著。",
  },
  sus4: {
    title: "sus4",
    body: "用 4 音代替 3 音。可以解決回大三或小三，也可以不解決。J-Pop 的鋼琴感和弦、Post Rock 的開放把位、Funk 的 16 分切音都常用 sus4。",
  },
  "7sus4": {
    title: "7sus4",
    body: "屬七的懸浮版：有 b7，但用 4 音代替 3 音。張力比較圓，不像 V7 那麼衝。Neo Soul 與 Jazz 的 V 可以先彈 7sus4，再落到 7 或直接回 I。",
  },
  maj9: {
    title: "大九和弦",
    body: "maj7 再加 9 音，是 Neo Soul 和 Jazz 最常見的「好看的大和弦」。9 音是色彩，落點仍是 R、3、7。Fusion 的墊底、J-Pop 的結尾都可以留在 maj9。",
  },
  m9: {
    title: "小九和弦",
    body: "m7 加 9 音。比 m7 更暖，Neo Soul 的 ii 或 vi、Jazz 的 minor ii–V 前半都很適合。9 音輕輕帶過，不要蓋過 b3 和 b7。",
  },
  9: {
    title: "屬九和弦",
    body: "屬七加 9 音。Funk 的一個和弦 vamp、Jazz 的 V7、Blues 的 turnaround 都很常用。它還是要解決的屬和弦，9 音只是讓切音更厚。",
  },
  "7#9": {
    title: "屬七升九 7#9",
    body: "同時有大三度與 #9（聽起來像小三度），又尖又髒。Funk、Blues、Fusion 的 dominant 代表音色，J-Rock 的過門也借得動。先聽 3 音和 b7，#9 是摩擦。",
  },
  "7b9": {
    title: "屬七降九 7b9",
    body: "b9 緊貼根音，張力比 7#9 更暗。Jazz 的小調 ii–V–i 裡，V7b9 很常見，guide tone 仍走向 I 的 3 和 7。b9 不要當落點。",
  },
  6: {
    title: "六和弦",
    body: "大三和弦加 6 音，比 maj7 更開、沒有大七度的甜。Jazz 的 I 和弦、Blues 的結尾、Neo Soul 的節奏和弦都可以用 6 代替大三。",
  },
  m6: {
    title: "小六和弦",
    body: "小三和弦加大六度，Dorian 的味道。比 m7 更亮一點。Jazz 的 minor 主和弦、Neo Soul 的色彩和弦會用到。",
  },
  add9: {
    title: "add9",
    body: "大三和弦加 9 音，但沒有七度。比 maj9 單純，J-Pop、Post Rock、J-Rock 的開放和弦最常見。9 音是空氣，和弦本身仍然穩定。",
  },
  madd9: {
    title: "madd9",
    body: "小三和弦加 9 音，沒有七度。Neo Soul 與 J-Pop 的小調和弦想要一點光的時候用它。落點還是 R、b3、5。",
  },
  13: {
    title: "屬十三和弦",
    body: "屬七的家族，13 音讓 Funk 與 Jazz 的 V7 更寬。吉他很少把每個音都按滿，抓住 R、3、b7、13 就夠。它仍然想解決到 I。",
  },
  alt: {
    title: "變化屬七 alt",
    body: "屬七同時帶著變化九度與增五。張力最大的 V7，Jazz 用來把 ii–V 的最後一下推出去。guide tone 照樣解決，變化音只負責摩擦。",
  },
  mmaj7: {
    title: "小大七 mmaj7",
    body: "小三度配大七度，又暗又亮。Fusion 與 Jazz 的 minor 主和弦、電影感的 Post Rock 轉折會用。搭 melodic minor，大七度是色彩也是和弦音。",
  },
  other: {
    title: "這個和弦",
    body: "先聽根音、三度（或 sus 的代替音）與七度。延伸音是色彩，句子的落點放回和弦音。不確定功能時，把它放進 ii–V–I 裡聽一次。",
  },
};

export function explainChord(chord) {
  return COPY[chord.qualityKey] || COPY.other;
}
