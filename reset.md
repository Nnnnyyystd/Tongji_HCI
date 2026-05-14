# 1. 停掉正在跑的后端/前端后再执行

# 2. 清数据库：账号、饮食记录、AI评分、AI总结都会清空
Remove-Item -LiteralPath "backend\data\foodmate.db" -Force -ErrorAction SilentlyContinue

# 3. 清 Python 缓存和 pytest 缓存
Get-ChildItem -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Remove-Item -LiteralPath ".pytest_cache" -Recurse -Force -ErrorAction SilentlyContinue

# 4. 清前端构建和 Vite 缓存
Remove-Item -LiteralPath "frontend\dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "frontend\node_modules\.vite" -Recurse -Force -ErrorAction SilentlyContinue
