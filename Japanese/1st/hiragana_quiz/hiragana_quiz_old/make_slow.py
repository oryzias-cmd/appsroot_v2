from gtts import gTTS
import subprocess

# 1. 元の音声を作成
tts = gTTS("いちご", lang="ja")
tts.save("ichigo_raw.mp3")

# 2. ffmpeg で 0.75倍速（高さは維持）
subprocess.run([
    "ffmpeg", "-y", "-i", "ichigo_raw.mp3",
    "-filter:a", "atempo=0.5",
    "ichigo_05.mp3"
])

print("✅ asagao_075.mp3 を作成しました（高さ維持）")
