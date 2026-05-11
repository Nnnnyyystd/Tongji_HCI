# FoodMate B/C/D 成员后续任务规划

本文档用于在 A 成员完成基础框架后，指导 B、C、D 三位成员继续开发各自模块。当前项目已经具备：

- 前端 Vite 基础界面、移动端 Demo 外观、hash 路由
- 前端登录、注册、退出登录、token 本地保存
- 后端 FastAPI 基础服务、CORS、统一响应格式
- SQLite 数据库初始化
- 用户注册、登录、当前用户、退出登录接口
- 用户偏好设置读取与更新接口
- README、环境脚本、依赖文件

## 统一开发约定

### 启动方式

后端：

```powershell
cd D:\PythonProject\foodagent
conda activate foodmate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

前端：

```powershell
cd D:\PythonProject\foodagent\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

### 前端认证约定

登录成功后，前端会在 `localStorage` 中保存：

```text
foodmate_token
foodmate_user
```

调用需要登录的接口时，请携带：

```text
Authorization: Bearer <foodmate_token>
```

### 后端响应格式

所有接口统一返回：

```json
{
  "success": true,
  "message": "success",
  "data": {}
}
```

失败时：

```json
{
  "success": false,
  "message": "error message",
  "data": null
}
```

### 后端新增模块方式

后端推荐按以下结构补充：

```text
backend/app/models/      SQLAlchemy 数据模型
backend/app/schemas/     Pydantic 请求/响应模型
backend/app/services/    业务逻辑
backend/app/routers/     FastAPI 路由
```

新增路由后，需要在 `backend/app/main.py` 中注册：

```python
app.include_router(xxx.router, prefix=API_PREFIX)
```

需要当前用户时，直接使用：

```python
from backend.app.deps import CurrentUser, DbSession
```

## 成员 B：饮食记录与 AI 识别模块

### 目标

完成“记录一餐”的核心闭环：用户输入饮食内容，系统模拟 AI 识别，用户确认后保存为饮食记录。

### 前端任务

负责页面：

```text
#/record
```

需要完成：

- 输入饮食文本
- 点击“开始识别”后调用后端 AI 解析接口
- 展示识别结果
- 支持用户修改食物名称、数量、分类
- 点击“保存并返回首页”后调用保存饮食记录接口
- 保存成功后跳转 `#/home`
- 首页今日记录区域改为读取真实接口数据

### 后端任务

建议新增文件：

```text
backend/app/models/meal.py
backend/app/models/food.py
backend/app/schemas/meal.py
backend/app/schemas/agent.py
backend/app/services/food_parser.py
backend/app/services/meals.py
backend/app/routers/agent.py
backend/app/routers/meals.py
```

需要实现接口：

```text
POST /api/agent/parse
POST /api/meals
GET  /api/meals/today
GET  /api/meals?date=YYYY-MM-DD
PUT  /api/meals/{id}
DELETE /api/meals/{id}
```

### 数据表建议

`meals`：

```text
id
user_id
meal_type
meal_date
raw_input
note
created_at
updated_at
```

`foods`：

```text
id
meal_id
food_name
amount
category
created_at
```

### 验收标准

- 用户登录后可以输入一段自然语言饮食内容
- 系统能返回模拟识别结果
- 用户确认后能保存记录
- 首页能看到今日真实记录
- 接口必须按当前登录用户隔离数据

## 成员 C：饮食日历与历史记录模块

### 目标

完成按日期查看历史饮食记录、查看某日详情、编辑和删除历史记录。

### 前端任务

负责页面：

```text
#/calendar
```

需要完成：

- 日历上标出有饮食记录的日期
- 点击某一天后加载当天记录
- 展示当天所有餐次
- 支持进入详情或直接编辑记录
- 支持删除记录
- 删除后页面刷新并更新日历标记

### 后端任务

可以复用 B 的 `meals` 接口。如果 B 尚未完成，可先基于 mock 数据开发页面，但最终要接入真实接口。

建议补充接口：

```text
GET /api/meals/dates?month=YYYY-MM
GET /api/meals?date=YYYY-MM-DD
GET /api/meals/{id}
PUT /api/meals/{id}
DELETE /api/meals/{id}
```

### 验收标准

- 用户可以在日历中看到哪些日期有记录
- 用户可以查看指定日期的饮食记录
- 用户可以编辑某条历史记录
- 用户可以删除某条历史记录
- 删除和编辑必须只影响当前登录用户的数据

## 成员 D：饮食总结与趋势分析模块

### 目标

完成今日饮食总结、每周趋势图、常见食物统计和温和建议生成。

### 前端任务

负责页面：

```text
#/trend
```

需要完成：

- 从后端读取本周统计数据
- 使用 Chart.js 展示一周记录趋势
- 展示常见食物或食物分类统计
- 展示今日总结与温和建议
- 首页的一周趋势卡片改为读取真实数据

### 后端任务

建议新增文件：

```text
backend/app/schemas/stats.py
backend/app/services/stats.py
backend/app/services/summary_agent.py
backend/app/routers/stats.py
backend/app/routers/summary.py
```

需要实现接口：

```text
GET /api/agent/today-summary
GET /api/stats/week
```

### 返回数据建议

`GET /api/stats/week`：

```json
{
  "success": true,
  "message": "week stats",
  "data": {
    "days": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    "meal_counts": [2, 3, 2, 4, 3, 2, 3],
    "top_foods": [
      {"name": "米饭", "count": 5},
      {"name": "青菜", "count": 4}
    ]
  }
}
```

`GET /api/agent/today-summary`：

```json
{
  "success": true,
  "message": "today summary",
  "data": {
    "summary": "今天记录比较完整，午餐包含主食和蔬菜。",
    "suggestion": "晚餐可以继续用一句话快速补记，保持记录连续性。"
  }
}
```

### 验收标准

- 趋势页数据来自后端真实接口
- 图表能随后端数据变化
- 今日总结能基于当天记录生成
- 建议语气温和，不制造饮食焦虑

## 集成顺序建议

1. B 先完成 `meals`、`foods` 数据表和基础饮食记录接口。
2. C 基于 B 的记录接口完成日历和历史记录。
3. D 基于 B 的记录数据完成统计和总结接口。
4. 三人完成后，统一检查首页是否能显示真实今日记录、真实趋势、真实总结。

## 最终联调清单

- [ ] 新用户可以注册并进入首页
- [ ] 登录后 token 能访问所有需要登录的接口
- [ ] 记录一餐可以完成“输入 -> 识别 -> 确认 -> 保存”
- [ ] 首页今日记录来自数据库
- [ ] 日历可以按日期查看历史记录
- [ ] 历史记录可以编辑和删除
- [ ] 趋势图来自后端统计接口
- [ ] 今日总结和建议来自后端接口
- [ ] 退出登录后不能继续访问项目内页
- [ ] 所有接口都按当前登录用户隔离数据

## 不建议扩展的内容

本项目是 HCI 课程 Web Demo，不建议继续扩展以下内容：

- 真实医疗或营养诊断
- 严格热量计算
- 复杂权限系统
- 多用户后台管理
- 真实生产级部署
- 过重前端框架迁移

