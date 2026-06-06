# 开发文档

## 目标

这个项目用于验证一个世界杯首发抽签玩法：

- 用户选择阵型。
- 系统按位置从世界杯参赛球员池中抽取 11 人。
- 页面计算阵容平均能力、总身价和欧皇指数。
- 分享链接可复现同一套阵容，方便玩家互相对比。

## 数据来源

主数据来自：

```text
D:\Codex_workspace\世界杯\worldcup_players_fc26_public_ratings.csv
```

这张表合并了两类信息：

- Transfermarkt：国家队、球员、位置、年龄、俱乐部、国家队出场、进球、欧元身价。
- FC26 公开评分：总评、六大能力项、位置、评分详情来源。

当前数据规模：

- 48 支参赛队。
- 1246 名球员。
- 862 名球员有 FC26 真实评分。
- 384 名球员缺少 FC26 评分，项目使用估算评分兜底。

## 数据生成

前端不直接读取 CSV，而是使用脚本生成紧凑的 JS 数据文件：

```powershell
cd D:\Codex_workspace\worldcup-lineup-lottery
python .\tools\build_data.py
```

输出：

```text
data/players.js
```

页面通过：

```html
<script src="./data/players.js"></script>
```

获得 `window.WORLD_CUP_DATA`。

## 前端字段

每名球员保留以下核心字段：

- `id`：Transfermarkt player_id，用于分享链接复现。
- `team` / `teamId`：国家队。
- `name`：球员名。
- `positionGroup`：`Goalkeeper`、`Defender`、`Midfield`、`Attack`。
- `position`：细分位置。
- `club`、`age`、`caps`、`goals`。
- `marketValueEur` / `marketValueText`：身价。
- `fc26Overall`：真实 FC26 总评，缺失时为 `null`。
- `overall`：最终用于计算的能力值。
- `overallSource`：`fc26` 或 `estimated`。
- `pace`、`shooting`、`passing`、`dribbling`、`defending`、`physicality`。

## 评分规则

阵容能力：

```text
average_overall = 11 人 overall 平均值
```

如果球员有真实 FC26 评分：

```text
overall = fc26Overall
overallSource = "fc26"
```

如果球员没有 FC26 评分，按身价估算：

```text
overall = clamp(round(28.85 + 6.88 * log10(market_value_eur)), 55, 84)
overallSource = "estimated"
```

这个公式来自当前数据中 862 名有真实评分球员的粗略拟合。上限设为 84，是为了避免缺评分球员因为高身价被估得过强。

## 抽签规则

当前支持阵型：

- `4-3-3`
- `4-4-2`
- `3-5-2`
- `5-3-2`

每个阵型被拆成位置槽位，例如 `4-3-3`：

```text
LW ST RW
LCM CM RCM
LB LCB RCB RB
GK
```

抽签流程：

1. 根据球队范围和“只抽真实评分”开关过滤奖池。
2. 按 `positionGroup` 分成门将、后卫、中场、前锋。
3. 每个槽位从对应位置组中等概率抽 1 人。
4. 同一套阵容内不重复抽取同一球员。
5. 如果当前奖池无法满足阵型位置数量，页面提示错误。

## 欧皇指数

欧皇指数用于让玩家对比运气，范围近似为 `1-99`。

计算方式：

1. 在当前奖池和阵型下模拟 900 次随机抽签。
2. 得到模拟阵容的能力分布和身价分布。
3. 当前阵容分别计算能力分位和身价分位。
4. 合成：

```text
luck_score = round(ability_percentile * 0.55 + value_percentile * 0.45)
```

能力权重略高于身价，避免阵容只靠一个超高身价球员拉分。

## 分享链接

分享状态写在 URL hash 中：

```text
#lineup=<base64url-json>
```

JSON 内容：

```json
{
  "formation": "4-3-3",
  "team": "all",
  "realOnly": false,
  "seed": "ABC123",
  "ids": ["743515", "..."]
}
```

页面打开时会优先按 `ids` 复原阵容，因此原抽签结果不会因为奖池过滤控件变化而丢失。

## 后续可扩展

- 增加排行榜后端，提交分享结果并按欧皇指数排序。
- 增加每日固定挑战，所有用户使用同一个奖池和日期 seed。
- 增加更多阵型和替补席。
- 增加球员稀有度、卡面样式和抽卡动画。
- 将总身价显示切换为人民币，复用原项目中的 CNY Excel 生成逻辑。
