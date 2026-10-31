"""把 comfyui-ymm-bridge 打包成站内可下载的 zip。

背景
----
客户安装 ymm-bridge 走的是站内静态包 /downloads/ymm-bridge.zip
（落地页 /comfyui 的「下载节点」按钮）。这个 zip 是构建产物，必须可复现，
所以生成动作放在本脚本里，而不是手工压一个扔进 public。

节点源码独立维护，默认放在仓库同级的 ../comfyui-ymm-bridge/，
也可以在命令行指定：

    python scripts/pack-comfyui-bridge.py
    python scripts/pack-comfyui-bridge.py --src /path/to/comfyui-ymm-bridge

zip 内顶层目录固定为 comfyui-ymm-bridge/ —— 客户解压后整个目录放进
ComfyUI/custom_nodes/ 即可，不用再套一层（套多了节点加载不到）。
"""

from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

TOP = "comfyui-ymm-bridge"
SKIP_DIRS = {"__pycache__", ".git", ".idea", ".vscode"}
SKIP_EXT = {".pyc", ".pyo", ".part"}

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = REPO_ROOT.parent / TOP
OUT_PATH = REPO_ROOT / "web" / "public" / "downloads" / "ymm-bridge.zip"


def pack(src: Path, out: Path) -> int:
    if not src.is_dir():
        print(f"[error] node source not found: {src}", file=sys.stderr)
        print(
            "        节点源码不在仓库内，请用 --src 指定其所在目录。",
            file=sys.stderr,
        )
        return 1
    if not (src / "__init__.py").is_file():
        print(f"[error] {src}/__init__.py missing — is this the node root?", file=sys.stderr)
        return 1

    out.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(src.rglob("*")):
            if not path.is_file():
                continue
            rel_parts = path.relative_to(src).parts
            if any(part in SKIP_DIRS for part in rel_parts[:-1]):
                continue
            if path.suffix.lower() in SKIP_EXT:
                continue
            zf.write(path, f"{TOP}/{Path(*rel_parts).as_posix()}")
            count += 1

    size = out.stat().st_size
    print(f"packed {count} files -> {out}")
    print(f"size = {size} bytes ({size / 1024:.1f} KB)")
    print("记得把 web/src/features/comfyui-bridge/config.ts 的 BRIDGE_ZIP_SIZE 一并更新。")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="pack comfyui-ymm-bridge into web/public")
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC, help="node source directory")
    parser.add_argument("--out", type=Path, default=OUT_PATH, help="output zip path")
    args = parser.parse_args()
    return pack(args.src.resolve(), args.out.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
