#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
import json
import argparse
import subprocess

try:
    from gtts import gTTS
except Exception as e:
    raise SystemExit("gTTS がインストールされていません。`pip install gTTS` を実行してください。")


def read_words_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    fixed = re.sub(r",\s*([\]\}])", r"\1", raw)
    data = json.loads(fixed)
    if not isinstance(data, list):
        raise SystemExit("JSONのルートは配列にしてください。")
    return [{"key": str(d["key"]).strip(), "text": str(d["text"]).strip()} for d in data]


def tts_save(text: str, filepath: str, lang: str = "ja", slow: bool = False):
    tts = gTTS(text=text, lang=lang, slow=slow)
    tts.save(filepath)


def make_speed(infile: str, outfile: str, atempo: float = 0.75):
    cmd = [
        "ffmpeg", "-y", "-i", infile,
        "-filter:a", f"atempo={atempo}",
        outfile
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def sanitize_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-]", "_", name)


def main():
    parser = argparse.ArgumentParser(description="ひらがな単語の音声ファイルを作成します（gTTS + ffmpeg）。")
    parser.add_argument("--infile", default="hiragana_flat_keytext_oneline.json")
    parser.add_argument("--outdir", default=os.path.join("audio", "words"))
    parser.add_argument("--lang", default="ja")
    parser.add_argument("--slow_tempo", type=float, default=0.5)
    parser.add_argument("--skip_slow", action="store_true")
    args = parser.parse_args()

    words = read_words_json(args.infile)
    os.makedirs(args.outdir, exist_ok=True)

    used = {}
    for w in words:
        base_key = sanitize_filename(w["key"])
        text = w["text"]
        count = used.get(base_key, 0) + 1
        used[base_key] = count
        key_for_file = base_key if count == 1 else f"{base_key}_{count}"

        basepath = os.path.join(args.outdir, key_for_file)
        normal = basepath + "_normal.mp3"
        slow   = basepath + f"_{str(args.slow_tempo).replace('.', '')}.mp3"

        tts_save(text, normal, lang=args.lang, slow=False)
        if not args.skip_slow:
            make_speed(normal, slow, atempo=args.slow_tempo)

        print(f"{text} → {normal}" + ("" if args.skip_slow else f", {slow}"))

    print("✅ すべての音声ファイルを作成しました。")


if __name__ == "__main__":
    main()
