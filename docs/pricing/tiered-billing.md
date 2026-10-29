# 分层计价（按上下文长度分档加价）

> 为什么需要：长上下文请求的真实成本远高于短请求（KV cache、显存、上游本身对长上下文档加价）。
> 如果长短一个价，你的长文本用户必然亏钱。对标站 zzai 就是靠 `rh_llm_prices` 把 >100k 的请求直接 ×5 来兜住这块成本。

好消息：**这套能力系统已经内置了**（`pkg/billingexpr`），不用改代码，只要给每个模型写一条表达式。

---

## 一、表达式速查

价格是**真实价格**（`p * 2.5` = $2.50 / 1M tokens），不需要 `/2` 那种倍率换算。

| 变量 | 含义 |
|---|---|
| `p` | 输入 token（自动扣除单独计价的子类别） |
| `c` | 输出 token |
| `len` | **输入上下文总长度，仅用于分档判断**（不受缓存扣除影响，分档必须用它） |
| `cr` | 缓存命中 token |
| `cc` / `cc1h` | 缓存写入（Claude 5分钟 / 1小时） |
| `img` / `img_o`、`ai` / `ao` | 图片、音频 |

| 函数 | 作用 |
|---|---|
| `tier(name, 费用)` | 记录命中哪一档，**必须包住费用表达式** |
| `fixed(x)` | 按次固定价（美元） |
| `hour(tz)` / `weekday(tz)` | 当前小时 / 星期 —— 用来做峰谷定价 |
| `param(path)` / `header(k)` | 读请求体 / 请求头 |
| `max(a,b)` | 取大 |

分档条件必须用 `len` 而不是 `p`：缓存命中会让 `p` 变小，用 `p` 分档会把长请求误判成短请求。

---

## 二、本项目采用的三档方案

| 档位 | 条件 | 加价 |
|---|---|---|
| normal | `len ≤ 100k` | 基准价 |
| long | `len > 100k` | 基准价 × 1.5 |
| xl | `len > 200k` | 基准价 × 2.2 |

（zzai 是 ×5，偏狠；1.5 / 2.2 更温和，既能覆盖成本又不劝退用户。）

示例（glm-5.3，进货 $1.3056/$4.0833，加价 2.5 倍）：

```
len > 200000 ? tier("xl", p * 7.1808 + c * 22.45815) : len > 100000 ? tier("long", p * 4.896 + c * 15.312375) : tier("normal", p * 3.264 + c * 10.20825)
```

---

## 三、22 个模型的现成表达式

`docs/pricing/tiered-expr.json` 里每个模型都带 `billing_mode` 和 `billing_expr`，加价倍率按对标结论分三档：

| 档位 | 加价 | 模型 |
|---|---|---|
| 引流款 | 1.6× | deepseek-v4.1-flash、qwen3.8-flash、qwen-plus、hunyuan-turbos、gemini-3.1-flash-lite、minimax-m3.1-flash、doubao-2.1-lite |
| 主力款 | 2.0~2.5× | glm-5.3、kimi-k3、doubao-2.1-pro、qwen3.7-max、gemini-3.1-pro、gemini-3.8-flash、gpt-6.1-sol、deepseek-v4-pro、claude-haiku-5.5、ernie-5、hunyuan-hy4、gpt-6-luna |
| 高端款 | 3.0~3.5× | claude-sonnet-5.5、gpt-5.5、claude-opus-5.5 |

**这些表达式已用系统自带编译器逐条验证通过**（22/22 编译成功）。

---

## 四、怎么导入

### 方式 A：脚本批量导入（推荐）

```bash
cd /opt/new-api-gallery/new-api-gallery
export NEWAPI_TOKEN='sk-你的管理员令牌'
python3 scripts/apply_tiered_billing.py --dry-run   # 先看要写什么
python3 scripts/apply_tiered_billing.py --apply     # 确认后写入
```

脚本会先 GET 拿 `expected_version` 做冲突检查，再 PATCH 批量写入，只动 `billing_mode` / `billing_expr`，**不影响旧倍率**（随时可切回旧模式）。

### 方式 B：后台 UI 逐个填

后台 → 模型定价（Models → Pricing）→ 选模型 → 计费模式选 `tiered_expr` → 表达式框粘贴。

---

## 五、两个进阶变体

### 1. 峰谷定价（对冲 DeepSeek 高峰价）

DeepSeek 官方高峰价是闲时 2 倍（工作日 9-12、14-18）。你可以把成本波动传导给用户，或反向用低价引流：

```expr
(weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 &&
  ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) ||
   (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18)))
  ? tier("peak", p * 0.4 + c * 1.6)
  : tier("offpeak", p * 0.2 + c * 0.8)
```

### 2. 缓存折扣（鼓励长对话 / 固定 system prompt）

DeepSeek 缓存命中价极低（约 $0.02/百万），把折扣传导给用户能明显提升复购：

```expr
p * 0.2083 + c * 0.8333 + cr * 0.02
```

注意：一旦表达式引用 `cr`，这部分 token 会从 `p` 里扣除，不会重复计费。

---

## 六、上线后怎么验

1. 发一条**短请求**（<1000 token）和一条**长请求**（>100k token，可用长文档），到「使用日志」里看两条的扣费是否分别命中 `normal` / `long` 档
2. 用后台的模型定价**预览**功能先算一遍再保存，避免写错
3. 一周后看 `/profit` 看板：长文本请求多的模型，毛利率应回到正常水平

> 提醒：模型名必须和「渠道」里填的一致，否则表达式不生效。
