import os
import subprocess
from gtts import gTTS

# 出力先
WORD_DIR = "audio/words"
LETTER_DIR = "audio/letters"
os.makedirs(WORD_DIR, exist_ok=True)
os.makedirs(LETTER_DIR, exist_ok=True)

# 先生ご提供の全リスト（hira=答えの文字 / word=単語 / key=ファイル名ベース）
master = [
  {"hira":"あ","word":"あさがお","key":"asagao"},
  {"hira":"い","word":"いちご","key":"ichigo"},
  {"hira":"う","word":"うさぎ","key":"usagi"},
  {"hira":"え","word":"えんぴつ","key":"enpitsu"},
  {"hira":"お","word":"おりがみ","key":"origami"},

  {"hira":"か","word":"かたつむり","key":"katatsumuri"},
  {"hira":"き","word":"きのこ","key":"kinoko"},
  {"hira":"く","word":"くじら","key":"kujira"},
  {"hira":"け","word":"けんだま","key":"kendama"},
  {"hira":"こ","word":"こいのぼり","key":"koinobori"},

  {"hira":"さ","word":"さつまいも","key":"satumaimo"},
  {"hira":"し","word":"しんごう","key":"singou"},
  {"hira":"す","word":"すいか","key":"suika"},
  {"hira":"せ","word":"せんぷうき","key":"senpuuki"},
  {"hira":"そ","word":"そらまめ","key":"soramame"},

  {"hira":"た","word":"たいこ","key":"taiko"},
  {"hira":"ち","word":"ちりとり","key":"chiritori"},
  {"hira":"つ","word":"つき","key":"tsuki"},
  {"hira":"て","word":"てぶくろ","key":"tebukuro"},
  {"hira":"と","word":"とんぼ","key":"tonbo"},

  {"hira":"な","word":"なわとび","key":"nawatobi"},
  {"hira":"に","word":"にんじん","key":"ninjin"},
  {"hira":"ぬ","word":"ぬいぐるみ","key":"nuigurumi"},
  {"hira":"ね","word":"ねこ","key":"neko"},
  {"hira":"の","word":"のこぎり","key":"nokogiri"},

  {"hira":"は","word":"はさみ","key":"hasami"},
  {"hira":"ひ","word":"ひまわり","key":"himawari"},
  {"hira":"ふ","word":"ふくろう","key":"fukurou"},
  {"hira":"へ","word":"へちま","key":"hechima"},
  {"hira":"ほ","word":"ほたる","key":"hotaru"},

  {"hira":"ま","word":"まめ","key":"mame"},
  {"hira":"み","word":"みかん","key":"mikan"},
  {"hira":"む","word":"むしめがね","key":"mushimegane"},
  {"hira":"め","word":"めだまやき","key":"medamayaki"},
  {"hira":"も","word":"もも","key":"momo"},

  {"hira":"や","word":"やかん","key":"yakan"},
  {"hira":"ゆ","word":"ゆきだるま","key":"yukidaruma"},
  {"hira":"よ","word":"ようふく","key":"youfuku"},

  {"hira":"ら","word":"らくだ","key":"rakuda"},
  {"hira":"り","word":"りんご","key":"rinngo"},
  {"hira":"る","word":"るすばん","key":"rusuban"},
  {"hira":"れ","word":"れいぞうこ","key":"reizouko"},
  {"hira":"ろ","word":"ろうそく","key":"rousoku"},

  {"hira":"わ","word":"わりばし","key":"waribashi"},
  {"hira":"を","word":"ほんをよむ","key":"honwoyomu"},  # 単語音声はそのまま作成
  {"hira":"ん","word":"きりん","key":"kirin"}
]

# ひらがな→ローマ字（単音ファイル名）
hira2roma = {
  "あ":"a","い":"i","う":"u","え":"e","お":"o",
  "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
  "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
  "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
  "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
  "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
  "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
  "や":"ya","ゆ":"yu","よ":"yo",
  "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
  "わ":"wa","を":"wo","ん":"n"
}

def tts_save(text: str, filepath: str):
  tts = gTTS(text=text, lang="ja", slow=False)
  tts.save(filepath)

def make_slow_05(infile: str, outfile: str):
  # 声の高さは維持したまま 0.5 倍速に
  subprocess.run([
      "ffmpeg", "-y", "-i", infile,
      "-filter:a", "atempo=0.5",
      outfile
  ], check=True)

# ===== 単語（words） =====
for item in master:
  base = os.path.join(WORD_DIR, item["key"])
  normal = base + "_normal.mp3"
  slow05 = base + "_05.mp3"

  # 通常版
  if not os.path.exists(normal):
    try:
      tts_save(item["word"], normal)
      print("作成:", normal)
    except Exception as e:
      print("❌ 失敗:", normal, e)

  # 0.5倍速版
  if os.path.exists(normal) and not os.path.exists(slow05):
    try:
      make_slow_05(normal, slow05)
      print("作成:", slow05)
    except Exception as e:
      print("❌ 失敗:", slow05, e)

# ===== 単音（letters） =====
for hira, roma in hira2roma.items():
  path = os.path.join(LETTER_DIR, f"{roma}.mp3")
  if not os.path.exists(path):
    try:
      tts_save(hira, path)
      print("作成:", path)
    except Exception as e:
      print("❌ 失敗:", path, e)

print("✅ すべての音声作成が完了しました")
