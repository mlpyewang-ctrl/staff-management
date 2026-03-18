#!/bin/bash

# 劳务派遣员工管理系统 - 启动脚本

set -e

echo "========================================"
echo "  劳务派遣员工管理系统 - 启动脚本"
echo "========================================"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Docker 是否运行
check_docker() {
    echo -e "${YELLOW}检查 Docker 状态...${NC}"
    if docker info > /dev/null 2>&1; then
        echo -e "${GREEN}Docker 正在运行${NC}"
    else
        echo -e "${YELLOW}Docker 未运行，尝试启动 Colima...${NC}"
        if command -v colima &> /dev/null; then
            colima start
        else
            echo -e "${RED}请先启动 Docker 或 Colima${NC}"
            exit 1
        fi
    fi
}

# 启动数据库
start_db() {
    echo -e "${YELLOW}启动 PostgreSQL 数据库...${NC}"
    docker-compose up -d
    echo -e "${GREEN}数据库已启动${NC}"
    
    # 等待数据库就绪
    echo -e "${YELLOW}等待数据库就绪...${NC}"
    sleep 3
}

# 安装依赖
install_deps() {
    echo -e "${YELLOW}检查并安装依赖...${NC}"
    npm install
    echo -e "${GREEN}依赖安装完成${NC}"
}

# 同步数据库
sync_db() {
    echo -e "${YELLOW}同步数据库结构...${NC}"
    npm run db:push
    echo -e "${GREEN}数据库结构已同步${NC}"
}

# 初始化数据
seed_data() {
    echo -e "${YELLOW}初始化测试数据...${NC}"
    npm run db:seed
    echo -e "${GREEN}测试数据初始化完成${NC}"
}

# 启动开发服务器
start_dev() {
    echo -e "${GREEN}启动开发服务器...${NC}"
    echo "========================================"
    echo -e "${GREEN}服务地址: http://localhost:3000${NC}"
    echo -e "${GREEN}测试账号: admin@zltech.com${NC}"
    echo -e "${GREEN}密码: password123${NC}"
    echo "========================================"
    npm run dev
}

# 主流程
main() {
    case "${1:-all}" in
        "db")
            check_docker
            start_db
            ;;
        "install")
            install_deps
            ;;
        "sync")
            sync_db
            ;;
        "seed")
            seed_data
            ;;
        "dev")
            start_dev
            ;;
        "all"|*)
            check_docker
            start_db
            install_deps
            sync_db
            seed_data
            start_dev
            ;;
    esac
}

# 显示帮助
show_help() {
    echo "用法: ./start.sh [命令]"
    echo ""
    echo "命令:"
    echo "  all     - 完整启动流程 (默认)"
    echo "  db      - 仅启动数据库"
    echo "  install - 仅安装依赖"
    echo "  sync    - 仅同步数据库结构"
    echo "  seed    - 仅初始化测试数据"
    echo "  dev     - 仅启动开发服务器"
    echo "  help    - 显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./start.sh        # 完整启动"
    echo "  ./start.sh db     # 仅启动数据库"
    echo "  ./start.sh dev    # 仅启动开发服务器"
}

if [ "$1" = "help" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

main "$@"
