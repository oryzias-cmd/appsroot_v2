import os
import subprocess
from gtts import gTTS

# 出力先ディレクトリ
OUT_DIR = os.path.join("audio", "words")
os.makedirs(OUT_DIR, exist_ok=True)

# ▼ 単語リスト（ひらがな・ローマ字・画像名と揃える）
words = [
  { "key": "ari", "text": "あり" },
  { "key": "wagomu", "text": "わごむ" }
]

def tts_save(text, filepath):
    tts = gTTS(text=text, lang="ja", slow=False)
    tts.save(filepath)

def make_slow(infile, outfile):
    # ピッチは変えずに速度だけ 0.5 倍に
    subprocess.run([
        "ffmpeg", "-y", "-i", infile,
        "-filter:a", "atempo=0.5",
        outfile
    ], check=True)

for w in words:
    base = os.path.join(OUT_DIR, w["key"])
    normal = base + "_normal.mp3"
    slow   = base + "_075.mp3"

    # 通常音声
    tts_save(w["text"], normal)
    # ゆっくり版
    make_slow(normal, slow)

    print(f"{w['text']} → {normal}, {slow}")

print("✅ ア行の音声ファイルを作成しました")
