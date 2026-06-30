#!/bin/bash
# PDFMaster 一键部署脚本 (在云服务器上执行)
# 使用前请确保已安装 Docker 和 Docker Compose

set -e

echo "=========================================="
echo "  PDFMaster 部署脚本"
echo "=========================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "[错误] 未安装 Docker，正在安装..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo "[完成] Docker 安装完成"
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "[错误] 未安装 Docker Compose，正在安装..."
    apt-get update && apt-get install -y docker-compose-plugin
    echo "[完成] Docker Compose 安装完成"
fi

# 构建并启动
echo "[步骤1] 构建 Docker 镜像..."
docker compose build

echo "[步骤2] 启动服务..."
docker compose up -d

echo "[步骤3] 等待服务启动..."
sleep 3

# 检查状态
if docker compose ps | grep -q "running"; then
    echo ""
    echo "=========================================="
    echo "  ✅ 部署成功！"
    echo "  访问地址: http://$(curl -s ifconfig.me):8000"
    echo "=========================================="
    echo ""
    echo "常用命令:"
    echo "  查看日志:   docker compose logs -f"
    echo "  重启服务:   docker compose restart"
    echo "  停止服务:   docker compose down"
    echo "=========================================="
else
    echo "[错误] 服务启动失败，请查看日志:"
    docker compose logs
    exit 1
fi
