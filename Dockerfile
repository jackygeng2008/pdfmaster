FROM python:3.11-slim

# Koyeb 免费层优化: 512MB RAM, 1 vCPU
# 系统依赖精简版 - 移除 WeasyPrint 相关大依赖以节省内存
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    tesseract-ocr-eng \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    libglib2.0-0 \
    libgl1 \
    libffi-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制并安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache/pip

# 复制项目文件
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 创建运行时目录
RUN mkdir -p uploads output

# 环境变量
ENV HOST=0.0.0.0
ENV PORT=8000

# 暴露端口
EXPOSE 8000

# Koyeb 免费层优化: 1 worker + 2 threads（在512MB内存下稳定运行）
CMD ["sh", "-c", "gunicorn --bind ${HOST}:${PORT} --workers 1 --threads 2 --timeout 120 --max-requests 100 --max-requests-jitter 20 backend.app:app"]
