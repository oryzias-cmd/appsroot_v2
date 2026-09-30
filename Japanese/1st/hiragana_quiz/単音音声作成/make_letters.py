import os, subprocess
from gtts import gTTS

OUT_DIR = os.path.join("audio", "letters")  # 既存と同じ出力先
os.makedirs(OUT_DIR, exist_ok=True)

kana_list = [
    ("a","あ"), ("i","い"), ("u","う"), ("e","え"), ("o","お"),
    ("ka","か"), ("ki","き"), ("ku","く"), ("ke","け"), ("ko","こ"),
    ("sa","さ"), ("shi","し"), ("su","す"), ("se","せ"), ("so","そ"),
    ("ta","た"), ("chi","ち"), ("tsu","つ"), ("te","て"), ("to","と"),
    ("na","な"), ("ni","に"), ("nu","ぬ"), ("ne","ね"), ("no","の"),
    ("ha","は"), ("hi","ひ"), ("fu","ふ"), ("he","へ"), ("ho","ほ"),
    ("ma","ま"), ("mi","み"), ("mu","む"), ("me","め"), ("mo","も"),
    ("ya","や"), ("yu","ゆ"), ("yo","よ"),
    ("ra","ら"), ("ri","り"), ("ru","る"), ("re","れ"), ("ro","ろ"),
    ("wa","わ"), ("wo","を"), ("n","ん"),
]

def post_process(infile, outfile):
    # 高域(3kHz付近)を+3dB、全体音量を+2dB ＝ 明るく＆聞きやすく
    # equalizer: f=3000Hz を Q=1.0 で +3dB
    subprocess.run([
        "ffmpeg", "-y", "-i", infile,
        "-filter:a", "equalizer=f=3000:t=q:w=1.0:g=3,volume=2dB",
        outfile
    ], check=True,
       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for fname, kana in kana_list:
    tmp = os.path.join(OUT_DIR, f"_{fname}.mp3")
    out = os.path.join(OUT_DIR, f"{fname}.mp3")
    # ① 合成
    gTTS(text=kana, lang="ja", slow=False).save(tmp)
    # ② 後処理（ピッチ固定のまま明るさ・音量だけ）
    post_process(tmp, out)
    os.remove(tmp)
    print(f"{out} 完了")
print("✅ 単音 仕上げ完了（ピッチ固定・EQ/音量のみ）")
