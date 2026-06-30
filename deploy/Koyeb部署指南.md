# PDFMaster Koyeb 免费部署指南

Koyeb 提供免费层 Kubernetes 托管，支持从 GitHub 自动部署 Docker 容器。

## 免费层规格

| 项目 | 配置 |
|------|------|
| 内存 | 512 MB RAM |
| CPU | 1 vCPU |
| 域名 | `pdfmaster-xxx.koyeb.app`（免费） |
| HTTPS | 自动启用 |
| 限制 | 高可用无保证 / 闲置自动休眠 |

## 步骤一：推送代码到 GitHub

### 1.1 创建 GitHub 仓库

打开 https://github.com/new ，创建名为 `pdfmaster` 的仓库（Public 或 Private 均可）。

### 1.2 推送代码

```bash
cd "D:\桌面\迅读\PDFMaster"
git remote add origin https://github.com/你的用户名/pdfmaster.git
git branch -M main
git push -u origin main
```

## 步骤二：Koyeb 部署

### 2.1 注册并登录

打开 https://app.koyeb.com ，用 GitHub 账号登录。

### 2.2 创建应用

1. 点击 **Create App**
2. 选择 **GitHub** → 选择 `pdfmaster` 仓库
3. Koyeb 自动检测到 Dockerfile，选择 **Docker** 部署方式
4. 配置：
   - **Instance type**: Free (micro) 0.1 vCPU / 512 MB
   - **Port**: `8000`
   - **Health check path**: `/`
5. 点击 **Deploy**

等待 3-5 分钟，构建和部署完成。

### 2.3 访问

部署成功后会显示 URL：`https://你的应用名-xxx.koyeb.app`

## 步骤三（可选）：防止休眠

Koyeb 免费层会在无流量时休眠。可以用 cron-job.org 每 10 分钟 ping 一次：
1. 去 https://cron-job.org 注册
2. 创建定时任务，每 10 分钟 GET 你的 Koyeb URL
3. 免费、无需代码

---

## 常见问题

**Q: 部署失败？**
- 检查日志：Koyeb App → Deployment → Logs
- 常见原因：Docker 构建超时 → 重试即可
- 内存溢出（OOM）→ PDF 文件太大时会触发，减小文件或升级配置

**Q: 上传文件需要什么？**
- 直接正常工作，文件存于容器的临时存储

**Q: OCR 中文能用吗？**
- 可以，Dockerfile 已包含 tesseract-ocr-chi-sim 语言包
