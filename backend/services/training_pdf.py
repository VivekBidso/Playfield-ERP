"""Training PDF generator — assembles a branded, screenshot-rich how-to PDF.

Uses ReportLab. Screenshots are expected to be PNG files at the given paths.

NOTE: ReportLab and PIL are imported lazily via _lazy_load() so that simply
importing this module (e.g., during FastAPI route registration) does NOT pull
in the heavy reportlab/PIL dependencies. Imports happen on the first call to
build_branch_ops_pdf().
"""
import os
from io import BytesIO

SCREENSHOT_DIR = "/app/backend/static/training/branch_ops"

# Lazy-loaded reportlab handles + color palette. Populated by _lazy_load() on
# first call to build_branch_ops_pdf(). Declared at module level so the helper
# functions (_styles, _fig, _table, _draw_page_footer) can reference them by
# name without re-importing.
_LAZY_LOADED = False
A4 = None
cm = None
colors = None
TA_LEFT = None
TA_CENTER = None
SimpleDocTemplate = None
Paragraph = None
Spacer = None
Image = None
PageBreak = None
Table = None
TableStyle = None
KeepTogether = None
getSampleStyleSheet = None
ParagraphStyle = None
PRIMARY = None
SUCCESS = None
WARNING = None
DANGER = None
MUTED = None
BG_LIGHT = None


def _lazy_load():
    """Import reportlab + initialize color palette. Idempotent.

    Called at the top of build_branch_ops_pdf(). Subsequent calls are free
    (Python caches module imports).
    """
    global _LAZY_LOADED
    global A4, cm, colors, TA_LEFT, TA_CENTER
    global SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
    global Table, TableStyle, KeepTogether
    global getSampleStyleSheet, ParagraphStyle
    global PRIMARY, SUCCESS, WARNING, DANGER, MUTED, BG_LIGHT

    if _LAZY_LOADED:
        return

    from reportlab.lib.pagesizes import A4 as _A4
    from reportlab.lib.styles import getSampleStyleSheet as _gss, ParagraphStyle as _PS
    from reportlab.lib.units import cm as _cm
    from reportlab.lib import colors as _colors
    from reportlab.lib.enums import TA_LEFT as _TA_LEFT, TA_CENTER as _TA_CENTER
    from reportlab.platypus import (
        SimpleDocTemplate as _SDT, Paragraph as _P, Spacer as _S,
        Image as _I, PageBreak as _PB, Table as _T, TableStyle as _TS,
        KeepTogether as _KT,
    )

    A4 = _A4
    cm = _cm
    colors = _colors
    TA_LEFT = _TA_LEFT
    TA_CENTER = _TA_CENTER
    SimpleDocTemplate = _SDT
    Paragraph = _P
    Spacer = _S
    Image = _I
    PageBreak = _PB
    Table = _T
    TableStyle = _TS
    KeepTogether = _KT
    getSampleStyleSheet = _gss
    ParagraphStyle = _PS

    PRIMARY = colors.HexColor("#1d4ed8")
    SUCCESS = colors.HexColor("#15803d")
    WARNING = colors.HexColor("#b45309")
    DANGER = colors.HexColor("#b91c1c")
    MUTED = colors.HexColor("#475569")
    BG_LIGHT = colors.HexColor("#f1f5f9")

    _LAZY_LOADED = True


def _styles():
    ss = getSampleStyleSheet()
    custom = {
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=ss["Title"], fontSize=28, leading=34,
            textColor=colors.HexColor("#0f172a"), alignment=TA_LEFT, spaceAfter=12,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=ss["Normal"], fontSize=14, leading=18,
            textColor=MUTED, alignment=TA_LEFT, spaceAfter=24,
        ),
        "h1": ParagraphStyle(
            "H1", parent=ss["Heading1"], fontSize=20, leading=26, textColor=PRIMARY,
            spaceBefore=18, spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "H2", parent=ss["Heading2"], fontSize=14, leading=18,
            textColor=colors.HexColor("#0f172a"), spaceBefore=14, spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "H3", parent=ss["Heading3"], fontSize=11.5, leading=14,
            textColor=MUTED, spaceBefore=8, spaceAfter=4, fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "Body", parent=ss["Normal"], fontSize=10.5, leading=15,
            textColor=colors.HexColor("#1e293b"), spaceAfter=6,
        ),
        "caption": ParagraphStyle(
            "Caption", parent=ss["Normal"], fontSize=9, leading=12,
            textColor=MUTED, alignment=TA_CENTER, spaceAfter=14, italic=True,
        ),
        "callout": ParagraphStyle(
            "Callout", parent=ss["Normal"], fontSize=10, leading=14,
            textColor=colors.HexColor("#0f172a"), leftIndent=10, rightIndent=10,
            borderColor=PRIMARY, borderWidth=0, borderPadding=8,
            backColor=BG_LIGHT, spaceBefore=6, spaceAfter=10,
        ),
        "step_num": ParagraphStyle(
            "StepNum", parent=ss["Normal"], fontSize=11.5, leading=16,
            textColor=PRIMARY, fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4,
        ),
    }
    return custom


def _fig(path, caption, width_cm=16, max_height_cm=20):
    """Return [Image, caption] list or [note] if missing."""
    full = path if os.path.isabs(path) else os.path.join(SCREENSHOT_DIR, path)
    s = _styles()
    if not os.path.exists(full):
        return [Paragraph(f"<i>[Screenshot missing: {os.path.basename(full)}]</i>", s["caption"])]
    try:
        from PIL import Image as PILImage
        with PILImage.open(full) as pim:
            iw, ih = pim.size
        width_pt = width_cm * cm
        height_pt = width_pt * (ih / iw) if iw else width_pt
        # Cap height; if too tall, shrink both dimensions proportionally
        max_pt = max_height_cm * cm
        if height_pt > max_pt:
            scale = max_pt / height_pt
            height_pt = max_pt
            width_pt = width_pt * scale
        img = Image(full, width=width_pt, height=height_pt)
        img.hAlign = "CENTER"
        return [img, Paragraph(caption, s["caption"])]
    except Exception as e:
        return [Paragraph(f"<i>[Image error: {e}]</i>", s["caption"])]


def _table(headers, rows, col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _draw_page_footer(canvas, doc):
    """Footer on every page."""
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, 1.6 * cm, A4[0] - 2 * cm, 1.6 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(2 * cm, 1.1 * cm, "Factory OPS — Training Guide")
    canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Page {doc.page}")
    canvas.restoreState()


def build_branch_ops_pdf(completed_flow_data: dict = None) -> bytes:
    """Return the Branch Ops training PDF as bytes.

    completed_flow_data keys (optional, from live flow capture):
        schedule_code, sku_id, branch, target_qty, completed_qty, completed_at
    """
    _lazy_load()
    s = _styles()
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
        title="Factory OPS — Branch Ops Training",
        author="Factory OPS",
    )

    d = completed_flow_data or {}
    flow_sched_code = d.get("schedule_code", "PS_202604_XXXX")
    flow_sku = d.get("sku_id", "—")
    flow_branch = d.get("branch", "—")
    flow_target = d.get("target_qty", "—")
    flow_done = d.get("completed_qty", "—")

    story = []

    # ============ Cover ============
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph("Factory OPS", s["cover_sub"]))
    story.append(Paragraph("Branch Operations", s["cover_title"]))
    story.append(Paragraph("Training Guide — for shop-floor supervisors & branch operators",
                           s["cover_sub"]))
    story.append(Spacer(1, 2 * cm))
    cover_tbl = Table([
        ["Module", "Branch Operations"],
        ["Audience", "Branch Ops role, Master Admin"],
        ["What you'll learn", "Viewing daily production schedules, checking RM availability, completing schedules, tracking shortages"],
        ["Estimated time", "10 minutes to read · 5 minutes hands-on"],
    ], colWidths=[4.5 * cm, 12 * cm])
    cover_tbl.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(cover_tbl)
    story.append(PageBreak())

    # ============ 1. Overview ============
    story.append(Paragraph("1. Overview", s["h1"]))
    story.append(Paragraph(
        "Branch Operations (<b>Branch Ops</b>) is your daily cockpit for running production at a manufacturing unit. "
        "It shows which SKUs are scheduled to be produced today, tomorrow and this week, and lets you mark them as "
        "completed once they are off the line. Every completion updates finished-goods (FG) inventory, consumes raw "
        "materials (RM) per Bill-of-Materials (BOM), and fires an event that downstream modules (Dispatch, Reports) react to.",
        s["body"]
    ))
    story.append(Paragraph("Where Branch Ops sits in the bigger flow", s["h2"]))
    story.append(Paragraph(
        "<b>CPC</b> uploads the production plan &rarr; <b>Branch Ops</b> (you) completes the schedules &rarr; "
        "<b>Dispatch</b> picks up the FG &rarr; <b>Reports</b> calculate margin and fulfillment.",
        s["callout"]
    ))
    story.append(Paragraph("Who uses this module", s["h2"]))
    story.append(Paragraph(
        "• <b>Branch supervisors / ops staff</b> — complete schedules daily.<br/>"
        "• <b>Master Admin</b> — full visibility across branches; can also complete on someone's behalf.<br/>"
        "• <b>Other roles</b> — read-only, can view dashboards and schedule history.",
        s["body"]
    ))
    story.append(PageBreak())

    # ============ 2. Access ============
    story.append(Paragraph("2. Accessing Branch Ops", s["h1"]))
    story.append(Paragraph(
        "After logging in, click <b>Branch Ops</b> in the left sidebar. If you do not see the menu item, your role "
        "does not have access — ask your admin to grant the <i>branch_ops</i> or <i>master_admin</i> role.",
        s["body"]
    ))
    for el in _fig("01_sidebar.png", "Figure 2.1 — Branch Ops entry in the sidebar", width_cm=6, max_height_cm=18):
        story.append(el)
    story.append(PageBreak())

    # ============ 3. Dashboard ============
    story.append(Paragraph("3. The Dashboard", s["h1"]))
    story.append(Paragraph(
        "When the page opens you see four KPI cards at the top, followed by filters and the schedules table. "
        "All values reflect the branches you are assigned to.",
        s["body"]
    ))
    for el in _fig("02_dashboard.png", "Figure 3.1 — Branch Ops dashboard with KPI cards and schedules list", max_height_cm=9):
        story.append(el)

    story.append(Paragraph("What each KPI card means", s["h2"]))
    story.append(_table(
        ["Card", "Shows", "Why it matters"],
        [
            ["Today's Production", "Pending vs Completed schedules for today", "Quick read on how much of today's plan is still open"],
            ["Today's Quantity", "Target qty vs Produced qty today", "Units-level progress, not just count of schedules"],
            ["This Week", "Total scheduled / completed for the week", "Weekly commitment tracker"],
            ["Critical Alerts", "RM shortages or overdue schedules", "Red = immediate action needed"],
        ],
        col_widths=[4 * cm, 5 * cm, 7.5 * cm]
    ))
    story.append(PageBreak())

    # ============ 4. Filtering ============
    story.append(Paragraph("4. Filtering the Schedule List", s["h1"]))
    story.append(Paragraph(
        "Three filters at the top of the schedules table let you slice the list.",
        s["body"]
    ))
    story.append(Paragraph("Date range", s["h3"]))
    story.append(Paragraph(
        "Today (default) · Tomorrow · This Week · Custom (pick Start and End). After choosing Custom, two date pickers appear.",
        s["body"]
    ))
    story.append(Paragraph("Branch", s["h3"]))
    story.append(Paragraph(
        "Visible only if you are assigned to more than one branch. Defaults to <i>All Branches</i>.",
        s["body"]
    ))
    story.append(Paragraph("Status", s["h3"]))
    story.append(Paragraph(
        "Filter by <b>Scheduled</b> (yet to complete), <b>Completed</b>, or <b>Cancelled</b>. Click <b>Apply Filters</b> to refresh.",
        s["body"]
    ))
    for el in _fig("03_filters.png", "Figure 4.1 — Filter panel with Date range, Branch, and Status selectors", max_height_cm=9):
        story.append(el)
    story.append(PageBreak())

    # ============ 5. Complete a schedule ============
    story.append(Paragraph("5. Completing a Production Schedule", s["h1"]))
    story.append(Paragraph(
        "This is the main activity on the page. It is a 3-click flow: <b>Complete &rarr; Check RM &rarr; Confirm Complete</b>.",
        s["body"]
    ))

    story.append(Paragraph("Step 1 · Find the schedule and click Complete", s["step_num"]))
    story.append(Paragraph(
        "Locate a row with status <b>Scheduled</b>. A green <b>Complete</b> button is shown in the Action column. "
        "Rows already <i>Completed</i> or <i>Cancelled</i> do not have the button.",
        s["body"]
    ))
    for el in _fig("04_schedule_row.png", "Figure 5.1 — Schedule row with the green Complete button", max_height_cm=9):
        story.append(el)

    story.append(Paragraph("Step 2 · Enter actual quantity produced", s["step_num"]))
    story.append(Paragraph(
        "A dialog opens showing the schedule code, SKU, target quantity, and an <b>Actual Quantity Produced</b> input "
        "(pre-filled with the target). Edit if production was over or under target. A warning appears if it deviates.",
        s["body"]
    ))
    for el in _fig("05_complete_dialog.png", "Figure 5.2 — Completion dialog with the quantity input and Notes field", max_height_cm=9):
        story.append(el)

    story.append(Paragraph("Step 3 · Pre-check RM availability", s["step_num"]))
    story.append(Paragraph(
        "Click <b>Check RM</b>. The system pulls the BOM for the SKU, multiplies each RM quantity by your Actual "
        "Quantity, and compares against current branch RM stock. You get one of two outcomes:",
        s["body"]
    ))
    for el in _fig("06_precheck_ok.png", "Figure 5.3 — \"RM Available\" success banner (all BOM items covered)", max_height_cm=9):
        story.append(el)
    story.append(Paragraph(
        "If any RM is short, a red table lists each RM ID with <i>Required</i>, <i>Available</i> and <i>Shortage</i> "
        "columns. The Confirm button stays disabled until the shortage is resolved (raise a procurement request or "
        "reduce the quantity).",
        s["body"]
    ))
    for el in _fig("07_precheck_short.png", "Figure 5.4 — \"Insufficient RM Stock\" error with per-RM shortage table", max_height_cm=9):
        story.append(el)

    story.append(Paragraph("Step 4 · Confirm Complete", s["step_num"]))
    story.append(Paragraph(
        "Once RM pre-check is green, click <b>Confirm Complete</b>. You will see a success toast and the row flips "
        "to <b>Completed</b>. In the background the system does several things (listed below).",
        s["body"]
    ))
    for el in _fig("08_completed_row.png", "Figure 5.5 — Row status flipped to Completed after confirming", max_height_cm=9):
        story.append(el)

    # Live flow evidence
    if completed_flow_data:
        story.append(Paragraph("Live flow captured for this PDF", s["h2"]))
        story.append(_table(
            ["Field", "Value"],
            [
                ["Schedule Code", str(flow_sched_code)],
                ["SKU", str(flow_sku)],
                ["Branch", str(flow_branch)],
                ["Target Qty", str(flow_target)],
                ["Completed Qty", str(flow_done)],
                ["Event fired", "SCHEDULE_COMPLETED"],
            ],
            col_widths=[4 * cm, 12 * cm]
        ))

    story.append(PageBreak())

    # ============ 6. I/O reference ============
    story.append(Paragraph("6. Inputs & Outputs — Reference", s["h1"]))
    story.append(Paragraph("Inputs (what you provide)", s["h2"]))
    story.append(_table(
        ["Field", "Type", "Required", "Notes"],
        [
            ["Schedule selection", "Click", "Yes", "Only SCHEDULED rows show the button"],
            ["Actual Quantity Produced", "Number", "Yes", "Pre-filled with target; can be over or under"],
            ["Completion Notes", "Text", "No", "Free-text, stored on the schedule record"],
            ["Branch filter", "Dropdown", "No", "Defaults to all your assigned branches"],
            ["Date range filter", "Radio + dates", "No", "Today / Tomorrow / Week / Custom"],
        ],
        col_widths=[4.5 * cm, 2.5 * cm, 2 * cm, 7 * cm]
    ))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("Outputs (what the system updates)", s["h2"]))
    story.append(_table(
        ["Output", "What gets updated"],
        [
            ["Branch FG Inventory", "branch_sku_inventory.current_stock increases by actual qty for the target SKU / branch"],
            ["Branch RM Inventory", "For each BOM item: stock decreases by (actual qty × BOM quantity)"],
            ["Schedule record", "status → COMPLETED, completed_by, completed_at, completed_quantity stamped"],
            ["Event log", "SCHEDULE_COMPLETED event published (visible in Events & Audit page)"],
            ["Dispatch Lot", "If schedule is linked to a lot, lot status → FULLY_PRODUCED"],
            ["Reports", "Margin report and production-by-unit report reflect the update on next refresh"],
        ],
        col_widths=[5 * cm, 11 * cm]
    ))
    story.append(PageBreak())

    # ============ 7. Issues / FAQ ============
    story.append(Paragraph("7. Common Issues & FAQ", s["h1"]))
    story.append(_table(
        ["Question / Issue", "Answer / Fix"],
        [
            ["\"Check RM\" shows a shortage", "Resolve the shortage first — either raise a procurement request for the short RMs, or reduce the Actual Quantity so the BOM fits within available stock."],
            ["Complete button is missing on a row", "Button only shows for SCHEDULED rows. COMPLETED and CANCELLED rows show the completer's name instead."],
            ["I don't see any schedules", "Check the filters — change date range to \"This Week\" and status to \"Scheduled\". If still empty, CPC has not uploaded a plan for your branch."],
            ["I can't see a specific branch", "Your role's assigned_branches list does not include it. Ask Master Admin to update your user record."],
            ["I completed with wrong quantity", "Contact Master Admin. The completion is final; reversing requires an admin-level correction on the inventory."],
            ["\"Confirm Complete\" button is disabled", "Either quantity is 0 or RM pre-check failed. Both must pass."],
        ],
        col_widths=[6 * cm, 10 * cm]
    ))
    story.append(Spacer(1, 0.6 * cm))

    # ============ 8. Tips ============
    story.append(Paragraph("8. Tips for Daily Use", s["h1"]))
    story.append(Paragraph(
        "• <b>Start your day</b> with the default view (Today + Scheduled). Close each row as production finishes — don't batch at EOD.<br/>"
        "• <b>Always Check RM first</b>. A green banner before clicking Confirm means inventory will update cleanly.<br/>"
        "• <b>Use Notes</b> for any deviation (e.g. \"Machine breakdown — 2 hrs loss\") so Reports have context.<br/>"
        "• <b>Shortages repeat?</b> Raise them to procurement proactively — they appear in the Critical Alerts card too.<br/>"
        "• <b>Weekly review</b> — switch filter to \"This Week\" + \"Completed\" to verify no rows were missed.",
        s["body"]
    ))
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        "Questions, feedback, or found a bug? Ping the Master Admin or raise a ticket in the internal support channel.",
        s["callout"]
    ))

    doc.build(story, onFirstPage=_draw_page_footer, onLaterPages=_draw_page_footer)
    buf.seek(0)
    return buf.read()
