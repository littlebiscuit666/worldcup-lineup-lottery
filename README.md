# 世界杯首发抽签器

一个基于 `D:\Codex_workspace\世界杯` 数据的小型纯前端项目。用户可以从 2026 世界杯 48 队球员池中按阵型抽取 11 人首发，并计算阵容能力、总身价和欧皇指数。

## 运行

直接打开 `index.html` 即可运行。数据已打包为 `data/players.js`，不依赖接口服务。

刷新数据时运行：

```powershell
python .\tools\build_data.py
```

## 项目文件

- `index.html`：页面结构。
- `styles.css`：响应式界面和球场布局。
- `app.js`：抽签、评分、分享链接和 UI 渲染逻辑。
- `data/players.js`：由原始 CSV 生成的前端数据。
- `tools/build_data.py`：数据转换脚本。
- `docs/DEVELOPMENT.md`：开发文档。
