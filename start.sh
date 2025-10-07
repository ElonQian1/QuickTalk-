# 客服系统启动脚本

# 后端启动 (Rust)
echo "启动后端服务..."
cd backend
cargo run &
BACKEND_PID=$!
echo "后端服务已启动，PID: $BACKEND_PID"

# 等待后端服务启动
sleep 5

# 前端启动 (React)
echo "启动前端服务..."
cd ../frontend
npm install
npm start &
FRONTEND_PID=$!
echo "前端服务已启动，PID: $FRONTEND_PID"

echo "系统启动完成！"
echo "后端服务: http://localhost:8080"
echo "前端服务: http://localhost:3000"
echo ""
echo "停止服务请按 Ctrl+C"

# 等待用户中断
trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait