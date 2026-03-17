#!/bin/bash
cd "$(dirname "$0")"
echo "启动 Docker 容器（PostgreSQL + Redis）…"
docker compose up -d
echo "等待数据库就绪…"
sleep 5
echo "启动 Next.js 开发服务器…"
npm run dev
