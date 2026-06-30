#!/bin/bash
# PDFMaster 直接部署脚本 (无需Docker)
# 适用于 Ubuntu/Debian 云服务器
# 用法: bash deploy-direct.sh

set -e

echo "=========================================="
echo "  PDFMaster 直接部署脚本 (无需Docker)"
echo "=========================================="

# 1. 安装系统依赖
echo "[步骤1] 安装系统依赖..."
apt-get update
apt-get install -y python3 python3-pip python3-venv \
    tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng \
    libjpeg-dev zlib1g-dev libgl1 libglib2.0-0 \
    libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf2.0-0 \
    nginx

# 2. 创建应用目录
APP_DIR="/opt/pdfmaster"
echo "[步骤2] 部署到 $APP_DIR ..."
mkdir -p $APP_DIR

# 脚本所在目录即项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp -r "$SCRIPT_DIR"/../backend $APP_DIR/
cp -r "$SCRIPT_DIR"/../frontend $APP_DIR/
cp "$SCRIPT_DIR"/../requirements.txt $APP_DIR/
mkdir -p $APP_DIR/uploads $APP_DIR/output

# 3. 创建虚拟环境并安装依赖
echo "[步骤3] 创建Python虚拟环境..."
python3 -m venv $APP_DIR/venv
$APP_DIR/venv/bin/pip install --upgrade pip
$APP_DIR/venv/bin/pip install -r $APP_DIR/requirements.txt gunicorn

# 4. 创建 systemd 服务
echo "[步骤4] 创建系统服务..."
cat > /etc/systemd/system/pdfmaster.service << 'EOF'
[Unit]
Description=PDFMaster PDF Processing Service
After=network.target

[Service]
Type=exec
User=root
WorkingDirectory=/opt/pdfmaster
Environment=HOST=127.0.0.1
Environment=PORT=5700
ExecStart=/opt/pdfmaster/venv/bin/gunicorn --bind 127.0.0.1:5700 --workers 4 --threads 4 --timeout 120 backend.app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pdfmaster
systemctl start pdfmaster

# 5. 配置 Nginx 反向代理
echo "[步骤5] 配置 Nginx..."
cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/pdfmaster
ln -sf /etc/nginx/sites-available/pdfmaster /etc/nginx/sites-enabled/pdfmaster
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# 6. 防火墙放行
echo "[步骤6] 配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 5700/tcp 2>/dev/null || true
fi

echo ""
echo "=========================================="
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-server-ip")
echo "  ✅ 部署成功！"
echo "  访问地址: http://$PUBLIC_IP"
echo "=========================================="
echo ""
echo "常用命令:"
echo "  查看状态:   systemctl status pdfmaster"
echo "  查看日志:   journalctl -u pdfmaster -f"
echo "  重启服务:   systemctl restart pdfmaster"
echo "  重启Nginx:  systemctl restart nginx"
echo "=========================================="
