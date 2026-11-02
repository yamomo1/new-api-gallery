# -*- coding: utf-8 -*-
"""生成 New API 落库配置（v3 刻度：1 元 = 10 幕）

输出 docs/landing/*.json 与一段可直接粘贴到浏览器控制台的脚本。
核心关系：
  ModelRatio  = 上游输入价(USD/1M) / 2        # 因为 1 quota = $0.000002，ratio 1 ⇔ $2/1M
  ModelPrice  = 上游单次成本(USD)             # 按张/按秒计费的模型用这个
  幕          = quota / 513                   # 前端展示口径
"""

import io
import json
import os

FX = 7.30
MU_PER_QUOTA = 5136           # 1 幕 = 5,136 quota（1 元 = 10 幕）
os.makedirs('landing', exist_ok=True)


def dump(name, obj):
    text = json.dumps(obj, ensure_ascii=False, indent=2) + '\n'
    io.open(f'landing/{name}', 'w', encoding='utf-8', newline='\n').write(text)
    print(f'--- {name} ---')
    print(text)


# ---------------------------------------------------------- 文本：ModelRatio
# ratio = 输入价 / 2 ；completionRatio = 输出价 / 输入价
TEXT = [
    ("ymm-tx-s", 0.15, 0.60, 1.00),   # 轻量扩写
    ("ymm-tx-m", 2.50, 10.00, 1.00),  # 标准文案
    ("ymm-tx-l", 15.00, 60.00, 1.05),  # 深度推理（含 1.05 模型加价）
]
model_ratio = {m: round(p_in / 2 * mu, 6) for m, p_in, _, mu in TEXT}
completion_ratio = {m: round(p_out / p_in, 6) for m, p_in, p_out, _ in TEXT}
dump('1-ModelRatio.json', model_ratio)
dump('2-CompletionRatio.json', completion_ratio)

# ---------------------------------------------------------- 图片 / 视频：ModelPrice
IMAGE = [
    ("ymm-img-s-1k", 0.010), ("ymm-img-s-15k", 0.020), ("ymm-img-s-2k", 0.035),
    ("ymm-img-m-1k", 0.020), ("ymm-img-m-15k", 0.040), ("ymm-img-m-2k", 0.070),
    ("ymm-img-l-1k", 0.040), ("ymm-img-l-15k", 0.080), ("ymm-img-l-2k", 0.140),
]
# 视频一律按「单次调用总成本 ¥」登记（火山方舟 Doubao-Seedance-2.5 官方价格示例，2026-11-02）
# A 档纯生 5s；B 档含输入（10s 输入 + 10s 输出）
VIDEO_RMB_PER_CALL = [
    ("ymm-vid-25-480p-5s", 3.36),
    ("ymm-vid-25-720p-5s", 7.56),
    ("ymm-vid-25-1080p-5s", 18.71),
    ("ymm-vid-25-480p-10s-in", 8.07),
    ("ymm-vid-25-720p-10s-in", 18.14),
    ("ymm-vid-25-1080p-10s-in", 44.71),
]
model_price = {m: p for m, p in IMAGE}
for m, rmb_per_call in VIDEO_RMB_PER_CALL:
    model_price[m] = round(rmb_per_call / FX, 6)        # 单次总成本（USD）
dump('3-ModelPrice.json', model_price)

# ---------------------------------------------------------- 充值档位
TIERS = [(10, 0.00), (30, 0.00), (50, 0.02), (100, 0.03),
         (300, 0.04), (500, 0.05), (1000, 0.06)]
amount_options = [a for a, _ in TIERS]
amount_discount = {str(a): round(1 / (1 + b), 4) for a, b in TIERS if b > 0}
dump('4-amount_options.json', amount_options)
dump('5-amount_discount.json', amount_discount)

# ---------------------------------------------------------- 会员分组倍率
group_ratio = {"vip": 0.89}
dump('6-GroupRatio-vip.json', group_ratio)

# ---------------------------------------------------------- 校验
print('=== 校验（quota → 幕 → 实付 → 毛利）===')
QUOTA_PER_USD = 500000
checks = []
for m, p_in, p_out, mu in TEXT:
    for tin, tout, label in [(200, 800, 'tx-s'), (800, 600, 'tx-m'), (1200, 1500, 'tx-l')]:
        if not m.endswith(label.split('-')[1]):
            continue
        ratio = model_ratio[m]
        comp = completion_ratio[m]
        quota = tin * ratio + tout * ratio * comp
        mu_n = quota / MU_PER_QUOTA
        checks.append((m, quota, mu_n, mu_n * 0.10, 1 - (tin * p_in + tout * p_out) / 1e6 * mu * FX / (mu_n * 0.10)))
for m, p in model_price.items():
    quota = p * QUOTA_PER_USD
    mu_n = quota / MU_PER_QUOTA
    checks.append((m, quota, mu_n, mu_n * 0.10, 1 - p * FX / (mu_n * 0.10)))
for name, quota, mu_n, pay, margin in checks:
    print(f'{name:<24} quota={quota:>10.0f}  幕={mu_n:>8.1f}  实付¥{pay:>7.2f}  毛利{margin * 100:>6.2f}%')
