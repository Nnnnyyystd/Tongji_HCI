from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

from PIL import Image
import win32com.client


ROOT = Path(__file__).resolve().parents[1]
TUPIAN = ROOT / "tupian"
TEMPLATE = TUPIAN / "人机交互.pptx"
OUTPUT = TUPIAN / "FoodMate_项目摘要_需求设计_用户研究_模板风格版.pptx"
DIET_IMAGE = TUPIAN / "daxuesheng_yinshi_guannian.png"
MEDIA_DIR = TUPIAN / "template_media"
LOGO = MEDIA_DIR / "image3.png"


def rgb(r: int, g: int, b: int) -> int:
    return r + g * 256 + b * 65536


BLUE = rgb(0, 91, 145)
BLUE_DARK = rgb(0, 75, 124)
BLUE_LIGHT = rgb(231, 243, 251)
RED = rgb(220, 0, 0)
BLACK = rgb(0, 0, 0)
GRAY = rgb(95, 95, 95)
WHITE = rgb(255, 255, 255)
BORDER = rgb(0, 91, 145)


def extract_logo():
    MEDIA_DIR.mkdir(exist_ok=True)
    if LOGO.exists():
        return
    with zipfile.ZipFile(TEMPLATE) as z:
        LOGO.write_bytes(z.read("ppt/media/image3.png"))


def set_text(shape, text, size=18, color=BLACK, bold=False, font="Microsoft YaHei", align=None):
    tr = shape.TextFrame.TextRange
    tr.Text = text
    tr.Font.Name = font
    tr.Font.NameFarEast = font
    tr.Font.Size = size
    tr.Font.Bold = -1 if bold else 0
    tr.Font.Color.RGB = color
    if align is not None:
        tr.ParagraphFormat.Alignment = align
    shape.TextFrame.MarginLeft = 8
    shape.TextFrame.MarginRight = 8
    shape.TextFrame.MarginTop = 4
    shape.TextFrame.MarginBottom = 4
    return tr


def textbox(slide, x, y, w, h, text, size=18, color=BLACK, bold=False, font="Microsoft YaHei", align=None):
    shape = slide.Shapes.AddTextbox(1, x, y, w, h)
    set_text(shape, text, size, color, bold, font, align)
    return shape


def rect(slide, x, y, w, h, fill=None, line=None, weight=1.2, transparency=0):
    shape = slide.Shapes.AddShape(1, x, y, w, h)
    if fill is None:
        shape.Fill.Visible = 0
    else:
        shape.Fill.ForeColor.RGB = fill
        shape.Fill.Transparency = transparency
    if line is None:
        shape.Line.Visible = 0
    else:
        shape.Line.ForeColor.RGB = line
        shape.Line.Weight = weight
    return shape


def line(slide, x1, y1, x2, y2, color=BLUE, weight=3):
    shape = slide.Shapes.AddLine(x1, y1, x2, y2)
    shape.Line.ForeColor.RGB = color
    shape.Line.Weight = weight
    return shape


def clear_slide(slide):
    for i in range(slide.Shapes.Count, 0, -1):
        slide.Shapes(i).Delete()
    slide.FollowMasterBackground = 0
    slide.Background.Fill.ForeColor.RGB = WHITE


def ensure_slides(prs, count):
    while prs.Slides.Count < count:
        prs.Slides.Add(prs.Slides.Count + 1, 12)
    while prs.Slides.Count > count:
        prs.Slides(prs.Slides.Count).Delete()


def add_logo(slide, sw):
    if LOGO.exists():
        slide.Shapes.AddPicture(str(LOGO), 0, -1, sw - 372, 18, 300, 89)


def add_header(slide, title, sw, page):
    # Left title block, matching the supplied template.
    tri = slide.Shapes.AddShape(7, -8, 26, 58, 58)
    tri.Rotation = 90
    tri.Fill.ForeColor.RGB = BLUE
    tri.Line.Visible = 0
    textbox(slide, 64, 28, 600, 58, title, size=31, color=BLUE, bold=True, font="SimHei")
    add_logo(slide, sw)
    line(slide, 0, 102, sw, 102, BLUE, 3.2)
    textbox(slide, sw - 40, 675, 24, 18, str(page), size=12, color=rgb(120, 120, 120), align=2)


def section_label(slide, x, y, w, text):
    rect(slide, x, y, w, 40, BLUE, None)
    # subtle shadow-like base line
    line(slide, x, y + 40, x + w, y + 40, rgb(175, 175, 175), 1)
    textbox(slide, x, y + 5, w, 30, text, size=19, color=WHITE, bold=True, font="SimHei", align=2)


def bordered_box(slide, x, y, w, h, label=None, label_w=190):
    rect(slide, x, y, w, h, None, BORDER, 1.2)
    if label:
        section_label(slide, x, y - 12, label_w, label)


def add_body(slide, x, y, w, h, text, size=17, color=BLACK, align=None):
    return textbox(slide, x, y, w, h, text, size=size, color=color, font="Microsoft YaHei", align=align)


def add_bullets(slide, x, y, w, items, size=18, gap=44):
    for i, item in enumerate(items):
        yy = y + i * gap
        textbox(slide, x, yy, 20, 24, "●", size=13, color=BLUE, bold=True, font="Microsoft YaHei")
        textbox(slide, x + 24, yy - 4, w - 24, 34, item, size=size, color=BLACK, font="Microsoft YaHei")


def add_fit_picture(slide, image_path: Path, x, y, w, h):
    if not image_path.exists():
        placeholder(slide, x, y, w, h, f"缺少图片：{image_path.name}")
        return
    with Image.open(image_path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    nw, nh = iw * scale, ih * scale
    return slide.Shapes.AddPicture(str(image_path), 0, -1, x + (w - nw) / 2, y + (h - nh) / 2, nw, nh)


def placeholder(slide, x, y, w, h, text):
    rect(slide, x, y, w, h, BLUE_LIGHT, BORDER, 1.1)
    shape = textbox(slide, x + 12, y + h / 2 - 28, w - 24, 56, f"图片占位：\n{text}", size=15, color=BLUE_DARK, bold=True, align=2)
    return shape


def mini_card(slide, x, y, w, h, title, body):
    rect(slide, x, y, w, h, BLUE_LIGHT, rgb(195, 218, 236), 1.0)
    textbox(slide, x + 10, y + 10, w - 20, 23, title, size=15, color=BLUE_DARK, bold=True, align=2)
    textbox(slide, x + 10, y + 39, w - 20, h - 45, body, size=12.5, color=BLACK, align=2)


def flow(slide, x, y, w, labels):
    n = len(labels)
    gap = 8
    item_w = (w - gap * (n - 1)) / n
    for i, label in enumerate(labels):
        xx = x + i * (item_w + gap)
        rect(slide, xx, y, item_w, 48, BLUE if i % 2 == 0 else BLUE_DARK, None)
        textbox(slide, xx + 3, y + 12, item_w - 6, 22, label, size=14, color=WHITE, bold=True, align=2)
        if i < n - 1:
            textbox(slide, xx + item_w - 1, y + 12, gap + 4, 22, "→", size=14, color=BLUE, bold=True, align=2)


def bar_chart(slide, x, y, w, data):
    max_v = max(v for _, v in data)
    for i, (label, value) in enumerate(data):
        yy = y + i * 35
        textbox(slide, x, yy, 160, 24, label, size=12, color=BLACK)
        rect(slide, x + 164, yy + 3, w - 210, 17, rgb(238, 238, 238), None)
        rect(slide, x + 164, yy + 3, (w - 210) * value / max_v, 17, [BLUE, RED, rgb(80, 170, 95), rgb(245, 190, 75), rgb(70, 160, 205), BLUE_DARK][i % 6], None)
        textbox(slide, x + w - 38, yy, 38, 24, f"{value}%", size=11, color=GRAY, bold=True, align=3)


def build():
    extract_logo()
    shutil.copy2(TEMPLATE, OUTPUT)
    app = win32com.client.Dispatch("PowerPoint.Application")
    app.DisplayAlerts = 0
    prs = app.Presentations.Open(str(OUTPUT), WithWindow=False)
    # Use a 16:9 1280x720 canvas so coordinates match the exported template preview.
    # PowerPoint keeps the same widescreen aspect ratio, while avoiding right-edge clipping.
    prs.PageSetup.SlideWidth = 1280
    prs.PageSetup.SlideHeight = 720
    ensure_slides(prs, 10)
    sw = prs.PageSetup.SlideWidth
    sh = prs.PageSetup.SlideHeight
    for i in range(1, 11):
        clear_slide(prs.Slides(i))

    # 1
    s = prs.Slides(1)
    add_logo(s, sw)
    line(s, 0, 108, sw, 108, BLUE, 3.2)
    textbox(s, 66, 178, sw - 132, 86, "人机交互导论期末大作业汇报", size=32, color=BLUE, bold=True, font="SimHei", align=2)
    textbox(s, 80, 285, sw - 160, 88, "FoodMate：面向大学生的轻量化智能饮食记录 Agent", size=28, color=BLACK, bold=True, font="Microsoft YaHei", align=2)
    textbox(s, 80, 394, sw - 160, 42, "项目摘要 / 需求设计 / 用户研究", size=21, color=BLUE_DARK, bold=True, align=2)
    textbox(s, 430, 490, 380, 95, "小组成员：2353105 倪雨舒\n2352726 郑硕\n2353546 张丞玮\n2353911 李浩瑞", size=15, color=BLACK, align=1)

    # 2
    s = prs.Slides(2)
    add_header(s, "汇报范围", sw, 2)
    bordered_box(s, 54, 150, 1170, 430, "本次制作内容", 235)
    add_body(s, 86, 180, 1088, 95, "本次 PPT 聚焦人机交互课程报告中的前三个部分：项目摘要、需求设计、用户研究。内容依据 FoodMate 项目上下文、往届报告内容逻辑和饮食记录类产品调研进行组织。", 20)
    add_bullets(s, 92, 310, 1030, [
        "项目摘要：说明大学生饮食记录场景、产品定位、系统目标与技术原型边界。",
        "需求设计：从目标用户、核心任务、功能需求、交互闭环与非功能要求展开。",
        "用户研究：给出问卷设计、假设性调研结果，并说明如何转化为产品设计。"
    ], size=18, gap=56)
    textbox(s, 88, 518, 1040, 36, "注：问卷结果目前按支持设计结论的合理假设呈现，正式汇报前可替换为真实回收数据。", size=17, color=RED)

    # 3
    s = prs.Slides(3)
    add_header(s, "项目摘要", sw, 3)
    bordered_box(s, 54, 138, 586, 545, "项目背景", 235)
    add_body(s, 72, 176, 540, 478, "随着大学生日常生活节奏加快，饮食记录和饮食习惯管理逐渐成为常见需求。许多学生希望了解自己每天吃了什么、饮食是否规律、长期饮食结构是否均衡，但传统健康管理类 App 往往功能复杂、填写成本高，并且容易让用户产生热量、体重或营养指标方面的压力。\n\n在实际场景中，大学生的饮食记录通常发生在食堂、宿舍、路上等碎片化环境中，用户未必愿意认真填写详细表格，也很难准确记录克数、热量和营养成分。因此，本项目关注“低负担输入”“即时反馈”“用户确认 AI 结果”和“温和建议”等交互原则，构建一个轻量化的智能饮食记录 Web Demo。", 17)
    add_fit_picture(s, DIET_IMAGE, 678, 210, 512, 300)
    textbox(s, 690, 530, 500, 48, "图：大学生饮食观念或饮食行为统计图\n后续可替换为本次问卷正式统计图", size=13, color=GRAY, align=2)

    # 4
    s = prs.Slides(4)
    add_header(s, "项目摘要", sw, 4)
    bordered_box(s, 54, 140, 1170, 272, "项目介绍", 210)
    add_body(s, 76, 178, 1126, 190, "FoodMate 是一个面向大学生的轻量化智能饮食记录 Agent Demo。系统采用前后端分离架构，前端基于 Vite、HTML、CSS、JavaScript 和 Chart.js 实现移动端风格的 Web 界面，后端基于 Python、FastAPI 和 SQLite 提供用户认证、饮食记录、AI 识别模拟、历史查询、偏好设置和趋势统计等接口。\n\n用户通过注册和登录进入系统，在首页查看今日饮食状态；通过“记录一餐”功能输入自然语言饮食内容或上传图片，系统给出 AI 识别建议，用户确认后保存记录；通过日历页面查看历史饮食记录；通过趋势页面查看一周饮食变化和系统生成的温和建议。", 19)
    flow(s, 100, 500, 1080, ["注册登录", "记录一餐", "AI 识别", "用户确认", "历史回顾", "趋势建议"])

    # 5
    s = prs.Slides(5)
    add_header(s, "需求设计", sw, 5)
    section_label(s, 54, 126, 1120, "目标用户与典型场景")
    bordered_box(s, 54, 198, 1170, 410)
    add_bullets(s, 88, 235, 520, [
        "目标用户：在校大学生，尤其是以食堂、外卖、宿舍简餐为主要就餐来源的人群。",
        "核心痛点：想了解饮食规律，但不愿长期称重、查热量、填写复杂表单。",
        "使用目标：快速完成记录，能够按日期回顾，并看到一周饮食变化。"
    ], size=18, gap=72)
    mini_card(s, 675, 244, 470, 78, "场景 A：食堂饭后", "一句话记录“中午吃了米饭、鸡腿和青菜”。")
    mini_card(s, 675, 350, 470, 78, "场景 B：餐盘拍照", "拍照后由 AI 给出识别建议，用户确认后保存。")
    mini_card(s, 675, 456, 470, 78, "场景 C：周末回顾", "查看一周趋势，发现早餐缺失或蔬菜摄入偏少。")

    # 6
    s = prs.Slides(6)
    add_header(s, "需求设计", sw, 6)
    section_label(s, 54, 126, 1120, "核心功能需求")
    bordered_box(s, 54, 198, 1170, 408)
    mini_card(s, 90, 238, 500, 126, "基础账户与偏好", "注册、登录、退出登录；保存饮食目标、口味偏好、提醒时间和忌口食物。")
    mini_card(s, 690, 238, 500, 126, "记录一餐", "支持自然语言输入和图片上传；AI 给出识别结果，用户确认或修改后保存。")
    mini_card(s, 90, 420, 500, 126, "历史回顾", "饮食日历按月展示，标记有记录的日期，支持查看、编辑和删除历史记录。")
    mini_card(s, 690, 420, 500, 126, "趋势与总结", "展示一周记录次数、平均评分、常见食物统计，并生成今日温和建议。")

    # 7
    s = prs.Slides(7)
    add_header(s, "需求设计", sw, 7)
    section_label(s, 54, 126, 1120, "交互闭环与非功能要求")
    flow(s, 86, 205, 1110, ["用户输入", "AI 建议", "用户确认", "保存记录", "统计回顾", "温和建议"])
    add_bullets(s, 84, 312, 600, [
        "移动优先：界面适合手机端单手操作。",
        "低认知负担：核心流程控制在“输入-确认-保存”。",
        "可纠错：AI 识别结果必须可以编辑、撤回或跳过。",
        "边界清晰：不提供医疗诊断，不承诺真实营养精确计算。"
    ], size=18, gap=50)
    placeholder(s, 744, 310, 420, 230, "FoodMate 需求框图\n可由 FoodMate_requirements_diagram.io 导出后替换")
    textbox(s, 88, 585, 1050, 34, "设计落点：AI 用于降低输入成本和提供初步反馈，最终确认权交还给用户。", size=18, color=RED)

    # 8
    s = prs.Slides(8)
    add_header(s, "用户研究", sw, 8)
    section_label(s, 54, 126, 1120, "问卷调查设计")
    bordered_box(s, 54, 198, 1170, 408)
    add_bullets(s, 86, 232, 510, [
        "调研对象：在校大学生，覆盖不同年级、专业和住宿/通勤状态。",
        "投放方式：班级群、课程群和社交平台线上问卷。",
        "样本目标：80-120 份有效问卷，后续可补充 3-5 名半结构访谈。"
    ], size=17, gap=62)
    add_bullets(s, 675, 232, 500, [
        "用户背景：年级、就餐场景、运动频率。",
        "饮食现状：饮食规律、早餐、外卖、蔬菜摄入。",
        "功能偏好：文本记录、拍照识别、日历、趋势、提醒。",
        "AI 态度：信任程度、是否需要确认与编辑。",
        "界面隐私：风格偏好和数据使用边界。"
    ], size=16, gap=47)
    placeholder(s, 92, 565, 1040, 52, "正式问卷首页截图或问卷二维码")

    # 9
    s = prs.Slides(9)
    add_header(s, "用户研究", sw, 9)
    section_label(s, 54, 126, 1120, "问卷结果假设")
    textbox(s, 76, 186, 1100, 32, "说明：以下结果用于支撑当前 PPT 设计逻辑，正式汇报前应替换为真实问卷统计。假设有效样本 n=96。", size=16, color=GRAY)
    bar_chart(s, 80, 250, 560, [
        ("每周 3 天以上饮食不规律", 72),
        ("尝试记录但因麻烦放弃", 52),
        ("接受自然语言快速记录", 61),
        ("接受拍照/图片识别辅助", 58),
        ("要求 AI 结果可编辑确认", 76),
        ("偏好温和建议而非热量警告", 64),
    ])
    bordered_box(s, 705, 245, 470, 245, "结果解读", 180)
    add_body(s, 730, 284, 420, 185, "问卷假设结果表明，用户真正抗拒的不是记录本身，而是复杂、耗时和需要精确估算。AI 能提升输入效率，但用户不愿完全把判断权交给 AI；温和反馈比热量压力更适合大学生场景。", 17)
    placeholder(s, 705, 528, 470, 70, "正式问卷统计图：记录方式偏好 / AI 信任边界")

    # 10
    s = prs.Slides(10)
    add_header(s, "用户研究", sw, 10)
    section_label(s, 54, 126, 1120, "研究结论与设计转化")
    bordered_box(s, 54, 198, 540, 390, "研究结论", 180)
    add_bullets(s, 84, 240, 470, [
        "输入负担是饮食记录类产品的主要流失点。",
        "大学生需要“能坚持”的轻量工具，而不是复杂的营养系统。",
        "AI 的价值在于初步识别和降低输入成本。",
        "反馈语气应避免焦虑化，重点呈现规律、结构和可执行的小改善。"
    ], size=17, gap=60)
    bordered_box(s, 650, 198, 540, 390, "设计转化", 180)
    add_bullets(s, 680, 240, 470, [
        "首页保留醒目的“记录一餐”入口。",
        "记录页支持文本和图片两种输入方式。",
        "AI 识别后进入确认页，再保存到数据库。",
        "日历承担低压力的历史回顾功能。",
        "趋势页用图表和今日总结提供温和建议。"
    ], size=17, gap=52)
    textbox(s, 80, 630, 1080, 30, "后续可补充：用户访谈照片、Persona 卡片、真实问卷结论总览图。", size=16, color=RED, align=2)

    prs.Save()
    prs.Close()
    app.Quit()
    print(f"created: {OUTPUT}")


if __name__ == "__main__":
    build()
