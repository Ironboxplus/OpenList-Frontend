#!/usr/bin/env bash
# Sample files of .github/workflows/ui-compare.yml: the tree the Cloudreve
# comparison shoots (<root>/samples) and the audit tree mounted as /审计
# (<root>/samples-audit). The workflow caches <root> by this file's hash.
# usage: make-samples.sh <root>
set -e
ROOT="$1"
mkdir -p "$ROOT"
# Runner images differ: some lack ffmpeg (run 45802420770 sat silent here for
# 9 minutes). apt reads Ubuntu's own archive only, as in the OP repo's
# test-ours.yml, and none of the runner's other sources (Microsoft, PPAs on
# launchpad): on 2026-11-11 the runners could not resolve *.ubuntu.com or
# launchpad and apt waited on each of them. The archive is read through a
# mirror list (apt-transport-mirror(1)), tried by priority and the next one
# when one fails: on 2026-11-12 kernel.org's mirror stopped answering half way.
if ! command -v ffmpeg >/dev/null || ! command -v zip >/dev/null; then
  echo "make-samples: installing ffmpeg and zip"
  printf '%s\tpriority:%s\n' http://mirrors.edge.kernel.org/ubuntu/ 1 \
    http://azure.archive.ubuntu.com/ubuntu/ 2 http://archive.ubuntu.com/ubuntu/ 3 > /tmp/apt-mirrors.txt
  c=$(. /etc/os-release && echo "$VERSION_CODENAME")
  for p in "$c" "$c-updates" "$c-security"; do
    echo "deb mirror+file:/tmp/apt-mirrors.txt $p main universe"
  done > /tmp/apt-sources.list
  apt_opts="-o Dir::Etc::sourcelist=/tmp/apt-sources.list -o Dir::Etc::sourceparts=- -o APT::Get::List-Cleanup=0 -o Acquire::Retries=3"
  sudo apt-get $apt_opts update
  echo "make-samples: apt lists read"
  sudo apt-get $apt_opts install -y -qq --no-install-recommends ffmpeg zip >/dev/null
fi
echo "make-samples: $(ffmpeg -version | head -1)"

S="$ROOT/samples"
mkdir -p "$S/照片/2026 旅行" "$S/文档" "$S/视频" "$S/音乐"
for i in 1 2 3 4 5 6; do
  ffmpeg -loglevel error -f lavfi -i "gradients=s=1600x1000:seed=$i:n=4" -frames:v 1 "$S/照片/2026 旅行/IMG_00$i.jpg"
done
ffmpeg -loglevel error -f lavfi -i "gradients=s=1200x800:seed=42" -frames:v 1 "$S/照片/封面.png"
ffmpeg -loglevel error -f lavfi -i testsrc2=size=1280x720:rate=24 -f lavfi -i sine=frequency=440 -t 8 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$S/视频/示例视频.mp4"
ffmpeg -loglevel error -f lavfi -i sine=frequency=330 -t 5 "$S/音乐/示例音乐.mp3"
printf '# 说明\n\n这是一个示例目录。\n' > "$S/README.md"
printf 'hello\n' > "$S/文档/笔记.txt"
printf '{"a":1}\n' > "$S/文档/配置.json"
head -c 3000000 /dev/urandom > "$S/文档/归档.zip"
head -c 120000 /dev/urandom > "$S/文档/报告.pdf"
sudo chmod -R a+rwX "$S"

echo "make-samples: audit tree"
S="$ROOT/samples-audit"
mkdir -p "$S"/{空目录,长文件名,大目录,预览,文档,照片,媒体库}
d="$S/深层"
for i in 1 2 3 4 5 6 7 8; do
  d="$d/第${i}层-这是一个很长很长的目录名称用来测试左侧目录树的横向滚动-level${i}"
  mkdir -p "$d"; echo "level $i" > "$d/文件${i}.txt"
done
cn=$(printf '很长的文件名用来测试截断%.0s' 1 2 3 4 5 6)
echo x > "$S/长文件名/${cn}.txt"
echo x > "$S/长文件名/$(printf 'a%.0s' $(seq 1 200)).txt"
echo x > "$S/长文件名/with some spaces and (brackets) [and] {braces} 2026-11-26 final FINAL v2.txt"
for i in $(seq -w 1 400); do echo "$i" > "$S/大目录/文件_$i.txt"; done
for i in 1 2 3 4 5 6; do
  ffmpeg -loglevel error -f lavfi -i "gradients=s=800x500:seed=$i:n=4" -frames:v 1 "$S/照片/IMG_00$i.jpg"
done
cp "$S/照片/IMG_001.jpg" "$S/预览/图片.jpg"
ffmpeg -loglevel error -f lavfi -i testsrc2=size=1280x720:rate=24 -f lavfi -i sine=frequency=440 -t 8 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$S/预览/示例视频.mp4"
ffmpeg -loglevel error -f lavfi -i sine=frequency=330 -t 5 "$S/预览/示例音乐.mp3"
printf '第一行\n第二行 with English words\n%.0s' 1 2 3 4 5 6 7 8 > "$S/预览/文本.txt"
printf '# 标题\n\n正文 **加粗** 与 `代码`。\n\n- 条目一\n- 条目二\n\n| 列 | 值 |\n|---|---|\n| a | 1 |\n' > "$S/预览/说明.md"
printf '{"a":1,"b":[1,2,3]}\n' > "$S/预览/配置.json"
python3 - "$S/预览/报告.pdf" <<'PY'
import sys
objs = [
  b"<</Type/Catalog/Pages 2 0 R>>",
  b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
  b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
  None,
  b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
]
stream = b"BT /F1 24 Tf 72 700 Td (UI audit sample PDF) Tj ET"
objs[3] = b"<</Length %d>>\nstream\n" % len(stream) + stream + b"\nendstream"
out = b"%PDF-1.4\n"
offs = []
for i, o in enumerate(objs, 1):
  offs.append(len(out))
  out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
x = len(out)
out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
for o in offs:
  out += b"%010d 00000 n \n" % o
out += b"trailer\n<</Root 1 0 R/Size %d>>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
open(sys.argv[1], "wb").write(out)
PY
(cd "$S/预览" && zip -q "压缩包.zip" 图片.jpg 文本.txt 说明.md 配置.json)
cp "$S/预览/文本.txt" "$S/文档/笔记.txt"
cp "$S/预览/说明.md" "$S/文档/说明.md"
cp "$S/预览/配置.json" "$S/文档/配置.json"
cp "$S/预览/报告.pdf" "$S/文档/报告.pdf"
cp "$S/预览/压缩包.zip" "$S/文档/压缩包.zip"
# a torrent of one 1 MiB file in 64 pieces: its piece-hash dialog is a tall one
python3 - "$S/预览/种子.torrent" <<'PY'
import hashlib, sys
data = bytes(1024 * 1024)
plen = 16384
pieces = b"".join(hashlib.sha1(data[i:i + plen]).digest() for i in range(0, len(data), plen))
def be(x):
  if isinstance(x, int): return b"i%de" % x
  if isinstance(x, str): x = x.encode()
  if isinstance(x, bytes): return b"%d:" % len(x) + x
  if isinstance(x, list): return b"l" + b"".join(be(v) for v in x) + b"e"
  return b"d" + b"".join(be(k) + be(x[k]) for k in sorted(x)) + b"e"
info = {"name": "样本.bin", "length": len(data), "piece length": plen, "pieces": pieces}
open(sys.argv[1], "wb").write(be({"announce": "http://tracker.invalid/announce", "info": info}))
PY
printf '# 审计目录\n\n这里放了各种形状的文件。\n' > "$S/README.md"
echo "make-samples: media libraries"
# a media library: works are the folders directly under it
mk() { ffmpeg -loglevel error -f lavfi -i "testsrc2=size=640x360:rate=24:duration=3" -f lavfi -i sine=frequency=$2 -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$1"; }
i=0
for w in "电影甲 (2020)" "电影丙 (2019)" "电影丁 (2018)" "电影戊 (2017)"; do
  i=$((i+1)); mkdir -p "$S/媒体库/$w"; mk "$S/媒体库/$w/$w.mp4" $((300+i*40))
done
mkdir -p "$S/媒体库/剧集乙 (2021)/Season 1"
for e in 1 2 3; do mk "$S/媒体库/剧集乙 (2021)/Season 1/剧集乙 S01E0$e.mp4" $((500+e*30)); done
# a library the size of txcloud's 云下载: 78 folders, 69 of them works (one
# video each, the same small file), 9 without a video
for i in $(seq 1 69); do
  w="影片$i ($((1950 + i)))"
  mkdir -p "$S/大媒体库/$w"; cp "$S/媒体库/电影甲 (2020)/电影甲 (2020).mp4" "$S/大媒体库/$w/$w.mp4"
done
for i in $(seq 1 9); do mkdir -p "$S/大媒体库/资料$i"; echo x > "$S/大媒体库/资料$i/说明.txt"; done
sudo chmod -R a+rwX "$S"
# the workflow makes a restored tree again unless it carries this mark
touch "$ROOT/.complete"
