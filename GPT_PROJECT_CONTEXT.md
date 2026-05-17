# FoodMate 项目上下文说明

本文档用于给线上 GPT 或其他协作者快速理解 FoodMate 项目的整体架构、模块功能、接口设计和当前实现状态。

## 1. 项目背景

FoodMate 是一个面向大学生的轻量化智能饮食记录 Web Demo。项目目标不是开发完整商业 App，也不是医疗健康诊断系统，而是构建一个人机交互课程项目原型，展示用户如何用较低成本完成饮食记录，并通过 AI 辅助识别、用户确认、历史回顾和趋势分析了解自己的饮食习惯。

项目强调：

- 低负担输入：用户可以用自然语言或图片记录饮食。
- AI 辅助而非替代决策：AI 提供识别和建议，用户仍可确认和修改。
- 温和反馈：不制造热量焦虑，不做医疗诊断。
- 移动端原型体验：前端以手机端 Web Demo 形式呈现。
- 前后端分离：前端负责交互展示，后端负责数据、认证、统计和 AI 接口。

## 2. 技术栈

### 前端

```text
Vite 5
HTML
CSS
JavaScript
Chart.js
```

前端不使用 Vue/React 等大型框架，而是基于原生 JavaScript 实现 hash 路由、页面切换、登录状态管理和 API 调用。

### 后端

```text
Python 3.11
FastAPI
SQLite
SQLAlchemy
Pydantic
httpx
python-dotenv
python-multipart
```

后端使用 FastAPI 提供 REST API，SQLite 存储用户、饮食记录、偏好设置和 AI 总结数据。

### AI 服务

项目中预留了真实大模型接口能力：

```text
DEEPSEEK_API_KEY
QWEN_API_KEY
```

如果没有配置 key，项目仍可以使用基础功能和部分模拟逻辑。真实图片/文本分析能力依赖相应 API key。

## 3. 项目目录结构

```text
foodagent/
  backend/
    app/
      core/
        config.py          项目配置、数据库路径、上传目录、AI key
        security.py        密码哈希、token 生成
      db/
        base.py            SQLAlchemy Base
        session.py         数据库连接和会话
        init_db.py         数据库建表和迁移兼容逻辑
      models/
        user.py            用户模型
        auth_session.py    登录会话模型
        preference.py      用户偏好模型
        meal.py            饮食记录模型
        ai_summary.py      AI 总结模型
      schemas/
        response.py        统一 API 响应结构
        auth.py            登录注册数据结构
        preference.py      偏好设置数据结构
        meal.py            饮食记录、AI 识别、周统计数据结构
        stats.py           趋势统计和今日总结数据结构
      routers/
        health.py          健康检查
        auth.py            注册、登录、当前用户、退出登录
        preferences.py     用户偏好设置
        meals.py           饮食记录、图片上传、AI 分析、AI 总结
        stats.py           周趋势统计
        summary.py         今日总结
      services/
        auth.py            认证业务逻辑
        meal.py            饮食记录业务逻辑
        stats.py           统计分析业务逻辑
        summary_agent.py   今日总结生成逻辑
        deepseek.py        DeepSeek/Qwen API 调用与解析
      deps.py              当前用户、数据库依赖
      main.py              FastAPI 应用入口
    data/
      foodmate.db          SQLite 数据库，运行时生成，不提交
    uploads/
      meals/               上传图片目录，运行时生成
  frontend/
    src/
      main.js              前端入口、路由、认证流程、页面逻辑
      style.css            移动端 UI 样式
    package.json           前端依赖
  backend-requirements.txt 后端 pip 依赖
  environment.yml          conda 环境描述
  setup_foodmate_env.ps1   Windows PowerShell 一键环境脚本
  setup_foodmate_env.bat   Windows 批处理启动环境脚本
  READMEE.md               项目说明
  BCD_TASK_PLAN.md         B/C/D 成员后续任务规划
```

## 4. 运行方式

### 后端启动

```powershell
cd D:\PythonProject\foodagent
conda activate foodmate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

后端接口文档：

```text
http://127.0.0.1:8000/docs
```

健康检查：

```text
http://127.0.0.1:8000/api/health
```

### 前端启动

```powershell
cd D:\PythonProject\foodagent\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

前端访问：

```text
http://127.0.0.1:5173
```

## 5. 前端功能概览

前端是一个移动端风格 Web Demo，使用 hash 路由实现页面跳转。

### 登录与注册

首次打开项目会进入登录页。用户可以：

- 注册账号
- 登录账号
- 登录成功后进入首页
- token 保存到浏览器 `localStorage`
- 退出登录后清理 token 并回到登录页

本地存储字段：

```text
foodmate_token
foodmate_user
```

### 页面路由

```text
#/login       登录页
#/register    注册页
#/home        首页 / 今日饮食
#/record      记录一餐
#/calendar    饮食日历
#/trend       趋势分析
#/settings    偏好设置
```

未登录时访问项目内页会自动跳转回登录页。

### 首页

首页展示：

- 当前用户
- 后端连接状态
- 今日饮食记录
- 记录一餐入口
- 日历入口
- 一周趋势入口

### 记录一餐

用于录入饮食内容，支持：

- 文本输入
- 图片上传相关后端能力
- AI 识别结果展示
- 保存饮食记录

### 饮食日历

用于查看历史饮食记录：

- 月视图
- 某天是否有记录
- 指定日期记录列表

### 趋势分析

用于展示：

- 一周记录趋势
- 平均评分
- 常见食物统计
- 今日总结和温和建议

### 偏好设置

用于展示和修改：

- 饮食目标
- 口味偏好
- 提醒时间
- 忌口食物
- 退出登录

## 6. 后端模块说明

### 6.1 认证模块

文件：

```text
backend/app/routers/auth.py
backend/app/services/auth.py
backend/app/models/user.py
backend/app/models/auth_session.py
backend/app/core/security.py
```

功能：

- 用户注册
- 用户登录
- token 会话创建
- 当前用户查询
- 退出登录
- 密码 PBKDF2 哈希存储

接口：

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

用户名规则：

```text
允许中文、英文、数字、下划线
```

### 6.2 偏好设置模块

文件：

```text
backend/app/routers/preferences.py
backend/app/models/preference.py
backend/app/schemas/preference.py
```

功能：

- 获取当前用户偏好
- 修改当前用户偏好

接口：

```text
GET /api/preferences
PUT /api/preferences
```

字段：

```text
goal
taste
reminder_time
avoid_foods
```

### 6.3 饮食记录模块

文件：

```text
backend/app/routers/meals.py
backend/app/services/meal.py
backend/app/models/meal.py
backend/app/schemas/meal.py
```

功能：

- 创建饮食记录
- 按日期查询饮食记录
- 查询单条记录
- 编辑记录
- 删除记录
- 查询月度记录分布
- 查询本周记录统计
- 上传饮食图片
- 文本或图片 AI 分析
- AI 总结保存和读取

接口：

```text
GET    /api/meals
GET    /api/meals/month
GET    /api/meals/week-stats
POST   /api/meals/analyze
POST   /api/meals/photo
GET    /api/meals/ai-summary
POST   /api/meals/ai-summary
POST   /api/meals
GET    /api/meals/{meal_id}
PUT    /api/meals/{meal_id}
DELETE /api/meals/{meal_id}
```

主要字段：

```text
date
meal_type
content
score
score_variety
score_balance
score_cooking
score_comment
image_url
```

`meal_type` 可选：

```text
breakfast
lunch
dinner
snack
```

### 6.4 统计分析模块

文件：

```text
backend/app/routers/stats.py
backend/app/services/stats.py
backend/app/schemas/stats.py
```

功能：

- 统计一周饮食记录数量
- 统计每日平均评分
- 统计常见食物
- 统计记录天数和总餐数

接口：

```text
GET /api/stats/week
```

返回数据包含：

```text
days
dates
meal_counts
average_scores
top_foods
total_meals
recorded_days
```

### 6.5 今日总结模块

文件：

```text
backend/app/routers/summary.py
backend/app/services/summary_agent.py
backend/app/schemas/stats.py
```

功能：

- 根据当天饮食记录生成总结
- 给出温和建议
- 提取亮点
- 不做医疗诊断或严格营养评估

接口：

```text
GET /api/agent/today-summary
```

返回数据包含：

```text
date
meal_count
average_score
summary
suggestion
highlights
```

### 6.6 AI 分析模块

文件：

```text
backend/app/services/deepseek.py
```

功能：

- 调用 DeepSeek 文本分析
- 调用 Qwen 图片理解
- 对 AI 返回结果做 JSON 解析和归一化
- 在没有可靠返回时做格式兼容处理

相关配置：

```text
DEEPSEEK_API_KEY
QWEN_API_KEY
DEEPSEEK_BASE_URL
QWEN_BASE_URL
```

## 7. 数据库设计概览

数据库使用 SQLite，默认文件：

```text
backend/data/foodmate.db
```

主要表：

```text
users              用户
auth_sessions      登录会话 token
preferences        用户偏好设置
meals              饮食记录
ai_summaries       AI 饮食总结
```

所有业务数据都和 `user_id` 关联，接口通过当前登录用户进行数据隔离。

## 8. 认证与请求约定

登录或注册成功后，后端返回：

```json
{
  "success": true,
  "message": "login success",
  "data": {
    "access_token": "...",
    "token_type": "bearer",
    "user": {
      "id": 1,
      "username": "demo_user",
      "display_name": "Demo User"
    }
  }
}
```

需要登录的接口必须携带：

```text
Authorization: Bearer <access_token>
```

## 9. 统一响应格式

成功：

```json
{
  "success": true,
  "message": "success",
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "message": "error message",
  "data": null
}
```

FastAPI 参数校验错误会以 FastAPI 默认格式返回，前端会做部分中文提示转换。

## 10. 环境与依赖

后端依赖见：

```text
backend-requirements.txt
```

当前依赖：

```text
fastapi
uvicorn[standard]
pydantic
sqlalchemy
python-multipart
python-dotenv
pytest
httpx
ruff
```

前端依赖见：

```text
frontend/package.json
```

当前依赖：

```text
vite
chart.js
```

## 11. 当前项目完成度

已完成：

- 环境脚本
- 前后端基础框架
- 登录注册
- token 鉴权
- 偏好设置
- 饮食记录基础模型与接口
- 图片上传接口
- AI 分析服务封装
- 日历和趋势所需后端统计接口
- 今日总结接口
- 前端基础路由和页面展示

仍可继续完善：

- 前端对所有饮食记录接口的完整真实数据联动
- 图片上传后的前端预览体验
- AI 接口 key 配置说明
- 更完整的异常提示和空状态设计
- 测试覆盖率
- 报告中的交互流程截图和系统架构图

## 12. 项目定位提醒

FoodMate 是 HCI 课程项目 Demo，不建议把项目扩展为：

- 医疗诊断系统
- 严格营养分析系统
- 减肥监督系统
- 复杂用户权限系统
- 生产级商业 App

项目重点是展示一个完整、可运行、交互清晰的智能饮食记录原型。

## 13. PPT 模板风格说明

如果需要基于 `tupian/人机交互.pptx` 继续制作汇报 PPT，应优先沿用原模板风格，而不是重新设计一套视觉体系：

- 整体风格：同济大学课程汇报风格，白色背景，深蓝色标题与分隔线，页面保持简洁、正式。
- 主色：深蓝色，接近 `#005B91`；用于左上标题、顶部横线、小节标题条、边框和重点结构元素。
- 辅助色：红色用于强调关键功能或结论；浅蓝色用于功能卡片、结果解读框和图片占位框。
- 页面结构：左上角使用深蓝箭头图形和大标题，右上角放置同济大学标识，标题下方使用深蓝横线。
- 内容区：正文尽量放入蓝色边框框体中；小节标题使用深蓝底白字条；文字以黑色为主，重要词可用红色或蓝色强调。
- 图片处理：没有现成图片时不要自行下载或生成，应在对应位置写明“图片占位”及后续需要补充的具体图片内容。
- 字体建议：标题使用黑体或微软雅黑加粗，正文使用微软雅黑，避免过多装饰性字体。

## 14. 近期前端交互优化记录

以下优化已在 `frontend/src/main.js` 和 `frontend/src/style.css` 中实现，后续智能体继续工作时应保留这些交互约定：

- 首页“今日记录”列表中的每一餐可以直接点击进入 `mealDetail` 详情页；列表项也支持键盘 Enter/Space 进入详情。
- 日历页每条记录提供“详情”“AI 重评”“删除”操作；详情页同样提供“重新 AI 识别与评分”按钮。
- “AI 重评”会调用现有 `POST /api/meals/analyze`，再通过 `PUT /api/meals/{meal_id}` 更新评分字段，但不会覆盖用户已有的 `content` 食物描述。
- 记录页首次点击“AI 识别 & 评分”时，如果用户已经输入了食物描述，AI 只更新评分和评价；只有文本框为空时，才使用 AI 返回的 `identified` 自动填入描述。
- 日历页选中某日后，无论该日是否已有记录，详情列表底部都保留“补记这一天”入口；点击后跳转到 `#/record?date=YYYY-MM-DD`，记录表单自动带入该日期。
- 记录页会根据当前日期加载“当前日期已有记录”，并展示已有记录的详情、AI 重评和删除入口；切换日期时该列表会刷新。
- 记录页的餐次下拉框会根据当前日期已有记录禁用重复餐次，并把选项文本标注为“早餐（已记录）”等；保存前也会再次请求当天记录，阻止同一天重复保存同一餐次。
- 偏好设置页标题旁的“同步后端”文案已移除。
