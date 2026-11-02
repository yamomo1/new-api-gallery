# docs-ymm · 一幕AI（YMM）自有文档

本目录存放**一幕AI 二开项目**的自有文档与脚本，与仓库根目录 `docs/`（upstream new-api 的英文官方文档）区分开，互不冲突，也不影响后续同步上游。

## 计费（「幕」体系）

- `一幕-幕计费与扣费方案.md` —— 主方案（1 元 = 10 幕；单品毛利 25%，综合 20%，会员 15%）
- `幕价目表.md` —— 各模型幕价速查
- `幕-v2-落库配置.md` —— 落到 New API 后台 option 的具体配置与校验步骤
- `视频模型真实成本与幕价对照.md`、`对标站积分换算与定价对照.md` —— 定价依据与来源
- `landing/*.json` —— 落库用的 option 片段（ModelRatio / CompletionRatio / ModelPrice / amount_options / amount_discount / GroupRatio-vip）
- 脚本：`mu_billing_calc.py`、`seedance25_official_pricing.py`、`liblib_points_convert.py`、`gen_landing.py`

> 铁律：文档里的数字**全部由脚本生成**，改参数必须重跑脚本再重生成文档，禁止手改 Markdown 中的数字。

## 产品与设计

- `cdymm-战略定位与发展规划.md`、`cdymm-发展路线-三阶段.md`
- `liblib深度拆解与YMM设计方向.md`、`设计系统接入方案.md`、`UI交付包.md`
- `模型选择弹窗数据源.md` —— `GET /api/model-catalog` 的三级分类规则与已知坑

## 运营与后台

- `SEO与GEO落地指南.md`
- `统一定价页说明.md` —— `/system-settings/pricing/<section>` 的用法与两条保存铁律
