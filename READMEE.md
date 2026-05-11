# FoodMate

FoodMate 是面向大学生的轻量化智能饮食记录 Web Demo。项目采用前后端分离结构：

- 前端：Vite 5 + HTML/CSS/JavaScript + Chart.js
- 后端：Python 3.11 + FastAPI + SQLite

## 快速开始

安装环境：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup_foodmate_env.ps1
```

启动后端：

```powershell
conda activate foodmate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

启动前端：

```powershell
cd frontend
npm run dev
```

访问前端：

```text
http://127.0.0.1:5173
```

前端现在已经接入后端认证流程。首次打开会进入登录页，也可以切换到注册页；注册或登录成功后会自动进入首页。

后端健康检查：

```text
http://127.0.0.1:8000/api/health
```

## 后端基础接口

当前后端已经包含用户认证、登录会话和用户偏好设置。登录后使用返回的 `access_token`，在请求头中携带：

```text
Authorization: Bearer <access_token>
```

认证接口：

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

偏好设置接口：

```text
GET /api/preferences
PUT /api/preferences
```

注册请求示例：

```json
{
  "username": "demo_user",
  "password": "12345678",
  "display_name": "Demo User"
}
```

登录请求示例：

```json
{
  "username": "demo_user",
  "password": "12345678"
}
```

数据库文件位置：

```text
backend/data/foodmate.db
```

该文件由 FastAPI 启动时自动创建，已经加入 `.gitignore`，不需要提交。

前端会把登录 token 保存在浏览器 `localStorage` 中：

```text
foodmate_token
foodmate_user
```

退出登录会调用 `/api/auth/logout` 并清理本地 token。

## 当前基础结构

```text
backend/
  app/
    core/        配置
    db/          SQLite 初始化与会话
    models/      SQLAlchemy 数据模型
    routers/     API 路由
    schemas/     通用响应模型
    services/    业务逻辑
    main.py      FastAPI 入口
frontend/
  src/
    main.js      前端入口
    style.css    公共样式与移动端界面壳
```

## API 响应格式

后端统一返回：

```json
{
  "success": true,
  "message": "success",
  "data": {}
}
```
