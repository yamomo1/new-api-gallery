# -*- coding: utf-8 -*-
"""
一幕（YMM）点数计费模型核算脚本 · v2（利润 20% / 会员 15%）
------------------------------------------------------------
文档里每一个数字都由本脚本生成，改参数即可重算，保证「数值自洽可核算」。

口径：
- 毛利 = (收入 - 上游成本) / 收入
- 上游成本按 USD 计，折人民币用 FX
- 「幕」是唯一对客计价单位，1 幕 = ¥0.01（R0 = 100 幕/¥1，无赠送基准）
- 两级取整：理论幕（公式值）→ 挂牌幕（向上取整到易读档位，恒 ≥ 理论幕）

v2 相对 v1 的变更：
- 综合毛利验收线 30% → 20%；会员 23% → 15%
- 单品定价基准 M0 = 验收线 + 5pp 缓冲 = 25%（原 35%）
- 取整步长细化（≤50 取 1）：毛利变薄后「凑整」本身就会吃掉降价空间
- 视频价目用真实市场价（见 docs/视频模型真实成本与幕价对照.md）
"""

import math
from decimal import Decimal, ROUND_CEILING

# ---------------------------------------------------------------- 1. 基础参数
FX = 7.30                     # RMB / USD
QUOTA_PER_USD = 500_000       # New API QuotaPerUnit
R0 = 10.0                     # 幕 / ¥1（v3：1 元 = 10 幕，1 幕 = ¥0.10）
MU_PRICE_RMB = 1.0 / R0       # 单幕售价（¥）

GOODS_MARGIN = 0.25           # 单品定价基准毛利（= 20% 验收 + 5pp 缓冲）
TARGET_NORMAL = 0.20          # 普通用户综合毛利下限
TARGET_MEMBER = 0.15          # 会员综合毛利目标
PAY_FEE = 0.006               # 支付通道费

K_NOMINAL = FX * R0 / (1 - GOODS_MARGIN)               # 理论换算系数
QUOTA_PER_MU = math.floor(QUOTA_PER_USD / K_NOMINAL)   # 幕 → quota（向下取整，保证毛利不被反噬）
K = QUOTA_PER_USD / QUOTA_PER_MU                       # 实际换算系数
COST_PER_MU_RMB = FX / K                               # 单幕上游成本（¥）
M0 = 1 - COST_PER_MU_RMB / MU_PRICE_RMB                # 实际定价基准毛利率


def pct(x):
    return f"{x * 100:.2f}%"


def nice_mu(raw):
    """挂牌幕：<1 取 0.1、1–20 取 0.5、20–100 取 1、>100 取 2（幕 = 1 角，步长随档位放大）"""
    if raw < 1:
        step = Decimal("0.1")
    elif raw < 20:
        step = Decimal("0.5")
    elif raw < 100:
        step = Decimal("1")
    else:
        step = Decimal("2")
    q = (Decimal(str(raw)) / step).quantize(Decimal("1"), rounding=ROUND_CEILING)
    # 幕允许 1 位小数（最小计费 0.1 幕 = ¥0.01）
    return max(0.1, float((q * step).quantize(Decimal("0.1"))))


print("=" * 80)
print("1. 基础参数")
print("=" * 80)
print(f"FX                      = {FX} RMB/USD")
print(f"QuotaPerUnit            = {QUOTA_PER_USD:,} quota/USD")
print(f"单品定价基准毛利         = {pct(GOODS_MARGIN)}（20% 验收 + 5pp 缓冲）")
print(f"K 理论值                 = {K_NOMINAL:,.2f} 幕/USD")
print(f"1 幕                     = {QUOTA_PER_MU} quota（floor 取整）")
print(f"K 实际值                 = {K:,.2f} 幕/USD")
print(f"R0（幕/¥1）              = {R0:.0f}    单幕售价 ¥{MU_PRICE_RMB:.4f}")
print(f"单幕上游成本             = ¥{COST_PER_MU_RMB:.6f}")
print(f"实际定价基准毛利率 M0    = {pct(M0)}")

# ---------------------------------------------------------------- 2. 模型价目
TEXT_MODELS = [
    ("TX-S", "轻量扩写", 0.15, 0.60, 1.00),
    ("TX-M", "标准文案", 2.50, 10.00, 1.00),
    ("TX-L", "深度推理", 15.00, 60.00, 1.05),
]
IMAGE_MODELS = [
    ("IMG-S", "标准出图", {"1K": 0.010, "1.5K": 0.020, "2K": 0.035}, 1.00),
    ("IMG-M", "高清出图", {"1K": 0.020, "1.5K": 0.040, "2K": 0.070}, 1.00),
    ("IMG-L", "旗舰出图", {"1K": 0.040, "1.5K": 0.080, "2K": 0.140}, 1.00),
]
# 视频：火山方舟 Doubao-Seedance-2.5 官方价格示例（2026-11-02 截图核验）
# 元/秒 = 0.672(480P) / 1.512(720P) / 3.742(1080P)，换算 USD/秒 需 ÷ FX
VIDEO_MODELS = [
    ("VID-S", "标准视频", 0.0921, 1.00),   # 2.5 480P 5s：¥3.36
    ("VID-M", "高清视频", 0.2071, 1.00),   # 2.5 720P 5s：¥7.56
    ("VID-H", "旗舰视频", 0.5126, 1.00),   # 2.5 1080P 5s：¥18.71
]
TEXT_CALLS = [("TX-S", 200, 800), ("TX-M", 800, 600), ("TX-L", 1200, 1500)]
VIDEO_SECONDS = 5

print()
print("=" * 80)
print("2. 单次调用扣费档位")
print("=" * 80)
print(f"{'场景':<24}{'成本USD':>9}{'成本¥':>8}{'理论幕':>9}{'挂牌幕':>8}{'收入¥':>8}{'毛利':>9}")
print("-" * 80)

rows = []
CAT_TEXT, CAT_IMAGE, CAT_VIDEO = "文本", "图片", "视频"

for code, name, tin, tout, mu in TEXT_MODELS:
    cin, cout = next((i, o) for c, i, o in TEXT_CALLS if c == code)
    cost = (cin * tin + cout * tout) / 1_000_000 * mu
    raw = cost * K
    charged = nice_mu(raw)
    revenue = charged * MU_PRICE_RMB
    margin = 1 - cost * FX / revenue
    label = f"{name} in{cin}/out{cout}"
    rows.append((CAT_TEXT, label, cost, raw, charged, margin))
    print(f"{label:<24}{cost:>9.5f}{cost * FX:>8.4f}{raw:>9.2f}{charged:>8}{revenue:>8.2f}{pct(margin):>9}")

for code, name, prices, mu in IMAGE_MODELS:
    for size, price in prices.items():
        cost = price * mu
        raw = cost * K
        charged = nice_mu(raw)
        revenue = charged * MU_PRICE_RMB
        margin = 1 - cost * FX / revenue
        label = f"{name} {size}"
        rows.append((CAT_IMAGE, label, cost, raw, charged, margin))
        print(f"{label:<24}{cost:>9.3f}{cost * FX:>8.4f}{raw:>9.2f}{charged:>8}{revenue:>8.2f}{pct(margin):>9}")

for code, name, per_sec, mu in VIDEO_MODELS:
    cost = per_sec * VIDEO_SECONDS * mu
    raw = cost * K
    charged = nice_mu(raw)
    revenue = charged * MU_PRICE_RMB
    margin = 1 - cost * FX / revenue
    label = f"{name} {VIDEO_SECONDS}s"
    rows.append((CAT_VIDEO, label, cost, raw, charged, margin))
    print(f"{label:<24}{cost:>9.3f}{cost * FX:>8.4f}{raw:>9.2f}{charged:>8}{revenue:>8.2f}{pct(margin):>9}")

print("-" * 80)
cat_avg = {}
for cat in (CAT_TEXT, CAT_IMAGE, CAT_VIDEO):
    vals = [r[5] for r in rows if r[0] == cat]
    cat_avg[cat] = sum(vals) / len(vals)
    print(f"{cat}平均毛利 {pct(cat_avg[cat]):<10}", end="")
print()
print(f"全档最低 {pct(min(r[5] for r in rows))} ｜ 全档最高 {pct(max(r[5] for r in rows))}")

# ---------------------------------------------------------------- 3. 充值套餐
print()
print("=" * 80)
print("3. 充值套餐梯度（赠送上限受 20% 验收线约束）")
print("=" * 80)
TIERS = [(10, 0.00), (30, 0.00), (50, 0.02), (100, 0.03),
         (300, 0.04), (500, 0.05), (1000, 0.06)]
print(f"{'档位¥':>8}{'基础幕':>10}{'赠送':>8}{'实发幕':>10}{'¥/幕':>10}{'毛利率':>9}")
print("-" * 80)
for amount, bonus in TIERS:
    base_mu = amount * R0
    issued = int(base_mu * (1 + bonus))
    unit = amount / issued
    margin = 1 - issued * COST_PER_MU_RMB / amount
    print(f"{amount:>8}{int(base_mu):>10}{pct(bonus):>8}{issued:>10}{unit:>10.4f}{pct(margin):>9}")
print("-" * 80)

MIX = {10: 0.20, 30: 0.25, 50: 0.20, 100: 0.15, 300: 0.10, 500: 0.06, 1000: 0.04}
blended_bonus = sum(MIX[a] * b for a, b in TIERS)
print(f"档位结构假设 {MIX}")
print(f"加权平均赠送 = {pct(blended_bonus)}")
print(f"加权后毛利率 = {pct(1 - (1 + blended_bonus) * R0 * FX / K)}")

b_max = (1 - TARGET_NORMAL) / (1 - M0) - 1
print(f"单档赠送上限 b_max = (1-20%)/(1-{pct(M0)}) - 1 = {pct(b_max)}")
print(f"最高档 6% {'在' if 0.06 <= b_max else '超出'}上限内"
      f" → 单档毛利 {pct(1 - (1 + 0.06) * R0 * FX / K)}")

# ---------------------------------------------------------------- 4. 会员
print()
print("=" * 80)
print("4. 会员方案（目标毛利 15%）")
print("=" * 80)
D = 0.89
ceiling_ratio = (1 - TARGET_MEMBER) / (1 - M0)
print(f"会员扣费折扣 d = {D}")
print(f"让利系数上限 = (1-15%)/(1-{pct(M0)}) = {ceiling_ratio:.4f}"
      f" → 单 ¥ 可用量最多比直充多 {(ceiling_ratio - 1) * 100:.1f}%")
print(f"临界折扣 d_min = 1 / {ceiling_ratio:.4f} = {1 / ceiling_ratio:.4f}"
      f"，即折扣不得低于 {10 / ceiling_ratio:.2f} 折")
print()
print(f"{'档位':<6}{'月费¥':>7}{'赠幕/月':>10}{'折扣':>7}{'可用当量':>10}{'毛利率':>9}{'等效让利':>10}")
print("-" * 80)
MEMBER_TIERS = [("轻享", 29), ("标准", 59), ("专业", 129)]
member_rows = []
for label, fee in MEMBER_TIERS:
    granted = int(round(fee * R0))
    usable = granted / D
    cost = usable * COST_PER_MU_RMB
    margin = 1 - cost / fee
    lift = usable / (fee * R0) - 1
    member_rows.append((label, fee, granted, usable, margin, lift))
    print(f"{label:<6}{fee:>7}{granted:>10}{D:>7}{usable:>10.0f}{pct(margin):>9}{pct(lift):>10}")

# ---------------------------------------------------------------- 5. 综合毛利
print()
print("=" * 80)
print("5. 综合毛利率瀑布（验收：≥ 20%）")
print("=" * 80)
REV_MIX = {CAT_IMAGE: 0.55, CAT_VIDEO: 0.20, CAT_TEXT: 0.25}
goods = sum(REV_MIX[c] * cat_avg[c] for c in REV_MIX)
print(f"收入结构假设 {REV_MIX}")
print(f"商品加权毛利 = {pct(goods)}（由 ① 给出）")
print()
steps = [
    ("① 商品加权毛利（含挂牌取整安全垫）", goods, True),
    (f"② 充值赠送摊薄（加权 {pct(blended_bonus)}）", -goods * blended_bonus, False),
    ("③ 支付通道费 0.60%", -PAY_FEE, False),
    ("④ 失败重试 / 退款损耗 0.80%（假设）", -0.008, False),
    (f"⑤ 会员结构让利（会员占充值收入 25%，毛利差 {100 * (goods - member_rows[1][4]):.1f}pp）",
     -0.25 * (goods - member_rows[1][4]), False),
]
acc = 0.0
print(f"{'环节':<50}{'影响':>9}{'累计毛利率':>12}")
print("-" * 80)
for label, delta, is_base in steps:
    if is_base:
        acc = delta
    else:
        acc += delta
    print(f"{label:<50}{pct(delta):>9}{pct(acc):>12}")
print("-" * 80)
verdict = "✅ 达标（≥20%）" if acc >= TARGET_NORMAL else "❌ 未达标"
print(f"综合毛利率 = {pct(acc)}   {verdict}   安全垫 {(acc - TARGET_NORMAL) * 100:.2f}pp")

# ---------------------------------------------------------------- 6. 敏感性
print()
print("=" * 80)
print("6. 敏感性分析")
print("=" * 80)
print("6.1 汇率波动（R0 与 K 固定）")
print(f"{'FX':>8}{'单幕成本¥':>12}{'毛利率':>10}{'结论':>12}")
print("-" * 80)
for fx in (6.80, 7.00, 7.30, 7.60, 7.80, 7.90):
    c = fx / K
    m = 1 - c / MU_PRICE_RMB
    flag = "安全" if m >= TARGET_NORMAL else ("临界" if m >= 0.18 else "预警")
    print(f"{fx:>8.2f}{c:>12.6f}{pct(m):>10}{flag:>12}")
print(f"红线：FX > {K * MU_PRICE_RMB * (1 - TARGET_NORMAL):.2f} 时毛利率跌破 20%")

print()
print("6.2 会员折扣上限（目标毛利 15%）")
print(f"{'折扣 d':>8}{'会员毛利率':>12}{'结论':>8}")
print("-" * 80)
for d in (0.95, 0.92, 0.89, 0.88, 0.85, 0.82):
    m = 1 - (R0 * FX / K) / d
    print(f"{d:>8.2f}{pct(m):>12}{'✅' if m >= TARGET_MEMBER else '❌':>8}")

print()
print("6.3 上游涨价容忍度（售价不变）")
tol = (1 - TARGET_NORMAL) / (1 - M0) - 1
print(f"成本上涨容忍上限 = (1-20%)/(1-{pct(M0)}) - 1 = {pct(tol)}（超过即破 20% 线）")
print(f"{'场景':<24}{'原毛利':>9}{'涨10%后':>10}{'涨20%后':>10}{'结论':>10}")
print("-" * 80)
for r in [rows[3], rows[8], rows[12]]:
    cat, label, cost, raw, charged, margin = r
    m10 = 1 - cost * 1.10 * FX / (charged * MU_PRICE_RMB)
    m20 = 1 - cost * 1.20 * FX / (charged * MU_PRICE_RMB)
    flag = "✅" if m20 >= TARGET_NORMAL else "⚠️ 需调价"
    print(f"{label:<24}{pct(margin):>9}{pct(m10):>10}{pct(m20):>10}{flag:>10}")
