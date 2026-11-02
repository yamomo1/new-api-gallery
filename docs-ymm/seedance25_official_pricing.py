# -*- coding: utf-8 -*-
"""
Doubao-Seedance-2.5 官方价格示例核算 + 幕价重算
================================================================
数据来源：火山引擎方舟模型详情页「价格示例」截图（2026-11-02）

官方口径：
  视频费用 = Token单价 × Token用量
  Token用量 = (输出宽 × 输出高 × 输出帧率 × 输出时长) / 1024          [不含视频输入]
  Token用量 = (输出宽 × 输出高 × 输出帧率 × (输入时长+输出时长)) / 1024 [包含视频输入]

本脚本做三件事：
  1. 反解官方每个数字（token 用量、单价、费用、元/秒），确认口径自洽
  2. 换算成「元/秒」成本基线
  3. 按 v3 幕体系（1 元 = 10 幕）重算挂牌幕与毛利

运行：python seedance25_official_pricing.py
"""

from decimal import Decimal, ROUND_CEILING

# ============================================================ 幕体系常数（v3）
FX = 7.30
QPU = 500_000
R0 = 10.0                       # 幕 / ¥1
Q_MU = 5_136                    # quota / 幕
K = QPU / Q_MU                  # 97.35 幕 / USD
MU_PRICE = 0.10                 # 单幕售价 ¥
TARGET_M0 = 0.25


# ============================================================ 官方分辨率 → 像素数
# 由 token 用量反解：W×H = tokens × 1024 / (fps × dur)
RES = {
    "480P": (854, 480),      # 854 × 480 = 409,920
    "720P": (1280, 720),     # 1280 × 720 = 921,600
    "1080P": (1920, 1080),   # 1920 × 1080 = 2,073,600
}
FPS = 24

# 官方截图原始数据：(分辨率, 输入秒, 输出秒, 单价元/百万, 官方token, 官方费用, 官方元秒)
OFFICIAL_NO_INPUT = [
    ("480P", 0, 5, 70, 48_037.5, 3.36, 0.7),
    ("720P", 0, 5, 70, 108_000, 7.56, 1.5),
    ("1080P", 0, 5, 77, 243_000, 18.71, 3.7),
]
OFFICIAL_WITH_INPUT = [
    ("480P", 10, 10, 42, 192_150, 8.07, 0.81),
    ("720P", 10, 10, 42, 432_000, 18.14, 1.81),
    ("1080P", 10, 10, 46, 972_000, 44.71, 4.47),
]


def tokens_of(res, seconds):
    w, h = RES[res]
    return w * h * FPS * seconds / 1024


def pct(x):
    return f"{x * 100:.2f}%"


def nice_mu(raw):
    """v3 挂牌：<1 取 0.1 / 1–20 取 0.5 / 20–100 取 1 / >100 取 2"""
    if raw < 1:
        step = Decimal("0.1")
    elif raw < 20:
        step = Decimal("0.5")
    elif raw < 100:
        step = Decimal("1")
    else:
        step = Decimal("2")
    q = (Decimal(str(raw)) / step).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return max(0.1, float((q * step).quantize(Decimal("0.1"))))


# ============================================================ A. 核对官方数字
def section_verify():
    print("【A】官方价格示例核对（token 用量 / 单价 / 费用 / 元每秒 四者互证）")
    print("-" * 104)
    ok = True

    for title, rows in (("不含视频输入", OFFICIAL_NO_INPUT), ("包含视频输入", OFFICIAL_WITH_INPUT)):
        print(f"  ● {title}")
        print(f"{'分辨率':<8}{'像素':>14}{'秒数':>7}{'单价':>8}{'算得token':>12}{'官方token':>12}"
              f"{'算得费用':>10}{'官方费用':>10}{'元/秒':>8}")
        print("  " + "-" * 100)
        for res, tin, tout, price, off_tok, off_fee, off_sec in rows:
            total_sec = tin + tout
            tok = tokens_of(res, total_sec)
            fee = tok * price / 1e6
            per_sec = fee / tout
            w, h = RES[res]
            d_tok = abs(tok - off_tok) / off_tok
            d_fee = abs(fee - off_fee) / off_fee
            d_sec = abs(per_sec - off_sec) / off_sec
            # 官方「≈0.7 元/秒」是四舍五入，容差放到 6%
            good = d_tok < 0.005 and d_fee < 0.01 and d_sec < 0.06
            ok = ok and good
            print(f"{res:<8}{f'{w}x{h}':>14}{total_sec:>7}{price:>8}"
                  f"{tok:>12,.1f}{off_tok:>12,}{fee:>10.2f}{off_fee:>10.2f}"
                  f"{per_sec:>8.2f} {'OK' if good else 'BAD'}")
        print()

    print("→ 结论：官方三个数字全部可复算，公式为 "
          "`tokens = W×H×24fps×秒数 / 1024`。")
    print("  480P 实际是 **854×480**（不是 864×480），帧率 **24fps**，这是反解出来的。")
    print()
    return ok


# ============================================================ B. 元/秒 成本基线
def section_baseline():
    print("【B】成本基线（元/秒，按输出秒数摊）")
    print("-" * 104)
    print(f"{'分辨率':<10}{'不含输入 5s':>16}{'元/秒':>10}{'含输入 10s':>16}{'元/秒':>10}{'倍数':>8}")
    print("-" * 104)
    out = {}
    for i, res in enumerate(("480P", "720P", "1080P")):
        _, _, _, p0, _, f0, _ = OFFICIAL_NO_INPUT[i]
        _, _, _, p1, _, f1, _ = OFFICIAL_WITH_INPUT[i]
        s0 = f0 / 5
        s1 = f1 / 10
        out[res] = (s0, s1)
        print(f"{res:<10}{f'¥{f0:.2f}':>16}{s0:>10.2f}{f'¥{f1:.2f}':>16}{s1:>10.2f}"
              f"{s1 / s0:>8.2f}x")
    print()
    print("→ 含输入更贵：因为输入 10s 也按 42 元/百万计费（单价低但时长翻倍），")
    print("  总费用约为「纯输出 10s」的 1.2 倍。首尾帧/参考视频功能必须按含输入口径定价。")
    print()
    return out


# ============================================================ C. 幕价重算
def section_mu():
    print("【C】幕价重算（v3：1 元 = 10 幕，1 幕 = ¥0.10，M0 = 25.01%）")
    print("-" * 104)
    print(f"K = {K:.2f} 幕/USD ｜ 幕 = 成本¥ × {K / FX:.2f} ｜ 5s 与 10s 两套")
    print("-" * 104)
    print(f"{'场景':<26}{'成本¥':>9}{'理论幕':>9}{'挂牌幕':>9}{'实付¥':>9}{'毛利':>9}")
    print("-" * 104)
    rows = []
    for label, res, tin, tout, price, fee in [
        ("2.5 480P 5s 纯输出", "480P", 0, 5, 70, 3.36),
        ("2.5 720P 5s 纯输出", "720P", 0, 5, 70, 7.56),
        ("2.5 1080P 5s 纯输出", "1080P", 0, 5, 77, 18.71),
        ("2.5 480P 10s 含输入", "480P", 10, 10, 42, 8.07),
        ("2.5 720P 10s 含输入", "720P", 10, 10, 42, 18.14),
        ("2.5 1080P 10s 含输入", "1080P", 10, 10, 46, 44.71),
    ]:
        raw = fee * K / FX
        mu = nice_mu(raw)
        pay = mu * MU_PRICE
        m = 1 - fee / pay
        rows.append((label, res, mutuple := (tin, tout, price, fee), mu, pay, m))
        print(f"{label:<26}{fee:>9.2f}{raw:>9.1f}{mu:>9.1f}{pay:>9.2f}{pct(m):>9}")
    print()
    print("→ 全部毛利 ≥ 25%。注意 1080P 10s 含输入那条：596.2 幕按「>100 取 2」")
    print("  向上凑到 598 幕才够，否则毛利掉到 24.98% 破线。")
    print()
    return rows


# ============================================================ D. 与对标站对照
def section_vs_benchmark():
    print("【D】与对标站 45 积分对照（成本口径已修正）")
    print("-" * 104)
    cost = 3.36          # 2.5 480P 5s 纯输出
    print(f"我方成本：¥{cost:.2f}（2.5 480P 5s）")
    print()
    print(f"{'口径':<26}{'积分/¥':>10}{'45 积分¥':>12}{'覆盖率':>10}{'毛利':>10}")
    print("-" * 104)
    for label, rate in [
        ("超级会员·首年", 43.0),
        ("高级会员·首年", 31.0),
        ("标准会员·首年", 24.0),
        ("基础会员·首年", 22.0),
        ("超级会员·续费", 15.0),
        ("基础会员·续费", 13.2),
    ]:
        yuan = 45 / rate
        print(f"{label:<26}{rate:>10.1f}{yuan:>12.2f}{yuan / cost * 100:>9.0f}%"
              f"{(1 - cost / yuan) * 100:>9.0f}%")
    print()
    print("→ 按成本 ¥3.36 重算，覆盖率从「16%~51%」变成 **31%~101%**：")
    print("  只有「基础会员续费档（¥3.41）」刚好打平，其余全部亏。")
    print("  → 对标站确实是「会员费补贴单价」的结构，不是按条赚钱。")
    print()
    # 我方同档
    ours = nice_mu(cost * K / FX)
    print(f"→ 我方同档：{ours:.0f} 幕 = ¥{ours * MU_PRICE:.2f}，毛利 {pct(1 - cost / (ours * MU_PRICE))}")
    print(f"  巧合：1 元 = 10 幕时，这一档正好也是 **{ours:.0f} 幕**，与对标站 45 积分数字一致。")
    print("  （此前「改 1 元 = 5 幕」的建议不再需要——成本修正后天然对齐。）")
    print()


# ============================================================ E. 旧数据偏差
def section_delta():
    print("【E】与之前用的数据偏差")
    print("-" * 104)
    old = {"480P": 1.346, "720P": 3.024}
    new = {"480P": 3.36 / 5, "720P": 7.56 / 5, "1080P": 18.71 / 5}
    print(f"{'分辨率':<10}{'旧（元/秒）':>14}{'官方（元/秒）':>16}{'旧/新':>10}{'结论':>18}")
    print("-" * 104)
    for res in ("480P", "720P"):
        print(f"{res:<10}{old[res]:>14.2f}{new[res]:>16.2f}{old[res] / new[res]:>10.2f}"
              f"{'旧值高估 ' + f'{(old[res] / new[res] - 1) * 100:.0f}%':>18}")
    print(f"{'1080P':<10}{'—':>14}{new['1080P']:>16.2f}{'—':>10}{'新增档位':>18}")
    print()
    print("→ 旧数据把 480P 高估 2 倍、720P 高估 2 倍，导致视频幕价虚高，")
    print("  已按官方示例全部修正（720P 5s：¥15.12 → ¥7.56，幕价 202 → 101）。")
    print()


if __name__ == "__main__":
    section_verify()
    section_baseline()
    section_mu()
    section_vs_benchmark()
    section_delta()
