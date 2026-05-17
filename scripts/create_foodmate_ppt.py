from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image
import win32com.client


ROOT = Path(__file__).resolve().parents[1]
TUPIAN = ROOT / "tupian"
TEMPLATE = TUPIAN / "人机交互.pptx"
OUTPUT = TUPIAN / "FoodMate_项目摘要_需求设计_用户研究.pptx"
DIET_IMAGE = TUPIAN / "daxuesheng_yinshi_guannian.png"


def rgb(r: int, g: int, b: int) -> int:
    return r + g * 256 + b * 65536


COLORS = {
    "ink": rgb(28, 39, 48),
    "muted": rgb(91, 103, 112),
    "teal": rgb(0, 121, 128),
    "teal_dark": rgb(0, 87, 94),
    "coral": rgb(232, 111, 82),
    "gold": rgb(245, 181, 76),
    "mint": rgb(224, 243, 238),
    "paper": rgb(248, 250, 250),
    "card": rgb(255, 255, 255),
    "line": rgb(218, 226, 230),
    "soft": rgb(239, 244, 246),
    "green": rgb(77, 154, 111),
}


def set_text(shape, text, size=18, color=None, bold=False, font="Microsoft YaHei", align=None):
    tr = shape.TextFrame.TextRange
    tr.Text = text
    tr.Font.Name = font
    tr.Font.NameFarEast = font
    tr.Font.Size = size
    tr.Font.Bold = -1 if bold else 0
    if color is not None:
        tr.Font.Color.RGB = color
    if align is not None:
        tr.ParagraphFormat.Alignment = align
    shape.TextFrame.MarginLeft = 8
    shape.TextFrame.MarginRight = 8
    shape.TextFrame.MarginTop = 5
    shape.TextFrame.MarginBottom = 5
    return tr


def textbox(slide, x, y, w, h, text, size=18, color=None, bold=False, align=None):
    shape = slide.Shapes.AddTextbox(1, x, y, w, h)
    set_text(shape, text, size=size, color=color or COLORS["ink"], bold=bold, align=align)
    return shape


def rect(slide, x, y, w, h, fill, line=None, radius=False, transparency=0):
    shape_type = 5 if radius else 1
    shape = slide.Shapes.AddShape(shape_type, x, y, w, h)
    shape.Fill.ForeColor.RGB = fill
    shape.Fill.Transparency = transparency
    if line is None:
        shape.Line.Visible = 0
    else:
        shape.Line.ForeColor.RGB = line
        shape.Line.Weight = 1
    return shape


def line(slide, x1, y1, x2, y2, color=None, weight=1.4):
    shape = slide.Shapes.AddLine(x1, y1, x2, y2)
    shape.Line.ForeColor.RGB = color or COLORS["line"]
    shape.Line.Weight = weight
    return shape


def add_header(slide, title: str, section: str, number: int, sw: float):
    rect(slide, 0, 0, sw, 54, COLORS["teal_dark"])
    textbox(slide, 28, 10, sw - 210, 34, title, size=22, color=rgb(255, 255, 255), bold=True)
    textbox(slide, sw - 165, 14, 120, 24, section, size=10.5, color=rgb(216, 240, 236), align=3)
    textbox(slide, sw - 44, 14, 24, 24, f"{number:02d}", size=12, color=rgb(255, 255, 255), bold=True, align=2)


def add_footer(slide, sw: float, sh: float, source: str = ""):
    line(slide, 28, sh - 26, sw - 28, sh - 26, COLORS["line"], 0.7)
    text = "FoodMate 人机交互课程原型"
    if source:
        text += f"  |  {source}"
    textbox(slide, 28, sh - 24, sw - 56, 18, text, size=7.5, color=COLORS["muted"])


def card(slide, x, y, w, h, heading, body, accent=COLORS["teal"], body_size=13.2):
    rect(slide, x, y, w, h, COLORS["card"], COLORS["line"], radius=True)
    rect(slide, x, y, 5, h, accent, None)
    textbox(slide, x + 16, y + 10, w - 26, 24, heading, size=15, color=COLORS["ink"], bold=True)
    textbox(slide, x + 16, y + 42, w - 26, h - 50, body, size=body_size, color=COLORS["muted"])


def placeholder(slide, x, y, w, h, text):
    shape = rect(slide, x, y, w, h, COLORS["soft"], COLORS["line"], radius=True)
    shape.Line.DashStyle = 4
    textbox(slide, x + 14, y + h / 2 - 26, w - 28, 52, f"图片占位：\n{text}", size=13, color=COLORS["muted"], bold=True, align=2)


def add_fit_picture(slide, image_path: Path, x, y, w, h):
    if not image_path.exists():
        placeholder(slide, x, y, w, h, image_path.name)
        return
    with Image.open(image_path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    nw, nh = iw * scale, ih * scale
    pic = slide.Shapes.AddPicture(str(image_path), 0, -1, x + (w - nw) / 2, y + (h - nh) / 2, nw, nh)
    return pic


def add_progress_flow(slide, x, y, w, h, labels):
    gap = 10
    item_w = (w - gap * (len(labels) - 1)) / len(labels)
    for i, label in enumerate(labels):
        xx = x + i * (item_w + gap)
        accent = [COLORS["teal"], COLORS["green"], COLORS["gold"], COLORS["coral"], COLORS["teal_dark"], COLORS["green"]][i % 6]
        rect(slide, xx, y, item_w, h, COLORS["card"], COLORS["line"], radius=True)
        rect(slide, xx, y, item_w, 7, accent, None)
        textbox(slide, xx + 8, y + 20, item_w - 16, h - 25, label, size=12.2, color=COLORS["ink"], bold=True, align=2)
        if i < len(labels) - 1:
            textbox(slide, xx + item_w - 2, y + h / 2 - 12, gap + 4, 24, "→", size=16, color=COLORS["muted"], bold=True, align=2)


def add_bar_chart(slide, x, y, w, h, data):
    max_v = max(v for _, v in data)
    label_w = 132
    bar_h = 22
    gap = (h - len(data) * bar_h) / (len(data) - 1)
    for i, (label, val) in enumerate(data):
        yy = y + i * (bar_h + gap)
        textbox(slide, x, yy - 1, label_w, bar_h + 2, label, size=11, color=COLORS["ink"])
        rect(slide, x + label_w, yy, w - label_w - 44, bar_h, COLORS["soft"], None, radius=True)
        bw = (w - label_w - 44) * val / max_v
        color = [COLORS["teal"], COLORS["green"], COLORS["gold"], COLORS["coral"], COLORS["teal_dark"], COLORS["green"]][i % 6]
        rect(slide, x + label_w, yy, bw, bar_h, color, None, radius=True)
        textbox(slide, x + label_w + bw + 4, yy - 1, 40, bar_h + 2, f"{val}%", size=10.5, color=COLORS["muted"], bold=True)


def clear_slide(slide):
    for i in range(slide.Shapes.Count, 0, -1):
        slide.Shapes(i).Delete()
    slide.FollowMasterBackground = 0
    slide.Background.Fill.ForeColor.RGB = COLORS["paper"]


def ensure_slides(prs, count):
    while prs.Slides.Count < count:
        prs.Slides.Add(prs.Slides.Count + 1, 12)
    while prs.Slides.Count > count:
        prs.Slides(prs.Slides.Count).Delete()


def build():
    shutil.copy2(TEMPLATE, OUTPUT)

    app = win32com.client.Dispatch("PowerPoint.Application")
    app.DisplayAlerts = 0
    prs = app.Presentations.Open(str(OUTPUT), WithWindow=False)
    ensure_slides(prs, 10)

    sw = prs.PageSetup.SlideWidth
    sh = prs.PageSetup.SlideHeight

    for i in range(1, 11):
        clear_slide(prs.Slides(i))

    # 1 Cover
    s = prs.Slides(1)
    rect(s, 0, 0, sw, sh, COLORS["paper"])
    rect(s, 0, 0, sw, 108, COLORS["teal_dark"])
    textbox(s, 42, 34, sw - 84, 38, "人机交互导论期末大作业汇报", size=22, color=rgb(255, 255, 255), bold=True)
    textbox(s, 42, 146, sw - 84, 64, "FoodMate：面向大学生的轻量化智能饮食记录 Agent", size=30, color=COLORS["ink"], bold=True)
    textbox(s, 45, 224, sw - 90, 52, "项目摘要 / 需求设计 / 用户研究", size=20, color=COLORS["teal_dark"], bold=True)
    card(s, 45, 326, sw - 90, 104, "小组成员", "2353105 倪雨舒    2352726 郑硕\n2353546 张丞玮    2353911 李浩瑞", accent=COLORS["coral"], body_size=16)
    textbox(s, 45, sh - 72, sw - 90, 24, "基于课程 Web Demo 原型：低负担输入、AI 辅助识别、用户确认与温和反馈", size=13, color=COLORS["muted"])

    # 2 Scope
    s = prs.Slides(2)
    add_header(s, "汇报范围与材料来源", "准备说明", 2, sw)
    card(s, 42, 86, 382, 330, "本次制作内容", "1. 项目摘要：说明项目背景、产品定位与目标用户\n2. 需求设计：梳理核心功能、交互闭环与非功能要求\n3. 用户研究：给出问卷设计、假设性调研结果与设计转化\n\n说明：本 PPT 仅覆盖以上三个部分，后续视觉与交互设计、实现细节和测试可继续沿用同一模板扩展。", accent=COLORS["teal"], body_size=15)
    card(s, 455, 86, 410, 330, "参考依据", "• 项目上下文：GPT_PROJECT_CONTEXT.md\n• 往届报告：沿用“项目摘要-需求设计-用户研究”的内容逻辑\n• 外部资料：中国居民膳食指南、WHO 健康饮食建议、饮食记录类竞品\n• 调研处理：本次问卷尚未真实回收，PPT 中结果按支持设计结论的合理假设呈现，正式报告需替换为真实数据。", accent=COLORS["green"], body_size=14.5)
    add_footer(s, sw, sh)

    # 3 Background
    s = prs.Slides(3)
    add_header(s, "项目摘要：背景与问题", "项目摘要", 3, sw)
    card(s, 42, 86, 420, 360, "大学生日常饮食记录的真实阻力", "• 饮食发生在食堂、宿舍、通勤路上等碎片化场景，用户很难每餐认真填写表格。\n• 传统健康管理 App 常要求搜索食物、估算克数和热量，记录成本高，容易中断。\n• 大学生关注作息、体态和健康，但不一定需要医学级营养分析。\n• 过强的热量、体重导向容易造成焦虑，不适合作为课程原型的主要反馈方式。\n\n因此，本项目把问题收敛为：如何让大学生用更低成本完成饮食记录，并通过温和反馈理解自己的饮食习惯。", accent=COLORS["coral"], body_size=14)
    rect(s, 494, 86, 358, 270, COLORS["card"], COLORS["line"], radius=True)
    add_fit_picture(s, DIET_IMAGE, 512, 104, 322, 232)
    textbox(s, 500, 368, 348, 46, "图示建议：大学生饮食观念或饮食行为统计图。\n若正式数据更新，可替换为本次问卷统计图。", size=10.5, color=COLORS["muted"], align=2)
    add_footer(s, sw, sh, "资料来源：中国居民膳食指南（2022）；WHO Healthy diet")

    # 4 Intro
    s = prs.Slides(4)
    add_header(s, "项目摘要：FoodMate 方案", "项目摘要", 4, sw)
    textbox(s, 42, 82, 806, 48, "FoodMate 是一个面向大学生的移动端 Web Demo，不是医疗诊断系统，而是一个展示“智能饮食记录交互流程”的课程原型。", size=17, color=COLORS["ink"], bold=True)
    add_progress_flow(s, 42, 152, 806, 72, ["注册登录", "记录一餐", "AI 识别", "用户确认", "历史回顾", "趋势建议"])
    card(s, 42, 252, 258, 166, "核心体验原则", "低负担输入：自然语言或图片均可记录\nAI 辅助：给出识别和分类建议\n用户主导：识别结果必须可确认、修改\n温和反馈：关注规律与结构，不制造焦虑", accent=COLORS["teal"], body_size=13.2)
    card(s, 316, 252, 258, 166, "已实现/预留能力", "用户注册登录与 token 鉴权\n饮食记录新增、查询、编辑、删除\n日历视图与周趋势统计\nAI 文本/图片识别接口预留，未配置 key 时可用模拟逻辑", accent=COLORS["green"], body_size=13.2)
    card(s, 590, 252, 258, 166, "技术结构", "前端：Vite、HTML、CSS、JavaScript、Chart.js\n后端：FastAPI、SQLite、SQLAlchemy、Pydantic\nAI：DeepSeek / Qwen API 接口预留", accent=COLORS["gold"], body_size=13.2)
    add_footer(s, sw, sh)

    # 5 Target users and scenarios
    s = prs.Slides(5)
    add_header(s, "需求设计：目标用户与典型场景", "需求设计", 5, sw)
    card(s, 42, 84, 250, 316, "目标用户", "在校大学生，尤其是：\n• 饮食以食堂、外卖、宿舍简餐为主的人群\n• 对健康或体态有关注，但不愿长期称重记录的人群\n• 希望回顾饮食规律，而非做专业营养诊断的人群\n• 考试周、实习期等作息波动明显的人群", accent=COLORS["teal"], body_size=13.5)
    card(s, 316, 84, 250, 316, "核心使用场景", "场景 A：食堂吃饭后，用一句话快速记录“中午吃了米饭、鸡腿、青菜”。\n\n场景 B：拍下餐盘照片，AI 给出食物识别建议，用户确认后保存。\n\n场景 C：周末查看一周趋势，发现早餐缺失或蔬菜摄入偏少。", accent=COLORS["coral"], body_size=13.4)
    card(s, 590, 84, 260, 316, "用户目标", "记录：花更少时间完成一餐记录\n确认：AI 不确定时可以改正\n回顾：按日期查看历史记录\n理解：看到一周饮食变化与常见食物\n改善：获得温和、可执行的小建议", accent=COLORS["green"], body_size=13.5)
    placeholder(s, 42, 420, 808, 56, "目标用户 Persona 或校园食堂/宿舍/外卖使用场景照片")
    add_footer(s, sw, sh)

    # 6 Functional requirements
    s = prs.Slides(6)
    add_header(s, "需求设计：核心功能需求", "需求设计", 6, sw)
    card(s, 42, 84, 390, 156, "基础账户与偏好", "• 注册、登录、退出登录、当前用户查询\n• 保存饮食目标、口味偏好、提醒时间、忌口食物\n• 账号维度保存历史记录，支持后续个性化统计", accent=COLORS["teal"], body_size=13.4)
    card(s, 460, 84, 390, 156, "记录一餐", "• 支持自然语言文本输入\n• 支持图片上传与 AI 识别能力预留\n• 展示识别结果、评分维度和说明\n• 用户确认或修改后再保存，避免 AI 直接替用户下结论", accent=COLORS["coral"], body_size=13.4)
    card(s, 42, 262, 390, 156, "历史回顾", "• 饮食日历按月展示\n• 标记有记录的日期\n• 点击日期查看当天记录\n• 支持编辑、删除历史饮食记录", accent=COLORS["green"], body_size=13.4)
    card(s, 460, 262, 390, 156, "趋势与总结", "• 一周记录次数和平均评分趋势\n• 常见食物统计\n• 今日总结与温和建议\n• 用 Chart.js 等可视化方式辅助用户理解习惯变化", accent=COLORS["gold"], body_size=13.4)
    add_footer(s, sw, sh)

    # 7 Flow and nonfunctional requirements
    s = prs.Slides(7)
    add_header(s, "需求设计：交互闭环与非功能要求", "需求设计", 7, sw)
    add_progress_flow(s, 42, 88, 806, 70, ["用户输入", "AI 建议", "用户确认", "保存记录", "统计回顾", "温和建议"])
    card(s, 42, 190, 394, 196, "非功能要求", "• 移动优先：界面适合手机端单手操作\n• 低认知负担：核心流程不超过“输入-确认-保存”三步\n• 可纠错：AI 识别结果必须能编辑、撤回或跳过\n• 隐私安全：饮食记录与偏好属于个人数据，需要账号隔离\n• 边界清晰：不提供医疗诊断，不承诺真实营养精确计算", accent=COLORS["teal"], body_size=13.2)
    placeholder(s, 466, 190, 382, 196, "需求框图：可由 tupian/FoodMate_requirements_diagram.io 导出为图片后替换")
    card(s, 42, 410, 806, 50, "设计落点", "把 AI 放在“降低输入成本”和“提供初步反馈”的位置，把最终确认权交还给用户；系统强调习惯观察，而不是热量审判。", accent=COLORS["coral"], body_size=13.2)
    add_footer(s, sw, sh)

    # 8 Questionnaire design
    s = prs.Slides(8)
    add_header(s, "用户研究：问卷设计", "用户研究", 8, sw)
    card(s, 42, 82, 250, 322, "调研对象与方式", "对象：在校大学生为主，覆盖不同年级、专业和住宿/通勤状态。\n\n方式：线上问卷投放至班级群、课程群和社交平台；后续可补充 3-5 名半结构访谈。\n\n样本目标：80-120 份有效问卷。", accent=COLORS["teal"], body_size=13.3)
    card(s, 318, 82, 250, 322, "问卷维度", "1. 用户背景：年级、性别、住宿、运动频率\n2. 饮食现状：规律性、外卖频率、早餐情况\n3. 记录习惯：是否用过健康/饮食 App，放弃原因\n4. 功能偏好：文本、拍照、日历、趋势、提醒\n5. AI 态度：信任程度、是否需要可编辑确认\n6. 界面与隐私：风格、数据使用边界", accent=COLORS["green"], body_size=12.8)
    card(s, 594, 82, 254, 322, "关键题目示例", "• 你每周有几天会觉得饮食不规律？\n• 你是否尝试过记录饮食？如果放弃，主要原因是什么？\n• 你更愿意用哪种方式记录一餐？\n• AI 识别食物后，你希望系统如何呈现结果？\n• 你更希望看到热量指标，还是习惯趋势与温和建议？", accent=COLORS["gold"], body_size=12.8)
    placeholder(s, 42, 420, 806, 48, "正式问卷首页截图或问卷二维码")
    add_footer(s, sw, sh)

    # 9 Hypothetical results
    s = prs.Slides(9)
    add_header(s, "用户研究：问卷结果假设", "用户研究", 9, sw)
    textbox(s, 42, 82, 806, 40, "说明：以下结果用于支撑当前 PPT 设计逻辑，正式汇报前应替换为真实问卷统计。假设有效样本 n=96。", size=13.5, color=COLORS["muted"])
    add_bar_chart(s, 54, 142, 470, 230, [
        ("每周 3 天以上饮食不规律", 72),
        ("尝试过记录但因麻烦放弃", 52),
        ("接受自然语言快速记录", 61),
        ("接受拍照/图片识别辅助", 58),
        ("要求 AI 结果可编辑确认", 76),
        ("偏好温和建议而非热量警告", 64),
    ])
    card(s, 560, 138, 288, 232, "结果解读", "• 用户真正抗拒的不是记录本身，而是复杂、耗时和需要精确估算。\n• AI 能提升输入效率，但用户不愿完全把判断权交给 AI。\n• 温和反馈比热量压力更适合大学生场景。\n• 结果支持 FoodMate 的“低负担输入 + 用户确认 + 趋势回顾”设计路线。", accent=COLORS["coral"], body_size=13.1)
    placeholder(s, 42, 400, 806, 54, "正式问卷统计图：记录方式偏好 / AI 信任边界 / 界面风格偏好")
    add_footer(s, sw, sh)

    # 10 Research conclusions
    s = prs.Slides(10)
    add_header(s, "用户研究：结论与设计转化", "用户研究", 10, sw)
    card(s, 42, 86, 392, 292, "研究结论", "1. 输入负担是饮食记录类产品的主要流失点。\n2. 大学生需要“能坚持”的轻量工具，而不是专业但复杂的营养系统。\n3. AI 的价值在于初步识别和降低输入成本，前提是结果可解释、可编辑。\n4. 反馈语气应避免焦虑化，重点呈现规律、结构和可执行的小改善。", accent=COLORS["teal"], body_size=14)
    card(s, 458, 86, 392, 292, "转化为产品设计", "• 首页保留醒目的“记录一餐”入口\n• 记录页支持文本和图片两种输入\n• AI 识别后进入确认页，再保存到数据库\n• 日历承担低压力的历史回顾功能\n• 趋势页用图表和今日总结提供温和建议\n• 设置页保存口味、目标与忌口，增强个性化", accent=COLORS["green"], body_size=14)
    placeholder(s, 42, 402, 808, 56, "后续可补充：用户访谈照片、Persona 卡片、真实问卷结论总览图")
    add_footer(s, sw, sh, "竞品参考：MyFitnessPal Meal Scan 官方 FAQ")

    prs.Save()
    prs.Close()
    app.Quit()


if __name__ == "__main__":
    build()
    print(f"created: {OUTPUT}")
