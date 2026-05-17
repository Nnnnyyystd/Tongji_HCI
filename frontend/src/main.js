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
  mealDetail: {
    title: '历史详情',
    render: renderMealDetail,
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
const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

function mealTypeLabel(type) {
  return MEAL_LABELS[type] || type
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function resolveImageUrl(url) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

function defaultAvatarUrl(user = authState.user) {
  const userId = Number(user?.id) || 1
  return `/uploads/headpic/${((userId - 1) % 5) + 1}.png`
}

function userAvatarSrc(user = authState.user) {
  return resolveImageUrl(user?.avatar_url || defaultAvatarUrl(user))
}

function renderMealItem(m, options = {}) {
  const clickableAttrs = options.clickable
    ? `data-route="mealDetail" data-route-id="${m.id}" role="button" tabindex="0" aria-label="查看${mealTypeLabel(m.meal_type)}详情"`
    : ''
  const clickableClass = options.clickable ? ' clickable' : ''
  const reanalyzeButton = options.reanalyze
    ? `<button class="meal-action-link" type="button" data-action="reanalyze-meal" data-meal-id="${m.id}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v6h-6"/></svg>
          <span>AI 重评</span>
        </button>`
    : ''
  const scoreRow =
    m.score !== null
      ? `<div class="meal-score-row">
           <span class="meal-score-badge">${m.score}分</span>
         </div>`
      : ''
  const imageBlock = m.image_url
    ? `<img class="meal-item-photo" src="${resolveImageUrl(m.image_url)}" alt="${mealTypeLabel(m.meal_type)}照片" loading="lazy" />`
    : ''

  const actionRow = options.actions
    ? `<div class="meal-actions">
        <button class="meal-action-link" type="button" data-route="mealDetail" data-route-id="${m.id}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h14M11 6l6 6-6 6"/></svg>
          <span>详情</span>
        </button>
        ${reanalyzeButton}
        <button class="meal-action-link danger" type="button" data-action="delete-meal" data-meal-id="${m.id}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/></svg>
          <span>删除</span>
        </button>
      </div>`
    : ''

  return `<article class="meal-item${clickableClass}" ${clickableAttrs}>
    <span>${mealTypeLabel(m.meal_type)}</span>
    <div>
      ${imageBlock}
      <strong>${escapeHtml(m.content)}</strong>
      ${scoreRow}
      ${actionRow}
    </div>
  </article>`
}

function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getSelectedHomeDate() {
  return document.querySelector('#home-date')?.value || homeState.selectedDate || todayDateStr()
}

function formatDateLabel(dateStr) {
  if (dateStr === todayDateStr()) return '今日'

  const [year, month, day] = dateStr.split('-').map((n) => parseInt(n))
  if (!year || !month || !day) return '选中日期'
  return `${month} 月 ${day} 日`
}

function formatDateDisplay(dateStr) {
  const [year, month, day] = dateStr.split('-').map((n) => parseInt(n))
  if (!year || !month || !day) return dateStr
  return `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`
}

let activeChart = null
let homeState = {
  selectedDate: todayDateStr(),
}
let calendarState = (() => {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1, selectedDay: d.getDate() }
})()

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
  const deleteMealButton = event.target.closest('[data-action="delete-meal"]')
  const reanalyzeMealButton = event.target.closest('[data-action="reanalyze-meal"]')
  const addDateMealButton = event.target.closest('[data-action="add-date-meal"]')
  const recordHomeDateButton = event.target.closest('[data-action="record-home-date"]')
  const viewHomeCalendarButton = event.target.closest('[data-action="view-home-calendar"]')
  const viewTrendButton = event.target.closest('[data-action="view-trend"]')
  const avatarUploadButton = event.target.closest('[data-action="avatar-upload"]')
  const calendarMonthButton = event.target.closest('[data-calendar-month]')
  const calDay = event.target.closest('.calendar-day[data-day]')

  if (logoutButton) {
    handleLogout()
    return
  }

  if (deleteMealButton) {
    handleMealDelete(parseInt(deleteMealButton.dataset.mealId))
    return
  }

  if (reanalyzeMealButton) {
    handleMealReanalyze(parseInt(reanalyzeMealButton.dataset.mealId))
    return
  }

  if (addDateMealButton) {
    navigateTo('record', { params: { date: addDateMealButton.dataset.date } })
    return
  }

  if (recordHomeDateButton) {
    navigateTo('record', { params: { date: getSelectedHomeDate() } })
    return
  }

  if (viewHomeCalendarButton) {
    syncCalendarToDate(getSelectedHomeDate())
    navigateTo('calendar')
    return
  }

  if (viewTrendButton) {
    navigateTo('trend')
    return
  }

  if (avatarUploadButton) {
    document.querySelector('#avatar-input')?.click()
    return
  }

  if (calendarMonthButton) {
    shiftCalendarMonth(parseInt(calendarMonthButton.dataset.calendarMonth))
    return
  }

  if (calDay) {
    if (calDay.disabled) return
    const day = parseInt(calDay.dataset.day)
    calendarState.selectedDay = day
    document.querySelectorAll('.calendar-day').forEach((b) => b.classList.remove('selected-day'))
    calDay.classList.add('selected-day')
    loadDayDetail(calendarState.year, calendarState.month, day)
    return
  }
  if (event.target.closest('#photo-upload')) {
    document.querySelector('#photo-input')?.click()
    return
  }

  if (event.target.closest('#detail-photo-upload')) {
    document.querySelector('#detail-photo-input')?.click()
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

  navigateTo(routeButton.dataset.route, {
    params: routeButton.dataset.routeId ? { id: routeButton.dataset.routeId } : undefined,
  })
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

  if (event.target.matches('#meal-detail-form')) {
    event.preventDefault()
    handleMealDetailSave(event.target)
  }
})

window.addEventListener('hashchange', renderCurrentRoute)

document.addEventListener('change', (event) => {
  if (event.target.matches('#photo-input')) {
    handlePhotoSelect(event.target)
    resetScoreResult()
  }

  if (event.target.matches('#detail-photo-input')) {
    handleDetailPhotoSelect(event.target)
  }

  if (event.target.matches('#meal-date')) {
    loadRecordExistingMeals(event.target.value)
    const display = event.target.closest('.date-picker-shell')?.querySelector('strong')
    if (display) display.textContent = formatDateDisplay(event.target.value)
  }

  if (event.target.matches('#meal-detail-form input[name="date"]')) {
    const display = event.target.closest('.date-picker-shell')?.querySelector('strong')
    if (display) display.textContent = formatDateDisplay(event.target.value)
  }

  if (event.target.matches('#home-date')) {
    const date = event.target.value || todayDateStr()
    homeState.selectedDate = date
    navigateTo('home', { replace: true, params: { date } })
  }

  if (event.target.matches('#avatar-input')) {
    handleAvatarUpload(event.target)
  }
})

document.addEventListener('focusin', (event) => {
  if (event.target.matches('#meal-type')) {
    loadRecordExistingMeals()
  }
})

document.addEventListener('keydown', (event) => {
  const trendCard = event.target.closest('.home-trend-card[data-action="view-trend"]')
  if (trendCard && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    navigateTo('trend')
    return
  }

  const recordCard = event.target.closest('.home-record-card[data-action="record-home-date"]')
  if (recordCard && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    navigateTo('record', { params: { date: getSelectedHomeDate() } })
    return
  }

  const routePanel = event.target.closest('[data-route][role="button"]')
  if (routePanel && !event.target.closest('button') && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    navigateTo(routePanel.dataset.route, {
      params: routePanel.dataset.routeId ? { id: routePanel.dataset.routeId } : undefined,
    })
    return
  }

  const addItem = event.target.closest('.add-meal-item[data-action="add-date-meal"]')
  if (addItem && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    navigateTo('record', { params: { date: addItem.dataset.date } })
    return
  }

  const item = event.target.closest('.meal-item.clickable[data-route]')
  if (!item || (event.key !== 'Enter' && event.key !== ' ')) return

  event.preventDefault()
  navigateTo(item.dataset.route, {
    params: item.dataset.routeId ? { id: item.dataset.routeId } : undefined,
  })
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
  const params = options.params ? new URLSearchParams(options.params).toString() : ''
  const nextHash = `#/${nextRoute}${params ? `?${params}` : ''}`

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

function parseRouteHash() {
  const raw = window.location.hash.replace('#/', '')
  const [routeName, query = ''] = raw.split('?')
  return {
    routeName: routes[routeName] ? routeName : 'home',
    params: new URLSearchParams(query),
  }
}

function getCurrentRoute() {
  return parseRouteHash().routeName
}

function getRouteParams() {
  return parseRouteHash().params
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
    loadTodayMeals(homeState.selectedDate)
    loadTodaySummary(homeState.selectedDate)
  }

  if (routeName === 'record') {
    loadRecordExistingMeals()
  }

  if (routeName === 'calendar') {
    loadCalendarData(calendarState.year, calendarState.month, calendarState.selectedDay)
  }

  if (routeName === 'mealDetail') {
    loadMealDetail()
  }

  if (routeName === 'trend') {
    loadWeekChart('trend-week-chart')
    loadWeekStatsPanel()
    loadTodaySummary()
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
  if (!window.confirm('确定要退出登录吗？如果只是想返回首页，请使用底部导航。')) {
    return
  }

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

async function handleAvatarUpload(input) {
  const message = document.querySelector('#avatar-message')
  const file = input.files?.[0]
  if (!file) return

  setMessage(message, '正在上传头像...', 'info')

  const fd = new FormData()
  fd.append('image', file)

  try {
    const response = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authState.token}` },
      body: fd,
    })
    const result = await response.json().catch(() => null)

    if (response.status === 401) {
      clearAuth()
      navigateTo('login', { replace: true })
      throw new Error('登录已过期，请重新登录')
    }

    if (!response.ok || result?.success === false) {
      throw new Error(formatApiError(result) || '头像上传失败')
    }

    authState.user = result.data
    localStorage.setItem(USER_KEY, JSON.stringify(result.data))
    const avatar = document.querySelector('#settings-avatar')
    if (avatar) avatar.src = userAvatarSrc(result.data)
    setMessage(message, '头像已更新', 'success')
  } catch (error) {
    setMessage(message, error.message || '头像上传失败', 'error')
  } finally {
    input.value = ''
  }
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

function resetScoreResult() {
  const scoreCard = document.querySelector('#score-card')
  if (!scoreCard) return

  scoreCard.classList.add('hidden')

  const textDefaults = [
    ['#score-number', '—'],
    ['#score-variety', '—'],
    ['#score-balance', '—'],
    ['#score-cooking', '—'],
    ['#score-comment', ''],
  ]
  textDefaults.forEach(([selector, value]) => {
    const element = document.querySelector(selector)
    if (element) element.textContent = value
  })

  ;['#score-value', '#score-variety-value', '#score-balance-value', '#score-cooking-value', '#score-comment-value'].forEach(
    (selector) => {
      const input = document.querySelector(selector)
      if (input) input.value = ''
    },
  )
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
  const selectedDate = getRouteParams().get('date') || homeState.selectedDate || todayDateStr()
  homeState.selectedDate = selectedDate
  const dateLabel = formatDateLabel(selectedDate)

  return `
    <section class="status-card account-entry" data-route="settings" role="button" tabindex="0" aria-label="进入偏好设置">
      <div>
        <p class="label">当前用户</p>
        <strong>${displayName}</strong>
      </div>
      <img class="user-avatar" src="${userAvatarSrc()}" alt="${escapeHtml(displayName)}的头像" />
    </section>

    <section class="card home-trend-card" data-action="view-trend" role="button" tabindex="0" aria-label="进入一周趋势">
      <div class="section-heading">
        <h2>一周趋势</h2>
        <button class="text-action" type="button" data-action="view-trend">查看</button>
      </div>
      <div class="chart-wrap">
        <canvas id="home-week-chart" aria-label="一周饮食记录趋势"></canvas>
      </div>
    </section>

    <section class="quick-actions" aria-label="快捷操作">
      <button class="primary-action" type="button" data-action="record-home-date">记录一餐</button>
      <button class="secondary-action" type="button" data-action="view-home-calendar">查看日历</button>
    </section>

    <section class="card">
      <label class="form-row home-date-row">
        <span>查看日期</span>
        <span class="date-picker-shell">
          <strong id="home-date-display">${escapeHtml(formatDateDisplay(selectedDate))}</strong>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>
          <input id="home-date" type="date" value="${escapeHtml(selectedDate)}" max="${todayDateStr()}" aria-label="查看日期" />
        </span>
      </label>
    </section>

    <section class="card home-record-card" data-action="record-home-date" role="button" tabindex="0" aria-label="进入${dateLabel}记录">
      <div class="section-heading">
        <h2>${dateLabel}记录</h2>
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
        <h2>${dateLabel}总结</h2>
        <span id="today-summary-count">加载中</span>
      </div>
      <div id="today-summary" class="summary-text">正在根据${dateLabel}记录生成总结...</div>
    </section>
  `
}

function renderRecord() {
  const selectedDate = getRouteParams().get('date') || todayDateStr()
  return `
    <section class="card">
      <div class="section-heading">
        <h2>记录一餐</h2>
      </div>
      <form id="meal-form">
        <label class="form-row">
          <span>日期</span>
          <span class="date-picker-shell">
            <strong>${escapeHtml(formatDateDisplay(selectedDate))}</strong>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>
            <input id="meal-date" name="date" type="date" value="${escapeHtml(selectedDate)}" required aria-label="记录日期" />
          </span>
        </label>
        <label class="form-row">
          <span>餐次</span>
          <select id="meal-type" name="meal_type">
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

    <section class="card">
      <div class="section-heading">
        <h2>当前日期已有记录</h2>
        <span id="record-existing-count">加载中</span>
      </div>
      <div class="meal-list" id="record-existing-meals">
        <article class="meal-item muted">
          <span>—</span>
          <strong>正在加载</strong>
        </article>
      </div>
    </section>
  `
}

function renderCalendar() {
  const { year, month, selectedDay } = calendarState
  const todayDate = new Date()
  const todayYear = todayDate.getFullYear()
  const todayMonth = todayDate.getMonth() + 1
  const todayDay = todayDate.getDate()
  const isCurrentMonth = year === todayYear && month === todayMonth
  const daysInMonth = new Date(year, month, 0).getDate()
  if (selectedDay > daysInMonth) calendarState.selectedDay = daysInMonth
  if (isCurrentMonth && calendarState.selectedDay > todayDay) calendarState.selectedDay = todayDay

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    .map((day) => {
      const isFuture =
        year > todayYear || (year === todayYear && month > todayMonth) || (year === todayYear && month === todayMonth && day > todayDay)
      const isToday = day === todayDay && month === todayMonth && year === todayYear ? 'today' : ''
      const selected = day === calendarState.selectedDay ? 'selected-day' : ''
      return `<button class="calendar-day ${isToday} ${selected} ${isFuture ? 'future-day' : ''}" type="button" data-day="${day}" ${isFuture ? 'disabled' : ''}>${day}</button>`
    })
    .join('')

  return `
    <section class="card">
      <div class="section-heading">
        <h2>${year} 年 ${month} 月</h2>
        <div class="calendar-controls">
          <button class="text-action" type="button" data-calendar-month="-1">上月</button>
          <button class="text-action" type="button" data-calendar-month="1" ${isCurrentMonth ? 'disabled' : ''}>下月</button>
        </div>
      </div>
      <div class="calendar-grid" id="calendar-grid">${days}</div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2 id="detail-date">${month} 月 ${calendarState.selectedDay} 日</h2>
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

function renderMealDetail() {
  return `
    <section class="card" id="meal-detail-page">
      <div class="section-heading">
        <h2>记录详情</h2>
        <button class="text-action" type="button" data-route="calendar">返回日历</button>
      </div>
      <article class="meal-item muted">
        <span>—</span>
        <strong>正在加载</strong>
      </article>
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
        <h2>常见食物</h2>
        <span id="week-stats-meta">加载中</span>
      </div>
      <div class="meal-list" id="top-foods-list">
        <article class="meal-item muted">
          <span>-</span>
          <strong>正在加载</strong>
        </article>
      </div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>今日反馈</h2>
        <span id="today-summary-count">加载中</span>
      </div>
      <div id="today-summary" class="summary-text">正在根据今日记录生成总结...</div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>本周 AI 分析</h2>
        <span id="ai-summary-meta" class="score-comment"></span>
      </div>
      <div id="ai-summary" class="summary-text">点击下方按钮，AI 将根据本周记录生成饮食总结。</div>
      <button class="secondary-action full-width" id="ai-analyze-btn" type="button">生成本周分析</button>
    </section>
  `
}

function renderSettings() {
  const userName = authState.user?.display_name || authState.user?.username || '当前用户'

  return `
    <section class="status-card profile-card">
      <img class="user-avatar large" id="settings-avatar" src="${userAvatarSrc()}" alt="${escapeHtml(userName)}的头像" />
      <div>
        <p class="label">已登录</p>
        <strong>${userName}</strong>
        <button class="text-action avatar-action" type="button" data-action="avatar-upload">更换头像</button>
        <input class="hidden" id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" />
        <p class="form-message" id="avatar-message" aria-live="polite"></p>
      </div>
    </section>

    <section class="card">
      <div class="section-heading">
        <h2>饮食偏好</h2>
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

    <section class="card danger-zone">
      <div>
        <h2>账号操作</h2>
        <p>退出后需要重新登录。返回首页可以直接使用底部导航。</p>
      </div>
      <button class="danger-action" type="button" data-action="logout">退出登录</button>
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

async function loadTodayMeals(date = todayDateStr()) {
  const countEl = document.querySelector('#today-count')
  const mealsEl = document.querySelector('#today-meals')
  const emptyText = date === todayDateStr() ? '今日暂无记录' : '该日暂无记录'

  if (!countEl) return

  try {
    const result = await apiRequest(`/api/meals?date=${encodeURIComponent(date)}`, { auth: true })
    const meals = result.data

    countEl.textContent = `${meals.length} 餐`

    if (meals.length === 0) {
      mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>${emptyText}</strong></article>`
    } else {
      mealsEl.innerHTML = meals.map((meal) => renderMealItem(meal, { clickable: true })).join('')
    }
  } catch {
    if (countEl) countEl.textContent = '—'
    if (mealsEl) mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>加载失败</strong></article>`
  }
}

async function loadTodaySummary(date = todayDateStr()) {
  const summaryEl = document.querySelector('#today-summary') || document.querySelector('#ai-summary')
  const countEl = document.querySelector('#today-summary-count') || document.querySelector('#ai-summary-meta')
  if (!summaryEl) return

  if (date !== todayDateStr()) {
    await loadLocalDaySummary(date, summaryEl, countEl)
    return
  }

  try {
    const result = await apiRequest('/api/agent/today-summary', { auth: true })
    const data = result.data
    const highlights = Array.isArray(data.highlights) && data.highlights.length
      ? `<div class="summary-highlights">${data.highlights.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
      : ''

    summaryEl.classList.remove('structured')
    summaryEl.innerHTML = `
      <p>${escapeHtml(data.summary)}</p>
      <p>${escapeHtml(data.suggestion)}</p>
      ${highlights}
    `
    if (countEl) {
      countEl.textContent = data.meal_count ? `${data.meal_count} 餐` : '暂无记录'
    }
  } catch (error) {
    summaryEl.textContent = error.message || '今日总结加载失败'
    if (countEl) countEl.textContent = '-'
  }
}

async function loadWeekStatsPanel() {
  const metaEl = document.querySelector('#week-stats-meta')
  const listEl = document.querySelector('#top-foods-list')
  if (!metaEl || !listEl) return

  try {
    const result = await apiRequest('/api/stats/week', { auth: true })
    const data = result.data
    metaEl.textContent = `${data.total_meals} 餐 / ${data.recorded_days} 天`
    if (!data.top_foods.length) {
      listEl.innerHTML = `<article class="meal-item muted"><span>-</span><strong>本周还没有可统计的食物</strong></article>`
      return
    }
    listEl.innerHTML = data.top_foods
      .map(
        (item, index) => `<article class="meal-item">
          <span>TOP ${index + 1}</span>
          <div><strong>${escapeHtml(item.name)}</strong><div class="meal-score-row"><span class="meal-score-badge">${item.count} 次</span></div></div>
        </article>`,
      )
      .join('')
  } catch (error) {
    metaEl.textContent = '-'
    listEl.innerHTML = `<article class="meal-item muted"><span>-</span><strong>${escapeHtml(error.message || '统计加载失败')}</strong></article>`
  }
}

async function loadCalendarData(year, month, selectedDay) {
  const daysInMonth = new Date(year, month, 0).getDate()
  calendarState.selectedDay = Math.min(selectedDay, daysInMonth)

  try {
    const result = await apiRequest(`/api/meals/month?year=${year}&month=${month}`, { auth: true })
    const recorded = new Set(result.data.days)
    const mealCounts = result.data.meal_counts || {}

    document.querySelectorAll('.calendar-day[data-day]').forEach((btn) => {
      const day = parseInt(btn.dataset.day)
      const count = Number(mealCounts[day] || mealCounts[String(day)] || 0)
      btn.classList.remove('has-record', 'record-level-1', 'record-level-2', 'record-level-3')
      btn.classList.toggle('has-record', recorded.has(day))
      if (count > 0) {
        btn.classList.add(`record-level-${Math.min(count, 3)}`)
      }
    })
  } catch {
    // calendar still works without record markers
  }

  await loadDayDetail(year, month, calendarState.selectedDay)
}

function shiftCalendarMonth(delta) {
  const next = new Date(calendarState.year, calendarState.month - 1 + delta, 1)
  const today = new Date()
  if (next.getFullYear() > today.getFullYear() || (next.getFullYear() === today.getFullYear() && next.getMonth() > today.getMonth())) {
    return
  }
  calendarState = {
    year: next.getFullYear(),
    month: next.getMonth() + 1,
    selectedDay: 1,
  }
  renderCurrentRoute()
}

function syncCalendarToDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map((n) => parseInt(n))
  if (!year || !month || !day) return

  calendarState = { year, month, selectedDay: day }
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

    const addButton = renderAddDateMealItem(date, meals.length === 0 ? '当日无记录' : '继续补记这一天')
    mealsEl.innerHTML = meals.length === 0
      ? addButton
      : `${meals.map((meal) => renderMealItem(meal, { actions: true, clickable: true })).join('')}${addButton}`
  } catch {
    if (countEl) countEl.textContent = '—'
    if (mealsEl) mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>加载失败</strong></article>`
  }
}

async function loadLocalDaySummary(date, summaryEl, countEl) {
  try {
    const result = await apiRequest(`/api/meals?date=${encodeURIComponent(date)}`, { auth: true })
    const meals = result.data

    summaryEl.classList.remove('structured')

    if (!meals.length) {
      summaryEl.innerHTML = `
        <p>这一天还没有饮食记录，可以先补记一餐。</p>
        <p>从最容易想起来的一餐开始即可，不需要一次写得很完整。</p>
      `
      if (countEl) countEl.textContent = '暂无记录'
      return
    }

    const scoreMeals = meals.filter((meal) => meal.score != null)
    const averageScore = scoreMeals.length
      ? Math.round(scoreMeals.reduce((sum, meal) => sum + Number(meal.score), 0) / scoreMeals.length)
      : null
    const mealNames = meals.map((meal) => `${mealTypeLabel(meal.meal_type)}：${meal.content}`).join('；')
    const scoreText = averageScore == null ? '这一天还没有 AI 评分记录。' : `这一天已评分餐食的平均分是 ${averageScore} 分。`

    summaryEl.innerHTML = `
      <p>这一天共记录 ${meals.length} 餐，${scoreText}</p>
      <p>${escapeHtml(mealNames)}</p>
    `
    if (countEl) countEl.textContent = `${meals.length} 餐`
  } catch (error) {
    summaryEl.textContent = error.message || '该日总结加载失败'
    if (countEl) countEl.textContent = '-'
  }
}

function renderAddDateMealItem(date, label) {
  return `
    <article class="meal-item muted add-meal-item" role="button" tabindex="0" data-action="add-date-meal" data-date="${date}">
      <span>＋</span>
      <div>
        <strong>${label}</strong>
        <div class="meal-actions">
          <button class="meal-action-link" type="button" data-action="add-date-meal" data-date="${date}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            <span>补记这一天</span>
          </button>
        </div>
      </div>
    </article>`
}

async function loadRecordExistingMeals(date = document.querySelector('#meal-date')?.value) {
  const countEl = document.querySelector('#record-existing-count')
  const mealsEl = document.querySelector('#record-existing-meals')

  if (!countEl || !mealsEl || !date) return

  countEl.textContent = '加载中'
  mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>正在加载</strong></article>`

  try {
    const result = await apiRequest(`/api/meals?date=${date}`, { auth: true })
    const meals = result.data
    updateMealTypeAvailability(meals)
    countEl.textContent = `${meals.length} 条记录`

    if (meals.length === 0) {
      mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>该日期暂无记录，可以在上方直接新增</strong></article>`
      return
    }

    mealsEl.innerHTML = meals.map((meal) => renderMealItem(meal, { actions: true, clickable: true })).join('')
  } catch (error) {
    countEl.textContent = '—'
    mealsEl.innerHTML = `<article class="meal-item muted"><span>—</span><strong>${escapeHtml(error.message || '加载失败')}</strong></article>`
  }
}

function updateMealTypeAvailability(meals) {
  const select = document.querySelector('#meal-type')
  if (!select) return

  const usedTypes = new Set(meals.map((meal) => meal.meal_type))
  const previousValue = select.value

  Array.from(select.options).forEach((option) => {
    const used = usedTypes.has(option.value)
    option.disabled = used
    const baseLabel = mealTypeLabel(option.value)
    option.textContent = used ? `${baseLabel}（已记录）` : baseLabel
  })

  if (!usedTypes.has(previousValue)) {
    select.value = previousValue
    return
  }

  const nextAvailable = MEAL_TYPE_ORDER.find((type) => !usedTypes.has(type))
  if (nextAvailable) {
    select.value = nextAvailable
  } else {
    select.value = previousValue
  }
}

async function hasDuplicateMealType(date, mealType) {
  const result = await apiRequest(`/api/meals?date=${date}`, { auth: true })
  return result.data.some((meal) => meal.meal_type === mealType)
}

async function hasDuplicateMealTypeExcept(date, mealType, mealId) {
  const result = await apiRequest(`/api/meals?date=${date}`, { auth: true })
  return result.data.some((meal) => meal.meal_type === mealType && meal.id !== mealId)
}

function renderMealDetailContent(meal) {
  const imageBlock = `
    <div class="photo-upload detail-photo-upload ${meal.image_url ? 'has-image' : ''}" id="detail-photo-upload" role="button" tabindex="0" aria-label="上传或更换照片">
      <span class="photo-upload-icon ${meal.image_url ? 'hidden' : ''}">📷</span>
      <span id="detail-photo-placeholder" class="${meal.image_url ? 'hidden' : ''}">点击上传照片</span>
      <img id="detail-photo-preview" class="${meal.image_url ? '' : 'hidden'}" src="${meal.image_url ? resolveImageUrl(meal.image_url) : ''}" alt="餐食照片" />
      <input type="file" id="detail-photo-input" accept="image/*" class="hidden" />
    </div>`

  const scoreBlock =
    meal.score != null
      ? `<div class="score-card compact">
          <span class="score-number">${meal.score}</span>
          <div class="score-detail">
            ${meal.score_variety != null ? `<span>食材多样 <strong>${meal.score_variety}</strong>/35</span>` : ''}
            ${meal.score_balance != null ? `<span>营养均衡 <strong>${meal.score_balance}</strong>/35</span>` : ''}
            ${meal.score_cooking != null ? `<span>烹饪健康 <strong>${meal.score_cooking}</strong>/30</span>` : ''}
          </div>
          ${meal.score_comment ? `<p class="score-comment">${escapeHtml(meal.score_comment)}</p>` : ''}
        </div>`
      : `<article class="meal-item muted"><span>评分</span><strong>未进行 AI 评分</strong></article>`

  return `
    <form class="history-detail" id="meal-detail-form" data-meal-id="${meal.id}">
      ${imageBlock}
      <input type="hidden" name="image_url" value="${escapeHtml(meal.image_url || '')}" />
      <div class="detail-grid editable">
        <label class="form-row compact">
          <span>日期</span>
          <span class="date-picker-shell">
            <strong>${escapeHtml(formatDateDisplay(meal.date))}</strong>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>
            <input name="date" type="date" value="${escapeHtml(meal.date)}" required aria-label="记录日期" />
          </span>
        </label>
        <label class="form-row compact">
          <span>餐次</span>
          <select name="meal_type">
            ${MEAL_TYPE_ORDER.map(
              (type) => `<option value="${type}" ${meal.meal_type === type ? 'selected' : ''}>${mealTypeLabel(type)}</option>`,
            ).join('')}
          </select>
        </label>
        <div class="detail-meta-row">
          <span>记录时间</span><strong>${new Date(meal.created_at).toLocaleString('zh-CN')}</strong>
        </div>
      </div>
      <div class="history-content">
        <span>食物描述</span>
        <textarea class="meal-input detail-content-input" name="content" rows="4" required>${escapeHtml(meal.content)}</textarea>
      </div>
      ${scoreBlock}
      <p class="form-message" aria-live="polite"></p>
      <div class="detail-actions">
        <button class="primary-action full-width" type="submit">保存记录</button>
        <button class="secondary-action full-width" type="button" data-action="reanalyze-meal" data-meal-id="${meal.id}">
          重新 AI 识别与评分
        </button>
        <button class="danger-action" type="button" data-action="delete-meal" data-meal-id="${meal.id}">删除记录</button>
      </div>
    </form>
  `
}

async function loadMealDetail() {
  const page = document.querySelector('#meal-detail-page')
  const mealId = getRouteParams().get('id')
  if (!page) return

  if (!mealId) {
    page.innerHTML = `<article class="meal-item muted"><span>—</span><strong>缺少记录编号</strong></article>`
    return
  }

  try {
    const result = await apiRequest(`/api/meals/${mealId}`, { auth: true })
    const meal = result.data
    syncCalendarToDate(meal.date)
    page.innerHTML = `
      <div class="section-heading">
        <h2>记录详情</h2>
        <button class="text-action" type="button" data-route="calendar">返回日历</button>
      </div>
      ${renderMealDetailContent(meal)}
    `
  } catch (error) {
    page.innerHTML = `
      <div class="section-heading">
        <h2>记录详情</h2>
        <button class="text-action" type="button" data-route="calendar">返回日历</button>
      </div>
      <article class="meal-item muted"><span>—</span><strong>${escapeHtml(error.message || '加载失败')}</strong></article>
    `
  }
}

async function uploadMealPhoto(file) {
  const fd = new FormData()
  fd.append('image', file)

  const response = await fetch(`${API_BASE}/api/meals/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authState.token}` },
    body: fd,
  })
  const result = await response.json().catch(() => null)

  if (response.status === 401) {
    clearAuth()
    navigateTo('login', { replace: true })
    throw new Error('登录已过期，请重新登录')
  }

  if (!response.ok || result?.success === false) {
    throw new Error(formatApiError(result) || '图片上传失败')
  }

  return result.data?.image_url || ''
}

async function handleMealSave(form) {
  const message = form.querySelector('.form-message')
  const content = form.content.value.trim()
  const photoInput = document.querySelector('#photo-input')
  const photoFile = photoInput?.files?.[0]

  if (!content) {
    setMessage(message, '请填写食物描述或先进行 AI 识别', 'error')
    return
  }

  setMessage(message, photoFile ? '正在上传照片并保存...' : '正在保存...', 'info')

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
    if (await hasDuplicateMealType(body.date, body.meal_type)) {
      setMessage(message, `${mealTypeLabel(body.meal_type)}已经记录过，请选择其他餐次`, 'error')
      await loadRecordExistingMeals(body.date)
      return
    }

    if (photoFile) {
      body.image_url = await uploadMealPhoto(photoFile)
    }
    await apiRequest('/api/meals', { method: 'POST', auth: true, body })
    setMessage(message, '保存成功', 'success')
    syncCalendarToDate(body.date)
    setTimeout(() => navigateTo(body.date === todayDateStr() ? 'home' : 'calendar', { replace: true }), 800)
  } catch (error) {
    setMessage(message, error.message || '保存失败', 'error')
  }
}

async function handleMealDetailSave(form) {
  const message = form.querySelector('.form-message')
  const mealId = parseInt(form.dataset.mealId)
  const content = form.content.value.trim()
  const photoInput = document.querySelector('#detail-photo-input')
  const photoFile = photoInput?.files?.[0]

  if (!mealId) {
    setMessage(message, '缺少记录编号', 'error')
    return
  }

  if (!content) {
    setMessage(message, '请填写食物描述', 'error')
    return
  }

  const body = {
    date: form.date.value,
    meal_type: form.meal_type.value,
    content,
    image_url: form.image_url.value || undefined,
  }

  try {
    setMessage(message, photoFile ? '正在上传照片并保存...' : '正在保存...', 'info')

    if (await hasDuplicateMealTypeExcept(body.date, body.meal_type, mealId)) {
      setMessage(message, `${mealTypeLabel(body.meal_type)}已经记录过，请选择其他餐次`, 'error')
      return
    }

    if (photoFile) {
      body.image_url = await uploadMealPhoto(photoFile)
    }

    await apiRequest(`/api/meals/${mealId}`, { method: 'PUT', auth: true, body })
    setMessage(message, '保存成功', 'success')
    syncCalendarToDate(body.date)
    setTimeout(() => loadMealDetail(), 500)
  } catch (error) {
    setMessage(message, error.message || '保存失败', 'error')
  }
}

async function analyzeMealPayload({ text, mealType, imageUrl }) {
  const fd = new FormData()
  if (text) fd.append('text', text)
  if (mealType) fd.append('meal_type', mealType)

  if (imageUrl) {
    try {
      const imageResponse = await fetch(resolveImageUrl(imageUrl))
      if (imageResponse.ok) {
        const blob = await imageResponse.blob()
        if (blob.size) {
          fd.append('image', blob, 'meal-image')
        }
      }
    } catch {
      // Text-only reanalysis is still useful when the stored image cannot be fetched.
    }
  }

  const response = await fetch(`${API_BASE}/api/meals/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authState.token}` },
    body: fd,
  })
  const result = await response.json().catch(() => null)

  if (response.status === 401) {
    clearAuth()
    navigateTo('login', { replace: true })
    throw new Error('登录已过期，请重新登录')
  }

  if (!response.ok || result?.success === false) {
    throw new Error(formatApiError(result) || '识别失败')
  }

  const r = result?.data
  if (!r || r.score == null || r.variety == null || r.balance == null || r.cooking == null) {
    throw new Error('AI 返回数据不完整，请重试')
  }

  return r
}

async function handleMealReanalyze(mealId) {
  const btn = document.querySelector(`[data-action="reanalyze-meal"][data-meal-id="${mealId}"]`)
  if (!mealId || !btn) return

  btn.disabled = true
  btn.textContent = 'AI 识别中...'

  try {
    const mealResult = await apiRequest(`/api/meals/${mealId}`, { auth: true })
    const meal = mealResult.data
    const ai = await analyzeMealPayload({
      text: meal.content,
      mealType: meal.meal_type,
      imageUrl: meal.image_url,
    })

    await apiRequest(`/api/meals/${mealId}`, {
      method: 'PUT',
      auth: true,
      body: {
        score: ai.score,
        score_variety: ai.variety,
        score_balance: ai.balance,
        score_cooking: ai.cooking,
        score_comment: ai.comment,
      },
    })

    const route = getCurrentRoute()
    if (route === 'mealDetail') {
      await loadMealDetail()
      return
    }

    if (route === 'calendar') {
      await loadCalendarData(calendarState.year, calendarState.month, calendarState.selectedDay)
      return
    }

    renderCurrentRoute()
  } catch (error) {
    window.alert(error.message || 'AI 重新识别失败')
    btn.disabled = false
    btn.textContent = '重新 AI 识别与评分'
  }
}

async function handleMealDelete(mealId) {
  if (!mealId || !window.confirm('确定删除这条饮食记录吗？')) {
    return
  }

  try {
    await apiRequest(`/api/meals/${mealId}`, { method: 'DELETE', auth: true })
    const route = getCurrentRoute()
    if (route === 'mealDetail') {
      navigateTo('calendar', { replace: true })
      return
    }

    if (route === 'calendar') {
      await loadCalendarData(calendarState.year, calendarState.month, calendarState.selectedDay)
      return
    }

    renderCurrentRoute()
  } catch (error) {
    window.alert(error.message || '删除失败')
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
    const result = await apiRequest('/api/stats/week', { auth: true })
    labels = result.data.days
    data = result.data.average_scores
  } catch {
    // fall through with empty data
  }

  const canvasCtx = ctx.getContext('2d')
  const gradientFill = canvasCtx.createLinearGradient(0, 0, 0, ctx.height || 220)
  gradientFill.addColorStop(0, 'rgba(74, 101, 65, 0.32)')
  gradientFill.addColorStop(0.62, 'rgba(148, 167, 116, 0.16)')
  gradientFill.addColorStop(1, 'rgba(241, 241, 224, 0.02)')

  const gradientStroke = canvasCtx.createLinearGradient(0, 0, ctx.width || 320, 0)
  gradientStroke.addColorStop(0, '#68885B')
  gradientStroke.addColorStop(1, '#263F2B')

  activeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '日均评分',
          data,
          borderColor: gradientStroke,
          backgroundColor: gradientFill,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#F7F4E8',
          pointBorderColor: '#4A6541',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#4A6541',
          pointHoverBorderColor: '#F7F4E8',
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 51, 36, 0.94)',
          titleColor: '#F1F1E0',
          bodyColor: '#fff',
          borderColor: 'rgba(184, 155, 114, 0.45)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#746D5B', font: { size: 11 } },
          border: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20, color: '#746D5B', font: { size: 11 } },
          grid: { color: 'rgba(74, 101, 65, 0.14)' },
          border: { display: false },
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

function handleDetailPhotoSelect(input) {
  const file = input.files?.[0]
  if (!file) return

  const preview = document.querySelector('#detail-photo-preview')
  const placeholder = document.querySelector('#detail-photo-placeholder')
  const uploadIcon = document.querySelector('#detail-photo-upload .photo-upload-icon')
  const uploadBox = document.querySelector('#detail-photo-upload')

  preview.src = URL.createObjectURL(file)
  preview.classList.remove('hidden')
  uploadBox?.classList.add('has-image')
  if (placeholder) placeholder.classList.add('hidden')
  if (uploadIcon) uploadIcon.classList.add('hidden')
}

async function handleAnalyze() {
  const btn = document.querySelector('#analyze-btn')
  const message = document.querySelector('.form-message')
  const photoInput = document.querySelector('#photo-input')
  const contentInput = document.querySelector('#meal-content')
  const mealTypeInput = document.querySelector('#meal-form select[name="meal_type"]')
  const text = contentInput?.value.trim()
  const file = photoInput?.files?.[0]
  const mealType = mealTypeInput?.value

  if (!file && !text) {
    setMessage(message, '请上传照片或填写食物描述', 'error')
    return
  }

  btn.disabled = true
  btn.textContent = '识别中...'
  setMessage(message, '', 'info')
  resetScoreResult()

  try {
    const fd = new FormData()
    if (file) fd.append('image', file)
    if (text) fd.append('text', text)
    if (mealType) fd.append('meal_type', mealType)

    const response = await fetch(`${API_BASE}/api/meals/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authState.token}` },
      body: fd,
    })
    const result = await response.json().catch(() => null)

    if (response.status === 401) {
      clearAuth()
      navigateTo('login', { replace: true })
      throw new Error('登录已过期，请重新登录')
    }

    if (!response.ok || result?.success === false) {
      throw new Error(formatApiError(result) || '识别失败')
    }

    const r = result?.data
    if (!r || r.score == null || r.variety == null || r.balance == null || r.cooking == null) {
      throw new Error('AI 返回数据不完整，请重试')
    }

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

    if (contentInput && !text && r.identified) {
      contentInput.value = r.identified
    }
    setMessage(message, '识别完成，可确认或修改后保存', 'success')
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

function renderAiSummary(text) {
  const el = document.querySelector('#ai-summary')
  if (!el) return

  let parsed = null
  if (text && text.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!parsed || (!parsed.highlights && !parsed.improvements && !(parsed.suggestions?.length))) {
    el.classList.remove('structured')
    el.textContent = text || ''
    return
  }

  const sections = []
  if (parsed.highlights) {
    sections.push(`
      <div class="summary-section highlights">
        <span class="summary-tag"><span class="summary-tag-icon">✦</span>本周亮点</span>
        <p>${escapeHtml(parsed.highlights)}</p>
      </div>`)
  }
  if (parsed.improvements) {
    sections.push(`
      <div class="summary-section improvements">
        <span class="summary-tag"><span class="summary-tag-icon">◐</span>需改进</span>
        <p>${escapeHtml(parsed.improvements)}</p>
      </div>`)
  }
  if (Array.isArray(parsed.suggestions) && parsed.suggestions.length) {
    const items = parsed.suggestions
      .map((s, i) => `<li><span class="summary-step">${i + 1}</span><span>${escapeHtml(s)}</span></li>`)
      .join('')
    sections.push(`
      <div class="summary-section suggestions">
        <span class="summary-tag"><span class="summary-tag-icon">→</span>具体建议</span>
        <ol class="summary-list">${items}</ol>
      </div>`)
  }

  el.classList.add('structured')
  el.innerHTML = sections.join('')
}

async function loadSavedAiSummary() {
  try {
    const result = await apiRequest('/api/meals/ai-summary', { auth: true })
    if (result.data?.summary) {
      const btn = document.querySelector('#ai-analyze-btn')
      renderAiSummary(result.data.summary)
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
  summaryEl.classList.remove('structured')
  summaryEl.textContent = '正在调用 AI 分析本周饮食，请稍候...'

  try {
    const result = await apiRequest('/api/meals/ai-summary', { method: 'POST', auth: true })
    renderAiSummary(result.data.summary)
    updateSummaryMeta(result.data.created_at)
  } catch (error) {
    summaryEl.classList.remove('structured')
    summaryEl.textContent = '分析失败：' + (error.message || '请稍后再试')
  } finally {
    btn.disabled = false
    btn.textContent = '重新生成分析'
  }
}
