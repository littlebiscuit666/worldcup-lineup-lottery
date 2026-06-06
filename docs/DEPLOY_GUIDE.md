# 部署静态网站到 GitHub Pages 并绑定自定义子域名

本文以本项目的实际部署过程为例，完整记录如何将一个纯前端静态项目部署到 GitHub Pages，并绑定自己的域名作为子域名访问。

---

## 前置条件

- 一个 GitHub 账号
- 本地安装了 [Git](https://git-scm.com/) 和 [GitHub CLI (`gh`)](https://cli.github.com/)
- 一个你自己的域名（本文以阿里云 DNS 管理的 `fanyihong.work` 为例）
- 一个纯前端项目（HTML / CSS / JS，无需后端）

---

## 第一步：初始化本地 Git 仓库

如果你的项目还没有用 Git 管理，先初始化：

```bash
cd /your/project/directory
git init
```

创建 `.gitignore` 文件，排除不需要提交的内容：

```gitignore
.DS_Store
Thumbs.db
node_modules/
dist/
*.log
```

## 第二步：提交代码到本地仓库

```bash
# 添加所有文件
git add -A

# 查看暂存的文件，确认没有遗漏或多余文件
git status

# 提交
git commit -m "Initial commit"
```

## 第三步：在 GitHub 创建远程仓库并推送

使用 `gh` CLI 一行命令完成创建和关联：

```bash
# --public 表示公开仓库（GitHub Pages 免费版需要公开）
# --source=. 表示关联当前目录
# --description 是仓库描述
gh repo create your-repo-name --public --source=. --description "你的项目描述"
```

执行后会输出仓库地址，例如：
```
https://github.com/your-username/your-repo-name
```

此时代码已经自动推送到 GitHub。如果没有自动推送，手动执行：

```bash
git push -u origin master
```

> **注意**：如果后续远程有新提交（比如 GitHub 自动添加了文件），本地推送前需要先拉取：
> ```bash
> git pull --rebase
> git push
> ```

## 第四步：启用 GitHub Pages

通过 GitHub API 启用 Pages 服务，指定从 `master` 分支的根目录部署：

```bash
gh api repos/your-username/your-repo-name/pages \
  -X POST \
  -f build_type=legacy \
  -f source.branch=master \
  -f source.path=/
```

> **`build_type` 说明**：
> - `legacy`：直接从分支读取文件部署，适合纯静态项目，不需要 GitHub Actions
> - `workflow`：需要配合 GitHub Actions 部署流程，适合需要构建步骤的项目（如 React、Vue 等）

启用后，默认访问地址为：
```
https://your-username.github.io/your-repo-name/
```

## 第五步：在域名服务商添加 DNS 解析记录

以阿里云为例：

1. 登录 [阿里云 DNS 控制台](https://dns.console.aliyun.com/)
2. 点击你的域名（如 `fanyihong.work`）
3. 点击 **「添加记录」**
4. 填写以下信息：

| 字段 | 值 | 说明 |
|------|------|------|
| **主机记录** | `worldcup` | 你想要的子域名前缀，最终为 `worldcup.fanyihong.work` |
| **记录类型** | `CNAME` | 将子域名指向另一个域名 |
| **线路类型** | 默认 | |
| **记录值** | `your-username.github.io` | 你的 GitHub Pages 默认域名 |
| **TTL** | 600（10分钟） | |

> **为什么用 CNAME 而不是 A 记录？**
>
> GitHub Pages 的服务器 IP 可能会变动，使用 CNAME 指向 `username.github.io` 可以自动跟随 GitHub 的 IP 变化，无需手动更新。

## 第六步：在 GitHub Pages 绑定自定义域名

### 方法一：命令行（推荐）

```bash
# 设置自定义域名
gh api repos/your-username/your-repo-name/pages \
  -X PUT \
  --input - <<< '{"cname":"worldcup.fanyihong.work"}'
```

同时在项目根目录创建 `CNAME` 文件（确保配置持久化，否则每次部署可能被重置）：

```bash
echo "worldcup.fanyihong.work" > CNAME
```

提交并推送：

```bash
git add CNAME
git commit -m "Add custom domain"
git push
```

### 方法二：GitHub 网页操作

1. 打开仓库的 **Settings → Pages**
2. 在 **Custom domain** 输入框中填写 `worldcup.fanyihong.work`
3. 点击 **Save**
4. 等待 DNS 检查通过（显示 ✓ DNS check successful）

## 第七步：启用 HTTPS（SSL 证书）

GitHub Pages 会自动为自定义域名申请免费的 Let's Encrypt SSL 证书，但需要等待一段时间。

### 先检查证书状态

```bash
gh api repos/your-username/your-repo-name/pages \
  --jq '{https_enforced, certificate_state: .https_certificate.state}'
```

当 `certificate_state` 变为 `"approved"` 时，说明证书已就绪。

### 开启 HTTPS 强制跳转

```bash
gh api repos/your-username/your-repo-name/pages \
  -X PUT \
  --input - <<< '{"https_enforced":true}'
```

### 或者在网页端操作

1. 打开 **Settings → Pages**
2. 勾选 ✅ **Enforce HTTPS**

> **如果 Enforce HTTPS 灰色不可勾选？**
>
> 这是正常的，可能原因：
> - DNS 还未完全生效，需要等待（通常几分钟到几小时）
> - SSL 证书还在申请中
> - 可以通过上面的命令行方式强制开启（只要证书已 approved）

---

## 最终验证

检查完整部署状态：

```bash
gh api repos/your-username/your-repo-name/pages --jq '{
  site_url: .html_url,
  status: .status,
  https_enforced: .https_enforced,
  certificate: .https_certificate.state,
  certificate_expires: .https_certificate.expires_at
}'
```

期望输出：

```json
{
  "site_url": "https://worldcup.fanyihong.work/",
  "status": "built",
  "https_enforced": true,
  "certificate": "approved",
  "certificate_expires": "2026-09-04"
}
```

---

## 常用命令速查

```bash
# 查看 Pages 部署状态
gh api repos/your-username/your-repo-name/pages --jq '.status'

# 更新自定义域名
gh api repos/your-username/your-repo-name/pages -X PUT --input - <<< '{"cname":"new-sub.yourdomain.com"}'

# 查看 HTTPS 证书信息
gh api repos/your-username/your-repo-name/pages --jq '.https_certificate'

# 强制 HTTPS
gh api repos/your-username/your-repo-name/pages -X PUT --input - <<< '{"https_enforced":true}'
```

---

## 关于国内访问速度

GitHub Pages 的服务器在海外，国内访问可能较慢或不稳定。**换域名无法解决这个问题**，因为瓶颈在于服务器物理位置。

如果需要国内快速访问，可以考虑：
- **Cloudflare CDN**：免费，套一层 CDN 加速
- **Vercel**：免费，国内有节点，部署也很简单
- **国内云服务商**（阿里云 OSS、腾讯云 COS）：需要备案，但体验最好

---

## 参考链接

- [GitHub Pages 官方文档](https://docs.github.com/pages)
- [GitHub Pages REST API](https://docs.github.com/rest/pages)
- [自定义域名配置指南](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [GitHub Pages HTTPS 故障排查](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages#https-errors)
