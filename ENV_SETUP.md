# FoodMate 环境搭建说明

本项目统一使用 `foodmate` 作为 conda 虚拟环境名称。

## 一键安装

在项目根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup_foodmate_env.ps1
```

脚本会自动完成：

- 创建 `foodmate` conda 环境，Python 版本为 `3.11`
- 安装后端依赖：FastAPI、Uvicorn、SQLAlchemy、pytest 等
- 检查本机 Node.js 和 npm
- 安装前端依赖
- 固定使用 `Vite 5`，避免新版 Vite 对 Node 版本要求过高
- 安装 `chart.js`

## 手动安装命令

如果脚本运行失败，可以按下面步骤手动执行。

```powershell
cd D:\PythonProject\foodagent

conda clean -i -y
conda create -n foodmate python=3.11 -y
conda activate foodmate

python -m pip install --upgrade pip
pip install -r backend-requirements.txt
```

检查 Node.js：

```powershell
node -v
npm -v
```

如果已经存在 `frontend` 文件夹：

```powershell
cd frontend
npm install
npm install chart.js
cd ..
```

如果还没有 `frontend` 文件夹：

```powershell
npm create vite@5 frontend -- --template vanilla
cd frontend
npm install
npm install vite@^5.4.0 --save-dev
npm install chart.js
cd ..
```

## 运行项目

后端启动命令，等后端入口文件完成后使用：

```powershell
conda activate foodmate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

前端启动命令：

```powershell
cd frontend
npm run dev
```

## 注意事项

- 不建议使用 `conda-forge` 安装 Node.js，本项目直接使用系统 Node.js。
- SQLite 是 Python 标准库自带能力，不需要单独安装数据库软件。
- 如果 PowerShell 报 `profile.ps1` 签名问题，请使用上面的 `-NoProfile` 命令，或直接运行 `setup_foodmate_env.bat`。
