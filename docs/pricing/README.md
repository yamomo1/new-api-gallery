# 计费、定价与风控（本项目实操手册）

> 数据快照：2026-10-29。模型迭代快，导入前请以官方定价页复核。
> 适用于本仓库这套 New API 二开（价格配置入口：后台 → 系统设置 → 账单）。

---

## 一、先搞懂单位，否则一定会算错

系统内部一律用 **quota（额度）** 计费：`QuotaPerUnit = 500000`，即 **1 USD = 500000 quota**。

由此推出两套口径的换算：

| 你要表达的 | 换算公式 | 例子 |
|---|---|---|
| 官方牌价（USD / 1M tokens）→ ModelRatio | `ratio = USD ÷ 2` | gpt-4o $2.5/1M → `1.25` |
| 每一次调用的扣费 | `quota = 输入tokens × ModelRatio + 输出tokens × ModelRatio × CompletionRatio` | — |
| CompletionRatio（输出倍率） | `输出单价 ÷ 输入单价` | in $2 / out $10 → `5.0` |
| 人民币牌价（元/百万）→ USD/1M | `÷ 汇率（按 7.2 计）` | ¥0.8 → $0.1111 |

**配置项位置**：`ModelRatio`、`CacheRatio`、`CreateCacheRatio`、`CompletionRatio`、`ImageRatio`、`AudioRatio`、`AudioCompletionRatio`、`ExposeRatioEnabled`、`TopupGroupRatio`、`GroupRatio` 全部在后台「系统设置 → 账单」，前端由 `web/src/features/system-settings/billing/index.tsx` 维护。

### 两个必须知道的坑

1. **未配置价格的模型按 37.5 兜底扣费**（≈ $75/1M）。
   代码依据：`setting/ratio_setting/model_ratio.go` 的 `GetModelRatio()` 未命中时返回 `37.5`。
   也就是说——**渠道里上线了没定价的新模型，用户会被按天价扣费**，这是最容易引发投诉的地方。上新模型第一件事就是定价格。

2. **价格表是全量替换，不是增量合并**。
   代码依据：`types/rw_map.go` 的 `LoadFromJsonStringWithCallback()` 先 `m.data = make(...)` 清空再加载。
   所以后台粘贴 JSON 时，**把只含几个模型的表粘进去会把内置默认值全冲掉**。正确做法：先导出当前表 → 在本地把新模型条目合并进去 → 再整份粘回。

---

## 二、推荐的三层定价模型（成本与售价彻底分离）

别在 ModelRatio 里加价。按下面分工，算毛利时不会乱：

| 层 | 配置项 | 填什么 |
|---|---|---|
| 进货成本 | `UpstreamCostRatio`（新增，见下） | 上游真实报价，`{"模型":{"in":x,"out":y}}`，单位 USD/1M |
| 对外售价基准 | `ModelRatio` + `CompletionRatio` | **与进货价 1:1**（ratio = 成本 ÷ 2） |
| 毛利 | `GroupRatio`（分组倍率） | default `1.6`、vip `1.25`、内部 `1.0` |
| 自动升组 | `TopupGroupRatio` | 充值达标自动进低倍率分组（诱导充值） |

这样**售价随便调，成本核算纹丝不动**；反之亦然。

### 建议的分档模型策略

| 用户档 | 可用模型 | GroupRatio | 目的 |
|---|---|---|---|
| 免费 / 新用户 | 只给经济层（qwen-flash / 混元 TurboS / 豆包 lite / Gemini Flash-Lite） | 1.8~2.0 | 引流，成本极低 |
| 付费普档 | 经济层 + 中端（GPT 中端、Sonnet、Gemini Pro、GLM、Kimi） | 1.5~1.6 | 主力毛利来源 |
| VIP | 全量含 Opus / Sol 级 | 1.2~1.3 | 留住重度用户 |
| 内部测试 | 全量 | 1.0 | 成本价跑通 |

> 控制「免费档能用什么模型」要在**渠道的分组**里限死，不是靠倍率——倍率低也挡不住羊毛党刷量与突发 Money burn。

---

## 三、三份数据文件怎么用

| 文件 | 粘到哪 | 安全吗 |
|---|---|---|
| `upstream-cost.json` | 后台 → Profit（毛利看板）→ 上游进货价表 | 安全，只影响成本核算 |
| `model-ratio.json` | 系统设置 → 账单 → ModelRatio | 需先导出合并（全量替换） |
| `completion-ratio.json` | 系统设置 → 账单 → CompletionRatio | 同上 |

**第一次上手的推荐顺序**：先只导入 `upstream-cost.json` 打开毛利看板 → 跑一周看「按名录下来的毛利」是否靠谱 → 再决定是否动 ModelRatio。

`upstream-cost.json` 里的价格是：模型 → `{"in": 输入单价, "out": 输出单价}`，单位 USD / 1M tokens，**直接抄厂商价格页的数字**即可，不用做 `/2` 换算。

国内厂商人民币牌价折算：$ = ¥ ÷ 7.2；DeepSeek 有峰谷计价（高峰约为闲时 2 倍），表中 `deepseek-v4.1-flash` 取的是**两者均值**，保守起见可按高峰值上调。

---

## 四、每月对账 SOP

1. 打开 `/profit`，选 30D，看总毛利率
2. 拉厂商后台账单，和「收入 − 成本」对照，差额超过 5% 就去查：
   - 是否有模型**没配成本价**（看板里标 `no cost` 的行）
   - 是否有渠道失败重试导致重复计费
   - 缓存命中是否被计入（你现在省下来的缓存折扣会体现在毛利里，属正常）
3. 毛利低于 20% 的模型：降渠道权重、限制到付费组、或者直接下架
4. 新上线的模型：**上线当天就补价格**，别让它落到 37.5 兜底

---

## 五、毛利多少算健康

| 指标 | 参考值 |
|---|---|
| 整体毛利率 | ≥ 35%（低于 20% 说明选品或倍率有问题） |
| 免费档人均月成本 | 控制在客单价的 10% 以内 |
| 单模型负毛利 | 不允许存在超过一个账单周期 |

详细风控配置见 [risk-control.md](./risk-control.md)。
