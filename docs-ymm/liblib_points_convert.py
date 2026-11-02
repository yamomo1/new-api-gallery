# -*- coding: utf-8 -*-
"""
对标站（liblib）积分换算核算脚本
================================================================
数据来源：2026-11-02 站内截图
  · 会员定价页：393/1099/5199/19656，月赠 725/2210/12320/54600
  · 价签：Seedance 2.5 · 480P · 样片 · 5s = 45 积分

所有结论数字都从本脚本输出，文档不接受手改。
运行：python liblib_points_convert.py
"""

from decimal import Decimal, ROUND_CEILING

# ============================================================ 常量
FX = 7.30                    # USD/CNY（与主方案一致）
QPU = 500_000                # New API QuotaPerUnit
TARGET_M0 = 0.25             # 单品定价基准毛利（20% 验收线 + 5pp）

# 对标站会员档位：名称, 首年实付, 续费价, 月赠积分, 年额外赠额, 官方标称汇率
TIERS = [
    ("基础会员", 393,   659,   725,   0,          22),
    ("标准会员", 1099,  1599,  2210,  0,          24),
    ("高级会员", 5199,  10398, 12320, 4200,       31),
    ("超级会员", 19656, 43680, 54600, 42000 + 1600, 43),
]

# 价签：Seedance 2.5 480P 样片 5s = 45 积分
TARGET_POINTS = 45
TARGET_SECONDS = 5
# 火山引擎官方 API：Seedance 2.5 纯生 480p = 1.346 元/秒
COST_PER_SEC = 1.346


def pct(x):
    return f"{x * 100:.2f}%"


# ============================================================ A. 兑换率
def section_rate():
    print("【A】四档兑换率（积分 / ¥1）")
    print("-" * 100)
    head = (f"{'档位':<10}{'首年¥':>9}{'续费¥':>9}{'月均¥':>9}"
            f"{'月赠分':>8}{'官方标':>8}{'首年实算':>10}{'续费实算':>10}{'含赠/首年':>10}")
    print(head)
    print("-" * 100)
    out = []
    for name, first, renew, mu, bonus, official in TIERS:
        m_first = first / 12
        r_first = mu / m_first              # 首年折扣价口径
        r_renew = mu / (renew / 12)         # 续费价口径
        r_bonus = (mu * 12 + bonus) / first  # 含年赠额（首年）
        out.append({
            "name": name, "first": first, "renew": renew, "m_first": m_first,
            "mu": mu, "official": official,
            "r_first": r_first, "r_renew": r_renew, "r_bonus": r_bonus,
        })
        print(f"{name:<10}{first:>9,}{renew:>9,}{m_first:>9.2f}{mu:>8,}"
              f"{official:>8}{r_first:>10.1f}{r_renew:>10.1f}{r_bonus:>10.1f}")
    print()
    print("→ 官方标称只在首年折扣下成立；高档位（31/43）比实算（28.4/33.3）虚高，")
    print("  差额来自「叠加赠额」被重复计入。长期真实汇率 = 续费实算 13~17 积分/¥。")
    print()
    return out


# ============================================================ B. 45 积分折人民币
def section_points(rows):
    print(f"【B】{TARGET_POINTS} 积分折合人民币（换算对象：Seedance 2.5 480p 样片 {TARGET_SECONDS}s）")
    print("-" * 100)
    cost = COST_PER_SEC * TARGET_SECONDS
    print(f"    成本基准：{COST_PER_SEC} 元/秒 × {TARGET_SECONDS}s = ¥{cost:.2f}")
    print("-" * 100)
    print(f"{'口径':<28}{'积分/¥':>10}{'45 积分 = ¥':>14}{'折 元/秒':>11}{'对成本覆盖率':>14}")
    print("-" * 100)

    cases = [
        ("官方标称·超级会员（最便宜）", rows[3]["official"]),
        ("官方标称·高级会员", rows[2]["official"]),
        ("官方标称·标准会员", rows[1]["official"]),
        ("官方标称·基础会员（最贵）", rows[0]["official"]),
        ("续费实算·超级", rows[3]["r_renew"]),
        ("续费实算·标准", rows[1]["r_renew"]),
        ("续费实算·高级", rows[2]["r_renew"]),
        ("续费实算·基础", rows[0]["r_renew"]),
    ]
    lo = hi = None
    for label, rate in cases:
        yuan = TARGET_POINTS / rate
        lo = yuan if lo is None else min(lo, yuan)
        hi = yuan if hi is None else max(hi, yuan)
        print(f"{label:<28}{rate:>10.1f}{yuan:>14.2f}{yuan / TARGET_SECONDS:>11.2f}"
              f"{yuan / cost * 100:>13.0f}%")
    print()
    print(f"→ 区间 ¥{lo:.2f} ~ ¥{hi:.2f}；即使取上限 ¥{hi:.2f} 也只覆盖成本 {hi / cost * 100:.0f}%。")
    print()
    return lo, hi, cost


# ============================================================ C. 同级对比
def section_compare(lo, hi, cost):
    print("【C】同级对比（同模型 / 同分辨率 / 同时长）")
    print("-" * 100)
    # 我方 v3：1 元 = 10 幕，1 幕 = ¥0.10
    ours_mu = 90.0
    ours_yuan = ours_mu * 0.10
    print(f"{'':<12}{'标价':>12}{'折 ¥':>14}{'成本':>10}{'毛利':>12}")
    print("-" * 100)
    print(f"{'他们':<12}{'45 积分':>12}{f'¥{lo:.2f}~{hi:.2f}':>14}{f'¥{cost:.2f}':>10}"
          f"{f'{pct(1 - cost / lo)}~{pct(1 - cost / hi)}':>12}")
    print(f"{'我们 v3':<12}{'90 幕':>12}{f'¥{ours_yuan:.2f}':>14}{f'¥{cost:.2f}':>10}"
          f"{pct(1 - cost / ours_yuan):>12}")
    print()
    print(f"→ 我们比他们贵 {ours_yuan / hi:.1f}~{ours_yuan / lo:.1f} 倍：成本决定的，不是定价贪心。")
    print()


# ============================================================ D. 1 元 = 5 幕方案
K_NOM = FX * 5 / (1 - TARGET_M0)
Q_MU = int(QPU // K_NOM)          # 向下取整，保住毛利
K = QPU / Q_MU
C_MU = FX / K
M0 = 1 - C_MU / 0.20

SKUS = [
    # 名称, 成本 ¥
    ("标准图 1K", 0.0730),
    ("标准图 1.5K", 0.1460),
    ("标准图 2K", 0.2555),
    ("高清图 1K", 0.1460),
    ("高清图 1.5K", 0.2920),
    ("高清图 2K", 0.5110),
    ("旗舰图 1K", 0.2920),
    ("旗舰图 1.5K", 0.5840),
    ("旗舰图 2K", 1.0220),
    ("文本 轻量扩写", 0.0037),
    ("文本 标准文案", 0.0584),
    ("文本 深度推理", 0.8278),
    ("视频 mini 480p 5s", 2.3104),
    ("视频 mini 720p 5s", 4.9700),
    ("视频 2.0 720p 5s", 9.9389),
    ("视频 2.5 480p 5s", 6.7300),
    ("视频 2.5 720p 5s", 15.1200),
    ("视频 2.0 1080p 5s", 24.7900),
    ("视频 2.0 4K 5s", 50.5400),
]


def nice_mu_5(raw):
    """1 元 = 5 幕刻度下的挂牌：<1 取 0.05 / 1–20 取 0.5 / 20–100 取 1 / >100 取 2"""
    if raw < 1:
        step = Decimal("0.05")
    elif raw < 20:
        step = Decimal("0.5")
    elif raw < 100:
        step = Decimal("1")
    else:
        step = Decimal("2")
    q = (Decimal(str(raw)) / step).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return max(0.1, float((q * step).quantize(Decimal("0.05"))))


def section_rescale():
    print("【D】刻度改为 1 元 = 5 幕（1 幕 = ¥0.20）")
    print("-" * 100)
    print(f"K_nom = {K_NOM:.2f} 幕/USD  →  Q_幕 = floor(500000/{K_NOM:.2f}) = {Q_MU:,}")
    print(f"K = 500000/{Q_MU:,} = {K:.2f} 幕/USD ｜ c_幕 = ¥{C_MU:.4f} ｜ M0 = {pct(M0)}")
    print(f"1 元 = 5 幕 = {5 * Q_MU:,} quota")
    print("-" * 100)
    print(f"{'SKU':<22}{'幕':>9}{'实付¥':>10}{'毛利':>10}{'@10幕刻度':>11}")
    print("-" * 100)
    hit = None
    for label, cost in SKUS:
        mu = nice_mu_5(cost * K / FX)
        pay = mu * 0.20
        old = cost * 97.35 / FX
        m = 1 - cost / pay
        flag = ""
        if "2.5 480p" in label:
            hit = mu
            flag = "  ← 命中 45"
        print(f"{label:<22}{mu:>9.2f}{pay:>10.2f}{pct(m):>10}"
              f"{old:>11.1f}{flag}")
    print()
    print(f"→ Seedance 2.5 480p 5s = {hit} 幕，与对标站 45 积分数字一致。")
    print("  但 45 幕 = ¥9.00，45 积分 = ¥1.05~3.41 —— 数字相同，价格差 2.6~8.6 倍。")
    print()


# ============================================================ E. 我方 SKU 的积分等价
def section_equiv():
    print("【E】我方 v3（1 元 = 10 幕）SKU 在对标站积分体系里的等价积分")
    print("-" * 100)
    print(f"{'SKU':<22}{'幕':>7}{'¥':>8}{'@22分/¥':>10}{'@16分/¥':>10}{'@43分/¥':>10}")
    print("-" * 100)
    for label, mu_v3 in [
        ("标准图 1K", 1.0), ("标准图 1.5K", 2.0), ("标准图 2K", 3.5),
        ("高清图 1K", 2.0), ("高清图 1.5K", 4.0), ("高清图 2K", 7.0),
        ("旗舰图 1K", 4.0), ("旗舰图 1.5K", 8.0), ("旗舰图 2K", 14.0),
        ("文本 轻量扩写", 0.1), ("文本 标准文案", 0.8), ("文本 深度推理", 11.5),
        ("视频 mini 480p 5s", 31), ("视频 mini 720p 5s", 67),
        ("视频 2.0 720p 5s", 134), ("视频 2.5 480p 5s", 90),
        ("视频 2.0 1080p 5s", 332), ("视频 2.0 4K 5s", 674),
    ]:
        yuan = mu_v3 * 0.10
        print(f"{label:<22}{mu_v3:>7.1f}{yuan:>8.2f}"
              f"{yuan * 22:>10.0f}{yuan * 16:>10.0f}{yuan * 43:>10.0f}")
    print()
    print("→ 一张 1K 图仅值 2~4 积分：图片必然是获客钩子，利润在视频与订阅。")
    print()


# ============================================================ 自检
def section_check(rows, lo, hi, cost):
    print("【F】独立复核")
    print("-" * 100)
    ok = True

    def chk(name, got, exp, tol=0.06):
        nonlocal ok
        good = abs(got - exp) <= tol
        ok = ok and good
        print(f"{'OK ' if good else 'BAD'} {name:<34}{got:>12.4f}  期望 {exp:>10.4f}")

    chk("基础 首年实算", rows[0]["r_first"], 22.1)
    chk("基础 续费实算", rows[0]["r_renew"], 13.2)
    chk("标准 首年实算", rows[1]["r_first"], 24.1)
    chk("标准 续费实算", rows[1]["r_renew"], 16.6)
    chk("高级 首年实算", rows[2]["r_first"], 28.4)
    chk("高级 续费实算", rows[2]["r_renew"], 14.2)
    chk("超级 首年实算", rows[3]["r_first"], 33.3)
    chk("超级 续费实算", rows[3]["r_renew"], 15.0)
    chk("超级 含赠/首年", rows[3]["r_bonus"], 35.6)
    chk("45 积分 @43", TARGET_POINTS / 43, 1.05, 0.01)
    chk("45 积分 @22", TARGET_POINTS / 22, 2.05, 0.01)
    chk("45 积分 @续费超级", TARGET_POINTS / rows[3]["r_renew"], 3.00, 0.02)
    chk("成本 5s 480p", cost, 6.73, 0.01)
    chk("K(1元=5幕)", K, 48.67, 0.02)
    chk("M0(1元=5幕)", M0, 0.2501, 0.001)
    chk("2.5-480p 新刻度幕", nice_mu_5(6.73 * K / FX), 45, 0.01)
    print()
    print("全部通过 ✅" if ok else "存在不一致 ❌")


if __name__ == "__main__":
    rows = section_rate()
    lo, hi, cost = section_points(rows)
    section_compare(lo, hi, cost)
    section_rescale()
    section_equiv()
    section_check(rows, lo, hi, cost)
