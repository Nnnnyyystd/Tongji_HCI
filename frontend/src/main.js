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

  if (logoutButton) {
    handleLogout()
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
})

window.addEventListener('hashchange', renderCurrentRoute)

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
    checkBackend()
    renderWeekChart('home-week-chart')
  }

  if (routeName === 'trend') {
    renderWeekChart('trend-week-chart')
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

    <section class="status-card">
      <div>
        <p class="label">后端连接</p>
        <strong id="api-status">检测中</strong>
      </div>
      <span id="status-dot" class="status-dot pending"></span>
    </section>

    <section class="quick-actions" aria-label="快捷操作">
      <button class="primary-action" type="button" data-route="record">记录一餐</button>
      <button class="secondary-action" type="button" data-route="calendar">查看日历</button>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>今日记录</h2>
        <span>3 餐</span>
      </div>
      <div class="meal-list">
        <article class="meal-item">
          <span>早餐</span>
          <strong>包子、豆浆</strong>
        </article>
        <article class="meal-item">
          <span>午餐</span>
          <strong>米饭、番茄炒蛋、青菜</strong>
        </article>
        <article class="meal-item muted">
          <span>晚餐</span>
          <strong>等待记录</strong>
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
        <h2>输入饮食内容</h2>
        <span>AI 识别模拟</span>
      </div>
      <textarea class="meal-input" rows="5" placeholder="例如：午餐吃了米饭、番茄炒蛋和青菜"></textarea>
      <button class="primary-action full-width" type="button">开始识别</button>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>识别结果</h2>
        <span>待确认</span>
      </div>
      <div class="parse-list">
        <div class="parse-item">
          <span>主食</span>
          <strong>米饭</strong>
        </div>
        <div class="parse-item">
          <span>蛋白质</span>
          <strong>番茄炒蛋</strong>
        </div>
        <div class="parse-item">
          <span>蔬菜</span>
          <strong>青菜</strong>
        </div>
      </div>
      <button class="secondary-action full-width" type="button" data-route="home">保存并返回首页</button>
    </section>
  `
}

function renderCalendar() {
  const days = Array.from({ length: 30 }, (_, index) => index + 1)
    .map((day) => {
      const active = [3, 8, 12, 18, 24, 29].includes(day) ? 'has-record' : ''
      const today = day === 11 ? 'today' : ''
      return `<button class="calendar-day ${active} ${today}" type="button">${day}</button>`
    })
    .join('')

  return `
    <section class="card">
      <div class="section-heading">
        <h2>2026 年 5 月</h2>
        <span>历史记录</span>
      </div>
      <div class="calendar-grid">${days}</div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>5 月 11 日</h2>
        <span>3 餐</span>
      </div>
      <div class="meal-list">
        <article class="meal-item">
          <span>早餐</span>
          <strong>包子、豆浆</strong>
        </article>
        <article class="meal-item">
          <span>午餐</span>
          <strong>米饭、番茄炒蛋、青菜</strong>
        </article>
      </div>
    </section>
  `
}

function renderTrend() {
  return `
    <section class="card">
      <div class="section-heading">
        <h2>本周记录趋势</h2>
        <span>7 天</span>
      </div>
      <div class="chart-wrap large">
        <canvas id="trend-week-chart" aria-label="本周记录趋势"></canvas>
      </div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>温和建议</h2>
        <span>AI 模拟</span>
      </div>
      <p class="summary-text">本周记录比较稳定，午餐蔬菜出现频率较高。可以继续保持规律记录，晚餐如果经常遗漏，可以先用一句话快速补记。</p>
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

function renderWeekChart(canvasId) {
  const ctx = document.querySelector(`#${canvasId}`)

  if (!ctx) {
    return
  }

  activeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      datasets: [
        {
          label: '记录餐数',
          data: [2, 3, 2, 4, 3, 2, 3],
          borderColor: '#5BAA75',
          backgroundColor: 'rgba(91, 170, 117, 0.14)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  })
}
