#!/usr/bin/env python3
"""批量导入分层计价表达式到 New API。

用法：
    export NEWAPI_TOKEN='sk-xxx'                 # 管理员令牌
    python3 scripts/apply_tiered_billing.py --dry-run   # 只看将要写入什么
    python3 scripts/apply_tiered_billing.py --apply     # 真正写入

可选：
    --base https://cdymm.com      站点地址（默认读 NEWAPI_BASE，或 https://cdymm.com）
    --file docs/pricing/tiered-expr.json
    --models glm-5.3,kimi-k3       只处理指定模型

说明：
- 只写 billing_mode / billing_expr 两个字段，不动旧倍率（切回旧模式仍可用）。
- 写入前先 GET 拿 expected_version 做冲突检查，冲突会报错并跳过该模型。
- 模型名必须与「渠道」里填的模型名一致，否则不生效；脚本不负责改名。
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_FILE = "docs/pricing/tiered-expr.json"


def request(base, path, token, method="GET", payload=None):
    url = base.rstrip("/") + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise SystemExit("HTTP %s on %s: %s" % (e.code, path, body[:400]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("NEWAPI_BASE", "https://cdymm.com"))
    ap.add_argument("--file", default=DEFAULT_FILE)
    ap.add_argument("--models", default="")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    token = os.environ.get("NEWAPI_TOKEN")
    if not token:
        raise SystemExit("请先 export NEWAPI_TOKEN='sk-xxx'（管理员令牌）")

    with open(args.file, encoding="utf-8") as f:
        table = json.load(f)

    wanted = [m.strip() for m in args.models.split(",") if m.strip()]
    names = wanted or [k for k in table if not k.startswith("_")]
    if not names:
        raise SystemExit("没有要处理的模型")

    # 1) 拿当前版本（expected_version 冲突检查需要）
    query = "&".join("model=" + urllib.parse.quote(n) for n in names)
    snap = request(args.base, "/api/option/model_pricing?" + query, token)
    entries = (snap.get("data") or {}).get("entries") or snap.get("data") or []
    versions = {}
    for e in entries:
        if isinstance(e, dict) and e.get("model_name"):
            versions[e["model_name"]] = e.get("version", "")

    changes = []
    skipped = []
    for name in names:
        cfg = table.get(name)
        if not cfg:
            skipped.append((name, "表里没有这个模型"))
            continue
        version = versions.get(name)
        if version is None:
            print("[warn] %s：后台查不到该模型（渠道里是否已添加？）仍会尝试写入" % name)
        elif version == "":
            skipped.append((name, "拿不到 version，跳过"))
            continue
        changes.append({
            "model_name": name,
            "expected_version": version or "",
            "pricing": {
                "billing_mode": cfg.get("billing_mode", "tiered_expr"),
                "billing_expr": cfg["billing_expr"],
            },
        })

    if args.dry_run or not args.apply:
        print("== DRY RUN（未写入）==  共 %d 个模型" % len(changes))
        for c in changes:
            print("\n[%s]\n  %s" % (c["model_name"], c["pricing"]["billing_expr"]))
        for name, why in skipped:
            print("\n[skip] %s: %s" % (name, why))
        print("\n确认无误后加 --apply 真正写入")
        return

    if not changes:
        raise SystemExit("没有可写入的变更")

    res = request(args.base, "/api/option/model_pricing", token, method="PATCH",
                  payload={"changes": changes})
    print("写入结果:", json.dumps(res, ensure_ascii=False)[:800])
    for name, why in skipped:
        print("[skip] %s: %s" % (name, why))


if __name__ == "__main__":
    sys.exit(main())
