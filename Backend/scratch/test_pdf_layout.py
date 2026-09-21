import os
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
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
                print(f"Registered TTF Fonts: {reg_name}, {bold_name}")
                break
            except Exception as e:
                print(f"Failed registering {reg_name}: {e}")

    return regular_font, bold_font


class NumberedCanvas(canvas.Canvas):
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

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Footer line
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.5)
        self.line(36, 36, 612 - 36, 36)

        # Footer Text
        self.setFont(getattr(self, "_regular_font", "Helvetica"), 8)
        self.setFillColor(colors.HexColor("#6B7280"))
        
        now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
        self.drawString(36, 22, f"NextVisit BI Analytics Report  |  Generated {now_str}")
        self.drawRightString(612 - 36, 22, f"Page {self._pageNumber} of {page_count}")
        
        self.restoreState()


def test_pdf_generation():
    reg_font, bold_font = register_unicode_fonts()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle("T", fontName=bold_font, fontSize=18, leading=22, textColor=colors.HexColor("#4F46E5"), spaceAfter=4)
    subtitle_style = ParagraphStyle("ST", fontName=reg_font, fontSize=9, leading=12, textColor=colors.HexColor("#6B7280"), spaceAfter=10)
    h2_style = ParagraphStyle("H2", fontName=bold_font, fontSize=12, leading=16, textColor=colors.HexColor("#1F2937"), spaceBefore=12, spaceAfter=6)
    
    c_bold = ParagraphStyle("CB", fontName=bold_font, fontSize=8, leading=11, textColor=colors.HexColor("#111827"))
    c_val = ParagraphStyle("CV", fontName=reg_font, fontSize=8, leading=11, textColor=colors.HexColor("#374151"))
    c_val_right = ParagraphStyle("CVR", fontName=reg_font, fontSize=8, leading=11, textColor=colors.HexColor("#374151"), alignment=2)
    c_bold_right = ParagraphStyle("CBR", fontName=bold_font, fontSize=8, leading=11, textColor=colors.HexColor("#111827"), alignment=2)

    elements = []

    # 1. Header Banner
    elements.append(Paragraph("<b>Shubham Cafe & Bakers</b>", title_style))
    elements.append(Paragraph("<b>Business Intelligence Performance Report</b> — SALON MODULE", subtitle_style))
    
    # 2. Filter Summary Box
    filter_summary = [
        [Paragraph("<b>Applied Date Range:</b> Last 30 Days (01 Jul 2026 - 31 Jul 2026)", c_val), Paragraph("<b>Payment Method:</b> All Payments", c_val)],
        [Paragraph("<b>Staff Filter:</b> All Staff", c_val), Paragraph("<b>Status Filter:</b> Completed Only", c_val)],
    ]
    t_filter = Table(filter_summary, colWidths=[270, 270])
    t_filter.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F4F6")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E5E7EB")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_filter)
    elements.append(Spacer(1, 10))

    # 3. KPI Grid
    elements.append(Paragraph("Executive KPI Summary", h2_style))
    kpi_data = [
        [Paragraph("Total Revenue", c_bold), Paragraph("₹19,997.00", c_val_right), Paragraph("Net Revenue", c_bold), Paragraph("₹18,500.00", c_val_right)],
        [Paragraph("Total Appointments", c_bold), Paragraph("142", c_val_right), Paragraph("Completed / Cancelled", c_bold), Paragraph("130 / 12", c_val_right)],
        [Paragraph("Average Ticket Size", c_bold), Paragraph("₹142.30", c_val_right), Paragraph("Average Daily Revenue", c_bold), Paragraph("₹666.56", c_val_right)],
        [Paragraph("Total Customers", c_bold), Paragraph("85", c_val_right), Paragraph("New / Returning", c_bold), Paragraph("25 / 60 (70.6%)", c_val_right)],
        [Paragraph("Loyalty Points Earned", c_bold), Paragraph("1,999 pts", c_val_right), Paragraph("Coupons Redeemed", c_bold), Paragraph("18", c_val_right)],
    ]
    t_kpi = Table(kpi_data, colWidths=[135, 135, 135, 135])
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_kpi)
    elements.append(Spacer(1, 12))

    # 4. Top Customers Table
    elements.append(Paragraph("Top Customers Performance", h2_style))
    cust_headers = [Paragraph("Customer Name", c_bold), Paragraph("Phone", c_bold), Paragraph("Visits", c_bold_right), Paragraph("Lifetime Spend", c_bold_right), Paragraph("Avg Spend", c_bold_right)]
    cust_rows = [cust_headers]
    
    sample_customers = [
        ("Rahul Sharma with Extra Long Customer Name for Testing Layout Overflow", "+91 9876543210", 12, "₹15,400.00", "₹1,283.33"),
        ("Priya Verma", "+91 9876543211", 8, "₹9,800.00", "₹1,225.00"),
        ("Amit Patel", "+91 9876543212", 6, "₹7,200.00", "₹1,200.00"),
        ("Neha Gupta", "+91 9876543213", 5, "₹6,500.00", "₹1,300.00"),
    ]
    
    for name, phone, visits, spend, avg in sample_customers:
        cust_rows.append([
            Paragraph(name, c_val),
            Paragraph(phone, c_val),
            Paragraph(str(visits), c_val_right),
            Paragraph(spend, c_val_right),
            Paragraph(avg, c_val_right),
        ])

    t_cust = Table(cust_rows, colWidths=[180, 90, 50, 110, 110])
    t_cust.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2FF")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_cust)

    # Attach canvas class
    canvas_maker = lambda *args, **kwargs: NumberedCanvas(*args, **kwargs)
    NumberedCanvas._regular_font = reg_font

    doc.build(elements, canvasmaker=canvas_maker)
    print("Test PDF built successfully!")
    
    buffer.seek(0)
    with open("scratch/test_layout.pdf", "wb") as f:
        f.write(buffer.read())
    print("Saved to scratch/test_layout.pdf")

if __name__ == "__main__":
    test_pdf_generation()
