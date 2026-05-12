import Chart from 'chart.js/auto'
import './style.css'

const API_BASE = 'http://127.0.0.1:8000'
const TOKEN_KEY = 'foodmate_token'
const USER_KEY = 'foodmate_user'

const authState = {
  token: localStorage.getItem(TOKEN_KEY),
  user: readStoredUser(),
}

const routes = {
  login: {
    title: '登录',
    public: true,
    render: renderLogin,
  },
  register: {
    title: '注册',
    public: true,
    render: renderRegister,
  },
  home: {
    title: '今日饮食',
    render: renderHome,
  },
  record: {
    title: '记录一餐',
    render: renderRecord,
  },
  calendar: {
    title: '饮食日历',
    render: renderCalendar,
  },
  trend: {
    title: '趋势分析',
    render: renderTrend,
  },
  settings: {
    title: '偏好设置',
    render: renderSettings,
  },
}

const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '零食' }

function mealTypeLabel(type) {
  return MEAL_LABELS[type] || type
}

function renderMealItem(m) {
  const hasDetail = m.score !== null && (m.score_comment || m.score_variety !== null)

  const scoreRow =
    m.score !== null
      ? `<div class="meal-score-row">
           <span class="meal-score-badge">${m.score}分</span>
           ${hasDetail ? `<button class="meal-detail-toggle" data-meal-id="${m.id}" type="button">详情</button>` : ''}
         </div>`
      : ''

  const detailPanel = hasDetail
    ? `<div class="meal-detail-expand hidden" id="meal-detail-${m.id}">
         ${m.score_comment ? `<p class="detail-comment">"${m.score_comment}"</p>` : ''}
         <div class="detail-scores">
           ${m.score_variety != null ? `<span>食材多样 <strong>${m.score_variety}</strong>/35</span>` : ''}
           ${m.score_balance != null ? `<span>营养均衡 <strong>${m.score_balance}</strong>/35</span>` : ''}
           ${m.score_cooking != null ? `<span>烹饪健康 <strong>${m.score_cooking}</strong>/30</span>` : ''}
         </div>
       </div>`
    : ''

  return `<article class="meal-item">
    <span>${mealTypeLabel(m.meal_type)}</span>
    <div><strong>${m.content}</strong>${scoreRow}</div>
  </article>${detailPanel}`
}

function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let activeChart = null

document.querySelector('#app').innerHTML = `
  <main class="phone-shell" aria-label="FoodMate demo">
    <section class="topbar">
      <div>
        <p class="eyebrow">FoodMate</p>
        <h1 id="page-title">今日饮食</h1>
      </div>
      <button class="icon-button" id="settings-button" type="button" aria-label="设置" data-route="settings">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path>
          <path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A8 8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a8 8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z"></path>
        </svg>
      </button>
    </section>

    <section id="page-content" class="page-content"></section>

    <nav class="bottom-nav" id="bottom-nav" aria-label="主导航">
      <button class="nav-item" type="button" data-route="home">首页</button>
      <button class="nav-item" type="button" data-route="record">记录</button>
      <button class="nav-item" type="button" data-route="calendar">日历</button>
      <button class="nav-item" type="button" data-route="trend">趋势</button>
    </nav>
  </main>
`

document.addEventListener('click', (event) => {
  const routeButton = event.target.closest('[data-route]')
  const logoutButton = event.target.closest('[data-action="logout"]')
  const calDay = event.target.closest('.calendar-day[data-day]')

  if (logoutButton) {
    handleLogout()
    return
  }

  if (calDay) {
    const day = parseInt(calDay.dataset.day)
    const now = new Date()
    document.querySelectorAll('.calendar-day').forEach((b) => b.classList.remove('selected-day'))
    calDay.classList.add('selected-day')
    loadDayDetail(now.getFullYear(), now.getMonth() + 1, day)
    return
  }

  const detailToggle = event.target.closest('.meal-detail-toggle')
  if (detailToggle) {
    const panel = document.querySelector(`#meal-detail-${detailToggle.dataset.mealId}`)
    if (panel) {
      panel.classList.toggle('hidden')
      detailToggle.textContent = panel.classList.contains('hidden') ? '详情' : '收起'
    }
    return
  }

  if (event.target.closest('#photo-upload')) {
    document.querySelector('#photo-input')?.click()
    return
  }

  if (event.target.closest('#analyze-btn')) {
    handleAnalyze()
    return
  }

  if (event.target.closest('#ai-analyze-btn')) {
    handleAiSummary()
    return
  }

  if (!routeButton) {
    return
  }

  navigateTo(routeButton.dataset.route)
})

document.addEventListener('submit', (event) => {
  if (event.target.matches('#login-form')) {
    event.preventDefault()
    handleLogin(event.target)
  }

  if (event.target.matches('#register-form')) {
    event.preventDefault()
    handleRegister(event.target)
  }

  if (event.target.matches('#preferences-form')) {
    event.preventDefault()
    handlePreferencesSave(event.target)
  }

  if (event.target.matches('#meal-form')) {
    event.preventDefault()
    handleMealSave(event.target)
  }
})

window.addEventListener('hashchange', renderCurrentRoute)

document.addEventListener('change', (event) => {
  if (event.target.matches('#photo-input')) {
    handlePhotoSelect(event.target)
  }
})

if (!window.location.hash) {
  navigateTo(authState.token ? 'home' : 'login', { replace: true })
} else {
  renderCurrentRoute()
}

if (authState.token) {
  loadCurrentUser()
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

function setAuth(token, user) {
  authState.token = token
  authState.user = user
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearAuth() {
  authState.token = null
  authState.user = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function navigateTo(routeName, options = {}) {
  const nextRoute = routes[routeName] ? routeName : 'home'
  const nextHash = `#/${nextRoute}`

  if (options.replace) {
    window.history.replaceState(null, '', nextHash)
    renderCurrentRoute()
    return
  }

  if (window.location.hash === nextHash) {
    renderCurrentRoute()
    return
  }

  window.location.hash = nextHash
}

function getCurrentRoute() {
  const routeName = window.location.hash.replace('#/', '')
  return routes[routeName] ? routeName : 'home'
}

function renderCurrentRoute() {
  let routeName = getCurrentRoute()
  let route = routes[routeName]

  if (!route.public && !authState.token) {
    navigateTo('login', { replace: true })
    return
  }

  if (route.public && authState.token) {
    navigateTo('home', { replace: true })
    return
  }

  const content = document.querySelector('#page-content')

  if (activeChart) {
    activeChart.destroy()
    activeChart = null
  }

  routeName = getCurrentRoute()
  route = routes[routeName]

  document.querySelector('#page-title').textContent = route.title
  document.querySelector('.phone-shell').classList.toggle('auth-mode', Boolean(route.public))
  document.querySelector('#settings-button').classList.toggle('hidden', Boolean(route.public))
  document.querySelector('#bottom-nav').classList.toggle('hidden', Boolean(route.public))

  content.innerHTML = route.render()
  updateNavigation(routeName)

  if (routeName === 'home') {
    loadWeekChart('home-week-chart')
    loadTodayMeals()
  }

  if (routeName === 'calendar') {
    const now = new Date()
    loadCalendarData(now.getFullYear(), now.getMonth() + 1, now.getDate())
  }

  if (routeName === 'trend') {
    loadWeekChart('trend-week-chart')
    loadSavedAiSummary()
  }

  if (routeName === 'settings') {
    loadPreferences()
  }
}

function updateNavigation(routeName) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.route === routeName)
  })
}

async function apiRequest(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.auth ? { Authorization: `Bearer ${authState.token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || result?.success === false) {
    if (response.status === 401 && options.auth) {
      clearAuth()
      navigateTo('login', { replace: true })
    }

    throw new Error(formatApiError(result) || '请求失败')
  }

  return result
}

function formatApiError(result) {
  if (!result) {
    return ''
  }

  if (typeof result.detail === 'string') {
    return result.detail
  }

  if (Array.isArray(result.detail)) {
    return result.detail
      .map((item) => translateValidationMessage(item.msg || item.message))
      .join('；')
  }

  return result.message || ''
}

function translateValidationMessage(message = '') {
  if (message.includes('String should match pattern')) {
    return '用户名只能包含中文、英文、数字或下划线'
  }

  if (message.includes('String should have at least')) {
    return '输入内容长度不够'
  }

  return message || '参数不正确'
}

async function loadCurrentUser() {
  try {
    const result = await apiRequest('/api/auth/me', { auth: true })
    authState.user = result.data
    localStorage.setItem(USER_KEY, JSON.stringify(result.data))
  } catch {
    clearAuth()
    navigateTo('login', { replace: true })
  }
}

async function handleLogin(form) {
  const message = form.querySelector('.form-message')
  setMessage(message, '正在登录...', 'info')

  try {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: form.username.value.trim(),
        password: form.password.value,
      },
    })

    setAuth(result.data.access_token, result.data.user)
    navigateTo('home', { replace: true })
  } catch (error) {
    setMessage(message, error.message || '登录失败', 'error')
  }
}

async function handleRegister(form) {
  const message = form.querySelector('.form-message')
  const username = form.username.value.trim()
  const password = form.password.value
  const displayName = form.display_name.value.trim()

  if (password !== form.confirm_password.value) {
    setMessage(message, '两次输入的密码不一致', 'error')
    return
  }

  setMessage(message, '正在注册...', 'info')

  try {
    const result = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username,
        password,
        display_name: displayName || username,
      },
    })

    setAuth(result.data.access_token, result.data.user)
    navigateTo('home', { replace: true })
  } catch (error) {
    setMessage(message, error.message || '注册失败', 'error')
  }
}

async function handleLogout() {
  if (authState.token) {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', auth: true })
    } catch {
      // The local token should still be cleared even if the server is unreachable.
    }
  }

  clearAuth()
  navigateTo('login', { replace: true })
}

async function loadPreferences() {
  const form = document.querySelector('#preferences-form')

  if (!form) {
    return
  }

  try {
    const result = await apiRequest('/api/preferences', { auth: true })
    form.goal.value = result.data.goal
    form.taste.value = result.data.taste
    form.reminder_time.value = result.data.reminder_time
    form.avoid_foods.value = result.data.avoid_foods
  } catch (error) {
    setMessage(form.querySelector('.form-message'), error.message, 'error')
  }
}

async function handlePreferencesSave(form) {
  const message = form.querySelector('.form-message')
  setMessage(message, '正在保存...', 'info')

  try {
    await apiRequest('/api/preferences', {
      method: 'PUT',
      auth: true,
      body: {
        goal: form.goal.value,
        taste: form.taste.value,
        reminder_time: form.reminder_time.value,
        avoid_foods: form.avoid_foods.value,
      },
    })
    setMessage(message, '设置已保存', 'success')
  } catch (error) {
    setMessage(message, error.message || '保存失败', 'error')
  }
}

function setMessage(element, text, type) {
  element.textContent = text
  element.className = `form-message ${type}`
}

function renderLogin() {
  return `
    <section class="auth-card">
      <p class="auth-kicker">欢迎回来</p>
      <h2>登录 FoodMate</h2>
      <form id="login-form" class="auth-form">
        <label>
          <span>用户名</span>
          <input name="username" type="text" autocomplete="username" required />
        </label>
        <label>
          <span>密码</span>
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <p class="form-message" aria-live="polite"></p>
        <button class="primary-action full-width" type="submit">登录</button>
      </form>
      <button class="text-link" type="button" data-route="register">还没有账号？去注册</button>
    </section>
  `
}

function renderRegister() {
  return `
    <section class="auth-card">
      <p class="auth-kicker">开始记录</p>
      <h2>创建 FoodMate 账号</h2>
      <form id="register-form" class="auth-form">
        <label>
          <span>用户名</span>
          <input
            name="username"
            type="text"
            autocomplete="username"
            minlength="2"
            pattern="[a-zA-Z0-9_\\u4e00-\\u9fff]+"
            placeholder="中文、英文、数字或下划线"
            required
          />
        </label>
        <label>
          <span>昵称</span>
          <input name="display_name" type="text" autocomplete="nickname" />
        </label>
        <label>
          <span>密码</span>
          <input name="password" type="password" autocomplete="new-password" minlength="6" required />
        </label>
        <label>
          <span>确认密码</span>
          <input name="confirm_password" type="password" autocomplete="new-password" minlength="6" required />
        </label>
        <p class="form-message" aria-live="polite"></p>
        <button class="primary-action full-width" type="submit">注册并进入</button>
      </form>
      <button class="text-link" type="button" data-route="login">已有账号？去登录</button>
    </section>
  `
}

function renderHome() {
  const displayName = authState.user?.display_name || authState.user?.username || '同学'

  return `
    <section class="status-card">
      <div>
        <p class="label">当前用户</p>
        <strong>${displayName}</strong>
      </div>
      <span class="status-dot ok"></span>
    </section>

    <section class="quick-actions" aria-label="快捷操作">
      <button class="primary-action" type="button" data-route="record">记录一餐</button>
      <button class="secondary-action" type="button" data-route="calendar">查看日历</button>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>今日记录</h2>
        <span id="today-count">加载中</span>
      </div>
      <div class="meal-list" id="today-meals">
        <article class="meal-item muted">
          <span>—</span>
          <strong>正在加载</strong>
        </article>
      </div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>一周趋势</h2>
        <button class="text-action" type="button" data-route="trend">查看</button>
      </div>
      <div class="chart-wrap">
        <canvas id="home-week-chart" aria-label="一周饮食记录趋势"></canvas>
      </div>
    </section>
  `
}

function renderRecord() {
  return `
    <section class="card">
      <div class="section-heading">
        <h2>记录一餐</h2>
      </div>
      <form id="meal-form">
        <label class="form-row">
          <span>日期</span>
          <input name="date" type="date" value="${todayDateStr()}" required />
        </label>
        <label class="form-row">
          <span>餐次</span>
          <select name="meal_type">
            <option value="breakfast">早餐</option>
            <option value="lunch" selected>午餐</option>
            <option value="dinner">晚餐</option>
            <option value="snack">零食</option>
          </select>
        </label>

        <div class="photo-upload" id="photo-upload" role="button" tabindex="0" aria-label="上传照片">
          <span class="photo-upload-icon">📷</span>
          <span id="photo-placeholder">点击上传照片（可选）</span>
          <img id="photo-preview" class="hidden" alt="食物照片" />
          <input type="file" id="photo-input" accept="image/*" class="hidden" />
        </div>

        <textarea class="meal-input" id="meal-content" name="content"
          rows="3" placeholder="补充描述（可选，有图片时可不填）"></textarea>

        <button type="button" id="analyze-btn" class="secondary-action full-width">
          AI 识别 &amp; 评分
        </button>

        <div class="score-card hidden" id="score-card">
          <span class="score-number" id="score-number">—</span>
          <div class="score-detail">
            <span>食材多样 <strong id="score-variety">—</strong>/35</span>
            <span>营养均衡 <strong id="score-balance">—</strong>/35</span>
            <span>烹饪健康 <strong id="score-cooking">—</strong>/30</span>
          </div>
          <p class="score-comment" id="score-comment"></p>
        </div>
        <input type="hidden" name="score" id="score-value" />
        <input type="hidden" name="score_variety" id="score-variety-value" />
        <input type="hidden" name="score_balance" id="score-balance-value" />
        <input type="hidden" name="score_cooking" id="score-cooking-value" />
        <input type="hidden" name="score_comment" id="score-comment-value" />

        <p class="form-message" aria-live="polite"></p>
        <button class="primary-action full-width" type="submit">保存记录</button>
      </form>
    </section>
  `
}

function renderCalendar() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = now.getDate()
  const daysInMonth = new Date(year, month, 0).getDate()

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .map((day) => {
      const isToday = day === today ? 'today' : ''
      return `<button class="calendar-day ${isToday}" type="button" data-day="${day}">${day}</button>`
    })
    .join('')

  return `
    <section class="card">
      <div class="section-heading">
        <h2>${year} 年 ${month} 月</h2>
        <span>历史记录</span>
      </div>
      <div class="calendar-grid" id="calendar-grid">${days}</div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2 id="detail-date">${month} 月 ${today} 日</h2>
        <span id="detail-count">加载中</span>
      </div>
      <div class="meal-list" id="detail-meals">
        <article class="meal-item muted">
          <span>—</span>
          <strong>正在加载</strong>
        </article>
      </div>
    </section>
  `
}

function renderTrend() {
  return `
    <section class="card">
      <div class="section-heading">
        <h2>本周日均评分</h2>
        <span>7 天</span>
      </div>
      <div class="chart-wrap large">
        <canvas id="trend-week-chart" aria-label="本周日均评分趋势"></canvas>
      </div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>AI 饮食分析</h2>
        <span id="ai-summary-meta" class="score-comment"></span>
      </div>
      <p id="ai-summary" class="summary-text">点击下方按钮，AI 将根据本周记录生成饮食总结。</p>
      <button class="secondary-action full-width" id="ai-analyze-btn" type="button">生成本周分析</button>
    </section>
  `
}

function renderSettings() {
  const userName = authState.user?.display_name || authState.user?.username || '当前用户'

  return `
    <section class="status-card">
      <div>
        <p class="label">已登录</p>
        <strong>${userName}</strong>
      </div>
      <button class="text-action" type="button" data-action="logout">退出</button>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>饮食偏好</h2>
        <span>同步后端</span>
      </div>
      <form id="preferences-form">
        <label class="form-row">
          <span>目标</span>
          <select name="goal">
            <option>了解饮食习惯</option>
            <option>保持规律记录</option>
            <option>增加蔬菜摄入</option>
          </select>
        </label>
        <label class="form-row">
          <span>口味</span>
          <input name="taste" type="text" placeholder="例如：清淡、少辣" />
        </label>
        <label class="form-row">
          <span>提醒时间</span>
          <input name="reminder_time" type="time" value="19:30" />
        </label>
        <label class="form-row">
          <span>忌口</span>
          <input name="avoid_foods" type="text" placeholder="例如：无、花生" />
        </label>
        <p class="form-message" aria-live="polite"></p>
        <button class="primary-action full-width" type="submit">保存设置</button>
      </form>
    </section>
  `
}

async function checkBackend() {
  const statusText = document.querySelector('#api-status')
  const statusDot = document.querySelector('#status-dot')

  if (!statusText || !statusDot) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/api/health`)
    const result = await response.json()

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'request failed')
    }

    statusText.textContent = '已连接'
    statusDot.className = 'status-dot ok'
  } catch {
    statusText.textContent = '未启动'
    statusDot.className = 'status-dot error'
  }
}

async function loadTodayMeals() {
  const date = todayDateStr()
  const countEl = document.querySelector('#today-count')
  const mealsEl = document.querySelector('#today-meals')

  if (!countEl) return

  try {
    const result = await apiRequest(`/api/meals?date=${date}`, { auth: true })
    const meals = result.data

    countEl.textContent = `${meals.length} 餐`

    if (meals.length === 0) {
      mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>今日暂无记录</strong></article>`
    } else {
      mealsEl.innerHTML = meals.map(renderMealItem).join('')
    }
  } catch {
    if (countEl) countEl.textContent = '—'
    if (mealsEl) mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>加载失败</strong></article>`
  }
}

async function loadCalendarData(year, month, selectedDay) {
  try {
    const result = await apiRequest(`/api/meals/month?year=${year}&month=${month}`, { auth: true })
    const recorded = new Set(result.data.days)

    document.querySelectorAll('.calendar-day[data-day]').forEach((btn) => {
      const day = parseInt(btn.dataset.day)
      if (recorded.has(day)) btn.classList.add('has-record')
    })
  } catch {
    // calendar still works without record markers
  }

  await loadDayDetail(year, month, selectedDay)
}

async function loadDayDetail(year, month, day) {
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const dateEl = document.querySelector('#detail-date')
  const countEl = document.querySelector('#detail-count')
  const mealsEl = document.querySelector('#detail-meals')

  if (!dateEl) return

  dateEl.textContent = `${month} 月 ${day} 日`

  try {
    const result = await apiRequest(`/api/meals?date=${date}`, { auth: true })
    const meals = result.data

    countEl.textContent = `${meals.length} 条记录`

    if (meals.length === 0) {
      mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>当日无记录</strong></article>`
    } else {
      mealsEl.innerHTML = meals.map(renderMealItem).join('')
    }
  } catch {
    if (countEl) countEl.textContent = '—'
    if (mealsEl) mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>加载失败</strong></article>`
  }
}

async function handleMealSave(form) {
  const message = form.querySelector('.form-message')
  const content = form.content.value.trim()

  if (!content) {
    setMessage(message, '请填写食物描述或先进行 AI 识别', 'error')
    return
  }

  setMessage(message, '正在保存...', 'info')

  const scoreRaw = form.score?.value
  const body = {
    date: form.date.value,
    meal_type: form.meal_type.value,
    content,
    ...(scoreRaw
      ? {
          score: parseInt(scoreRaw),
          score_variety: form.score_variety?.value ? parseInt(form.score_variety.value) : undefined,
          score_balance: form.score_balance?.value ? parseInt(form.score_balance.value) : undefined,
          score_cooking: form.score_cooking?.value ? parseInt(form.score_cooking.value) : undefined,
          score_comment: form.score_comment?.value || undefined,
        }
      : {}),
  }

  try {
    await apiRequest('/api/meals', { method: 'POST', auth: true, body })
    setMessage(message, '保存成功', 'success')
    setTimeout(() => navigateTo('home', { replace: true }), 800)
  } catch (error) {
    setMessage(message, error.message || '保存失败', 'error')
  }
}

async function loadWeekChart(canvasId) {
  if (activeChart) {
    activeChart.destroy()
    activeChart = null
  }

  const ctx = document.querySelector(`#${canvasId}`)
  if (!ctx) return

  const emptyData = Array(7).fill(null)
  const emptyLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

  let labels = emptyLabels
  let data = emptyData

  try {
    const result = await apiRequest('/api/meals/week-stats', { auth: true })
    labels = result.data.map((s) => s.day_label)
    data = result.data.map((s) => s.avg_score)
  } catch {
    // fall through with empty data
  }

  activeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '日均评分',
          data,
          borderColor: '#5BAA75',
          backgroundColor: 'rgba(91, 170, 117, 0.14)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20 },
        },
      },
    },
  })
}

function handlePhotoSelect(input) {
  const file = input.files?.[0]
  if (!file) return

  const preview = document.querySelector('#photo-preview')
  const placeholder = document.querySelector('#photo-placeholder')
  const uploadIcon = document.querySelector('.photo-upload-icon')

  const url = URL.createObjectURL(file)
  preview.src = url
  preview.classList.remove('hidden')
  if (placeholder) placeholder.classList.add('hidden')
  if (uploadIcon) uploadIcon.classList.add('hidden')
}

async function handleAnalyze() {
  const btn = document.querySelector('#analyze-btn')
  const message = document.querySelector('.form-message')
  const photoInput = document.querySelector('#photo-input')
  const contentInput = document.querySelector('#meal-content')
  const text = contentInput?.value.trim()
  const file = photoInput?.files?.[0]

  if (!file && !text) {
    setMessage(message, '请上传照片或填写食物描述', 'error')
    return
  }

  btn.disabled = true
  btn.textContent = '识别中...'
  setMessage(message, '', 'info')

  try {
    const fd = new FormData()
    if (file) fd.append('image', file)
    if (text) fd.append('text', text)

    const response = await fetch(`${API_BASE}/api/meals/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authState.token}` },
      body: fd,
    })
    const result = await response.json()

    if (!response.ok || result.success === false) {
      throw new Error(result.detail || result.message || '识别失败')
    }

    const r = result.data
    document.querySelector('#score-number').textContent = r.score
    document.querySelector('#score-variety').textContent = r.variety
    document.querySelector('#score-balance').textContent = r.balance
    document.querySelector('#score-cooking').textContent = r.cooking
    document.querySelector('#score-comment').textContent = r.comment
    document.querySelector('#score-value').value = r.score
    document.querySelector('#score-variety-value').value = r.variety
    document.querySelector('#score-balance-value').value = r.balance
    document.querySelector('#score-cooking-value').value = r.cooking
    document.querySelector('#score-comment-value').value = r.comment
    document.querySelector('#score-card').classList.remove('hidden')

    if (contentInput && !contentInput.value.trim()) {
      contentInput.value = r.identified
    }
  } catch (error) {
    setMessage(message, error.message || '识别失败', 'error')
  } finally {
    btn.disabled = false
    btn.textContent = 'AI 识别 & 评分'
  }
}

function updateSummaryMeta(isoDate) {
  const metaEl = document.querySelector('#ai-summary-meta')
  if (!metaEl) return
  const d = new Date(isoDate)
  metaEl.textContent = `${d.getMonth() + 1}月${d.getDate()}日生成`
}

async function loadSavedAiSummary() {
  try {
    const result = await apiRequest('/api/meals/ai-summary', { auth: true })
    if (result.data?.summary) {
      const el = document.querySelector('#ai-summary')
      const btn = document.querySelector('#ai-analyze-btn')
      if (el) el.textContent = result.data.summary
      if (btn) btn.textContent = '重新生成分析'
      updateSummaryMeta(result.data.created_at)
    }
  } catch {
    // no saved summary yet, keep default text
  }
}

async function handleAiSummary() {
  const btn = document.querySelector('#ai-analyze-btn')
  const summaryEl = document.querySelector('#ai-summary')

  btn.disabled = true
  btn.textContent = '分析中...'
  summaryEl.textContent = '正在调用 AI 分析本周饮食，请稍候...'

  try {
    const result = await apiRequest('/api/meals/ai-summary', { method: 'POST', auth: true })
    summaryEl.textContent = result.data.summary
    updateSummaryMeta(result.data.created_at)
  } catch (error) {
    summaryEl.textContent = '分析失败：' + (error.message || '请稍后再试')
  } finally {
    btn.disabled = false
    btn.textContent = '重新生成分析'
  }
}
