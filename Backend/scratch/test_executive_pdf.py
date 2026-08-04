import os
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Image, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ---------------------------------------------------------------------------
# Font Registration Helper
# ---------------------------------------------------------------------------
def register_unicode_fonts():
    font_candidates = [
        ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf", "SegoeUI", "SegoeUI-Bold"),
        ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "Arial", "Arial-Bold"),
        ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf", "Calibri", "Calibri-Bold"),
    ]
    
    regular_font = "Helvetica"
    bold_font = "Helvetica-Bold"

    for reg_path, bold_path, reg_name, bold_name in font_candidates:
        if os.path.exists(reg_path) and os.path.exists(bold_path):
            try:
                pdfmetrics.registerFont(TTFont(reg_name, reg_path))
                pdfmetrics.registerFont(TTFont(bold_name, bold_path))
                regular_font = reg_name
                bold_font = bold_name
                break
            except Exception:
                pass

    return regular_font, bold_font


# ---------------------------------------------------------------------------
# Matplotlib Chart Generators for PDF
# ---------------------------------------------------------------------------
def chart_revenue_trend(series):
    if not series:
        return None
    fig, ax = plt.subplots(figsize=(6.8, 2.2), dpi=150)
    labels = [s['label'] for s in series]
    revs = [s['revenue'] for s in series]
    nets = [s['net_revenue'] for s in series]

    ax.plot(labels, revs, marker='o', color='#4F46E5', linewidth=2, label='Gross Revenue')
    ax.fill_between(labels, revs, color='#4F46E5', alpha=0.12)
    ax.plot(labels, nets, marker='s', color='#10B981', linewidth=1.5, linestyle='--', label='Net Revenue')

    ax.set_title('Revenue Trend (₹)', fontsize=9, fontweight='bold', color='#1F2937', pad=6)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#E5E7EB')
    ax.spines['bottom'].set_color('#E5E7EB')
    ax.tick_params(colors='#6B7280', labelsize=7)
    ax.grid(axis='y', linestyle='--', alpha=0.4)
    ax.legend(loc='upper left', fontsize=7, frameon=False)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=540, height=175)


def chart_payment_pie(pm_list):
    if not pm_list:
        return None
    fig, ax = plt.subplots(figsize=(3.2, 2.2), dpi=150)
    labels = [p['name'] for p in pm_list]
    values = [p['value'] for p in pm_list]
    colors_list = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']

    wedges, texts, autotexts = ax.pie(
        values, labels=labels, autopct='%1.0f%%',
        startangle=140, colors=colors_list[:len(values)],
        textprops=dict(fontsize=7, color='#374151'),
        wedgeprops=dict(width=0.4, edgecolor='w')
    )
    plt.setp(autotexts, size=7, weight="bold", color="white")
    ax.set_title('Payment Method Breakdown', fontsize=9, fontweight='bold', color='#1F2937', pad=6)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=255, height=175)


def chart_top_items(items_list, is_salon=True):
    if not items_list:
        return None
    fig, ax = plt.subplots(figsize=(3.2, 2.2), dpi=150)
    top = items_list[:5][::-1]
    names = [it['name'][:18] for it in top]
    revs = [it['revenue'] for it in top]

    bars = ax.barh(names, revs, color='#6366F1', height=0.55)
    ax.set_title('Top Services Revenue (₹)' if is_salon else 'Top Menu Items Revenue (₹)', fontsize=9, fontweight='bold', color='#1F2937', pad=6)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#E5E7EB')
    ax.spines['bottom'].set_color('#E5E7EB')
    ax.tick_params(colors='#6B7280', labelsize=7)
    ax.grid(axis='x', linestyle='--', alpha=0.4)

    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=255, height=175)


# ---------------------------------------------------------------------------
# Numbered Canvas
# ---------------------------------------------------------------------------
class ExecutiveNumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        
        # Footer line
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.5)
        self.line(36, 34, 612 - 36, 34)

        # Footer Text
        font_name = getattr(self, "_regular_font", "Helvetica")
        self.setFont(font_name, 8)
        self.setFillColor(colors.HexColor("#6B7280"))
        
        now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
        self.drawString(36, 20, f"NextVisit Executive BI Report  |  Confidential  |  {now_str}")
        self.drawRightString(612 - 36, 20, f"Page {self._pageNumber} of {page_count}")
        
        self.restoreState()


def test_executive_pdf_build():
    reg_font, bold_font = register_unicode_fonts()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=50,
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle("T", fontName=bold_font, fontSize=20, leading=24, textColor=colors.HexColor("#4F46E5"), spaceAfter=2)
    subtitle_style = ParagraphStyle("ST", fontName=bold_font, fontSize=10, leading=14, textColor=colors.HexColor("#1F2937"), spaceAfter=8)
    meta_style = ParagraphStyle("M", fontName=reg_font, fontSize=8, leading=11, textColor=colors.HexColor("#6B7280"), spaceAfter=10)
    
    h2_style = ParagraphStyle("H2", fontName=bold_font, fontSize=11, leading=15, textColor=colors.HexColor("#1F2937"), spaceBefore=10, spaceAfter=4)
    summary_item_style = ParagraphStyle("SI", fontName=reg_font, fontSize=8.5, leading=12, textColor=colors.HexColor("#374151"))

    c_bold = ParagraphStyle("CB", fontName=bold_font, fontSize=8, leading=11, textColor=colors.HexColor("#111827"))
    c_val = ParagraphStyle("CV", fontName=reg_font, fontSize=8, leading=11, textColor=colors.HexColor("#374151"))
    c_val_right = ParagraphStyle("CVR", fontName=reg_font, fontSize=8, leading=11, textColor=colors.HexColor("#374151"), alignment=2)
    c_bold_right = ParagraphStyle("CBR", fontName=bold_font, fontSize=8, leading=11, textColor=colors.HexColor("#111827"), alignment=2)
    
    kpi_title_style = ParagraphStyle("KT", fontName=reg_font, fontSize=7.5, leading=9, textColor=colors.HexColor("#6B7280"))
    kpi_val_style = ParagraphStyle("KV", fontName=bold_font, fontSize=12, leading=14, textColor=colors.HexColor("#4F46E5"), alignment=0)
    kpi_sub_style = ParagraphStyle("KS", fontName=reg_font, fontSize=7, leading=9, textColor=colors.HexColor("#9CA3AF"))

    elements = []

    # 1. Executive Header Banner
    elements.append(Paragraph("<b>SHUBHAM CAFE & BAKERS</b>", title_style))
    elements.append(Paragraph("Executive Business Intelligence Performance Report — <b>SALON MODULE</b>", subtitle_style))
    elements.append(Paragraph("Generated on: 04 Aug 2026, 05:55 PM  |  Generated By: Business Owner  |  Status: Verified Confidential", meta_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E5E7EB"), spaceAfter=10))

    # 2. Filter Summary Context Box
    filter_data = [
        [Paragraph("<b>Applied Date Range:</b> This Month (01 Aug 2026 - 31 Aug 2026)", c_val), Paragraph("<b>Payment Filter:</b> All Payments (Cash, UPI, Card)", c_val)],
        [Paragraph("<b>Staff Filter:</b> All Staff", c_val), Paragraph("<b>Status Filter:</b> Completed Appointments Only", c_val)],
    ]
    t_filter = Table(filter_data, colWidths=[270, 270])
    t_filter.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_filter)
    elements.append(Spacer(1, 10))

    # 3. Executive Summary (Data-Driven Bullets)
    elements.append(Paragraph("Executive Highlights", h2_style))
    exec_summary_bullets = [
        "• <b>Total Revenue</b> generated this period: <b>₹20,447.00</b> across <b>142 completed appointments</b>.",
        "• <b>Average Ticket Size</b> per completed appointment stood at <b>₹143.99</b> with an average daily revenue of <b>₹659.58</b>.",
        "• <b>Top Stylist / Staff</b> member contributed <b>98%</b> of total salon revenue during this period.",
        "• Customer retention remains high with a <b>70.6% repeat customer rate</b> (60 returning clients out of 85 total).",
        "• Loyalty program awarded <b>2,043 points</b> with <b>18 coupons redeemed</b> driving ₹2,700 in campaign revenue.",
    ]
    for b in exec_summary_bullets:
        elements.append(Paragraph(b, summary_item_style))
        elements.append(Spacer(1, 2))
    elements.append(Spacer(1, 10))

    # 4. KPI Dashboard Cards (4-Column Layout)
    elements.append(Paragraph("Executive KPI Dashboard", h2_style))
    
    def make_kpi_cell(title, value, sub):
        p_t = Paragraph(title, kpi_title_style)
        p_v = Paragraph(value, kpi_val_style)
        p_s = Paragraph(sub, kpi_sub_style)
        t = Table([[p_t], [p_v], [p_s]], colWidths=[125])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        return t

    kpi_grid_data = [
        [
            make_kpi_cell("TOTAL REVENUE", "₹20,447.00", "Gross billings"),
            make_kpi_cell("NET REVENUE", "₹18,500.00", "After discounts"),
            make_kpi_cell("APPOINTMENTS", "142", "130 comp / 12 canc"),
            make_kpi_cell("AVG TICKET SIZE", "₹143.99", "Per appointment"),
        ],
        [
            make_kpi_cell("DAILY AVG REVENUE", "₹659.58", "Per active day"),
            make_kpi_cell("TOTAL CLIENTS", "85", "70.6% repeat rate"),
            make_kpi_cell("NEW CLIENTS", "25", "60 returning"),
            make_kpi_cell("LOYALTY POINTS", "2,043 pts", "Points awarded"),
        ],
    ]
    t_kpi_grid = Table(kpi_grid_data, colWidths=[135, 135, 135, 135])
    t_kpi_grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t_kpi_grid)
    elements.append(Spacer(1, 12))

    # 5. Embedded High-Res Charts Section
    elements.append(Paragraph("Performance Trends & Breakdown", h2_style))
    sample_trend = [
        {'label': 'Aug 01', 'revenue': 1200, 'net_revenue': 1100},
        {'label': 'Aug 02', 'revenue': 2500, 'net_revenue': 2300},
        {'label': 'Aug 03', 'revenue': 3800, 'net_revenue': 3500},
        {'label': 'Aug 04', 'revenue': 4200, 'net_revenue': 3900},
    ]
    sample_pm = [{'name': 'Cash', 'value': 12000}, {'name': 'UPI', 'value': 6000}, {'name': 'Card', 'value': 2447}]
    sample_items = [{'name': 'Hair Cut & Styling', 'revenue': 8500}, {'name': 'Hair Spa', 'revenue': 5200}, {'name': 'Facial', 'revenue': 4100}]

    img_trend = chart_revenue_trend(sample_trend)
    if img_trend:
        elements.append(img_trend)
        elements.append(Spacer(1, 8))

    img_pie = chart_payment_pie(sample_pm)
    img_items = chart_top_items(sample_items, is_salon=True)
    if img_pie and img_items:
        t_side_charts = Table([[img_pie, img_items]], colWidths=[270, 270])
        t_side_charts.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        elements.append(t_side_charts)
        elements.append(Spacer(1, 10))

    # 6. Staff Performance Table (Salon)
    elements.append(Paragraph("Stylist & Staff Performance", h2_style))
    staff_headers = [Paragraph("Staff Member", c_bold), Paragraph("Role", c_bold), Paragraph("Appointments", c_bold_right), Paragraph("Revenue", c_bold_right), Paragraph("Avg Ticket", c_bold_right), Paragraph("Rank", c_bold)]
    staff_rows = [staff_headers]
    
    sample_staff = [
        ("Pooja Sharma", "Senior Stylist", 85, "₹14,500.00", "₹170.58", "Top Performer"),
        ("Vikram Singh", "Hair Stylist", 40, "₹5,200.00", "₹130.00", "High"),
        ("Anita Roy", "Junior Stylist", 17, "₹1,747.00", "₹102.76", "Regular"),
    ]
    for name, role, appts, rev, avg, rank in sample_staff:
        staff_rows.append([
            Paragraph(f"<b>{name}</b>" if rank == "Top Performer" else name, c_val),
            Paragraph(role, c_val),
            Paragraph(str(appts), c_val_right),
            Paragraph(rev, c_val_right),
            Paragraph(avg, c_val_right),
            Paragraph(f"<b>{rank}</b>" if rank == "Top Performer" else rank, c_val),
        ])

    t_staff = Table(staff_rows, colWidths=[140, 90, 75, 85, 80, 70])
    t_staff.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    
    elements.append(t_staff)
    elements.append(Spacer(1, 10))

    # 7. Top Customers Table (Zebra Striped)
    elements.append(Paragraph("Top High-Value Clients", h2_style))
    cust_headers = [Paragraph("Client Name", c_bold), Paragraph("Phone", c_bold), Paragraph("Visits", c_bold_right), Paragraph("Lifetime Spend", c_bold_right), Paragraph("Avg Spend", c_bold_right), Paragraph("Membership", c_bold)]
    cust_rows = [cust_headers]
    
    sample_customers = [
        ("Rahul Sharma", "+91 9876543210", 12, "₹15,400.00", "₹1,283.33", "VIP"),
        ("Priya Verma", "+91 9876543211", 8, "₹9,800.00", "₹1,225.00", "VIP"),
        ("Amit Patel", "+91 9876543212", 6, "₹7,200.00", "₹1,200.00", "Regular"),
        ("Neha Gupta", "+91 9876543213", 5, "₹6,500.00", "₹1,300.00", "Regular"),
    ]
    
    for idx, (name, phone, visits, spend, avg, memb) in enumerate(sample_customers):
        cust_rows.append([
            Paragraph(name, c_val),
            Paragraph(phone, c_val),
            Paragraph(str(visits), c_val_right),
            Paragraph(spend, c_val_right),
            Paragraph(avg, c_val_right),
            Paragraph(memb, c_val),
        ])

    t_cust = Table(cust_rows, colWidths=[150, 90, 45, 95, 95, 65])
    t_cust.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FFFFFF"), colors.HexColor("#F8FAFC")]),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_cust)

    canvas_maker = lambda *args, **kwargs: ExecutiveNumberedCanvas(*args, **kwargs)
    ExecutiveNumberedCanvas._regular_font = reg_font

    doc.build(elements, canvasmaker=canvas_maker)
    print("Executive PDF built successfully!")
    
    buffer.seek(0)
    with open("scratch/test_executive_pdf.pdf", "wb") as f:
        f.write(buffer.read())
    print("Saved to scratch/test_executive_pdf.pdf")

if __name__ == "__main__":
    test_executive_pdf_build()
