import io
import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.models.loyalty import CustomerLoyalty
from app.models.user import User
from app.models.visit import Visit, VisitService

logger = logging.getLogger(__name__)


def generate_salon_invoice_pdf_bytes(
    business_name: str,
    business_address: str,
    business_phone: str,
    business_email: str,
    gst_number: str | None,
    invoice_number: str,
    appointment_code: str,
    date_str: str,
    payment_status: str,
    payment_method: str,
    customer_name: str,
    customer_phone: str,
    customer_email: str | None,
    services: list[dict],
    subtotal: float,
    tax_rate: float,
    tax_amount: float,
    advance_paid: float,
    grand_total: float,
    remaining_balance: float,
    points_earned: int,
    loyalty_balance: int,
    thank_you_msg: str,
    coupon_discount: float = 0.0,
    enable_gst: bool = True,
    price_includes_gst: bool = False,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#4F46E5'),
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#6B7280'),
    )
    inv_title_style = ParagraphStyle(
        'InvTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=TA_RIGHT,
        textColor=colors.HexColor('#111827'),
    )
    section_heading = ParagraphStyle(
        'SecHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#374151'),
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#374151'),
    )
    body_bold = ParagraphStyle(
        'BodyBoldCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#111827'),
    )

    elements = []

    # 1. Header (Salon Info + Invoice Info)
    status_color_hex = "#16A34A" if payment_status.upper() in ("PAID", "COMPLETED") else "#DC2626"
    gst_str = f"<br/>GSTIN: {gst_number}" if gst_number else ""
    header_data = [
        [
            Paragraph(f"<b>{business_name}</b>", title_style),
            Paragraph("INVOICE", inv_title_style),
        ],
        [
            Paragraph(f"{business_address}<br/>Phone: {business_phone} | Email: {business_email}{gst_str}", subtitle_style),
            Paragraph(
                f"<b>Invoice #:</b> {invoice_number}<br/>"
                f"<b>Appt #:</b> {appointment_code}<br/>"
                f"<b>Date:</b> {date_str}<br/>"
                f"<b>Status:</b> <font color='{status_color_hex}'><b>{payment_status}</b></font>",
                ParagraphStyle('HeaderRight', parent=subtitle_style, alignment=TA_RIGHT),
            ),
        ],
    ]

    header_table = Table(header_data, colWidths=[320, 200])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB'), spaceBefore=2, spaceAfter=12))

    # 2. Customer Info & Payment Details
    cust_data = [
        [
            Paragraph("<b>CUSTOMER DETAILS</b>", section_heading),
            Paragraph("<b>PAYMENT SUMMARY</b>", section_heading),
        ],
        [
            Paragraph(f"<b>Name:</b> {customer_name}<br/><b>Phone:</b> {customer_phone}<br/><b>Email:</b> {customer_email or 'N/A'}", body_style),
            Paragraph(f"<b>Payment Method:</b> {payment_method}<br/><b>Payment Date:</b> {date_str}", body_style),
        ],
    ]
    cust_table = Table(cust_data, colWidths=[260, 260])
    cust_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(cust_table)
    elements.append(Spacer(1, 14))

    # 3. Services Table
    table_data = [
        [
            Paragraph("<b>#</b>", body_bold),
            Paragraph("<b>Service Description</b>", body_bold),
            Paragraph("<b>Duration</b>", ParagraphStyle('ThCenter', parent=body_bold, alignment=TA_CENTER)),
            Paragraph("<b>Price (Rs.)</b>", ParagraphStyle('ThRight', parent=body_bold, alignment=TA_RIGHT)),
        ]
    ]

    for idx, s in enumerate(services, start=1):
        table_data.append([
            Paragraph(str(idx), body_style),
            Paragraph(s.get("name", "Service"), body_style),
            Paragraph(f"{s.get('duration', 30)} mins", ParagraphStyle('TdCenter', parent=body_style, alignment=TA_CENTER)),
            Paragraph(f"Rs. {float(s.get('price', 0.0)):,.2f}", ParagraphStyle('TdRight', parent=body_style, alignment=TA_RIGHT)),
        ])

    services_table = Table(table_data, colWidths=[30, 270, 100, 120])
    services_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F3F4F6')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(services_table)
    elements.append(Spacer(1, 12))

    # 4. Totals & Financial Breakdown
    totals_data = []
    totals_data.append([Paragraph("Subtotal:", body_style), Paragraph(f"Rs. {subtotal:,.2f}", ParagraphStyle('TR', parent=body_style, alignment=TA_RIGHT))])
    
    if coupon_discount > 0:
        totals_data.append([Paragraph("Coupon Discount:", ParagraphStyle('TDisc', parent=body_style, textColor=colors.HexColor('#16A34A'))), Paragraph(f"- Rs. {coupon_discount:,.2f}", ParagraphStyle('TRG', parent=body_style, alignment=TA_RIGHT, textColor=colors.HexColor('#16A34A')))])
    
    net_sub = max(0.0, subtotal - coupon_discount)
    taxable_amt = net_sub
    if enable_gst and tax_rate > 0:
        if price_includes_gst:
            taxable_amt = round(grand_total / (1.0 + (tax_rate / 100.0)), 2)
        totals_data.append([Paragraph("Taxable Amount:", body_style), Paragraph(f"Rs. {taxable_amt:,.2f}", ParagraphStyle('TR', parent=body_style, alignment=TA_RIGHT))])
        mode_label = "(Inclusive)" if price_includes_gst else "(Exclusive)"
        totals_data.append([Paragraph(f"GST ({tax_rate}% {mode_label}):", body_style), Paragraph(f"Rs. {tax_amount:,.2f}", ParagraphStyle('TR', parent=body_style, alignment=TA_RIGHT))])

    if advance_paid > 0:
        totals_data.append([Paragraph("Advance Paid:", ParagraphStyle('TB', parent=body_style, textColor=colors.HexColor('#16A34A'))), Paragraph(f"- Rs. {advance_paid:,.2f}", ParagraphStyle('TRG', parent=body_style, alignment=TA_RIGHT, textColor=colors.HexColor('#16A34A')))])

    final_due = max(0.0, grand_total - advance_paid)
    totals_data.append([Paragraph("<b>Grand Total:</b>", body_bold), Paragraph(f"<b>Rs. {final_due:,.2f}</b>", ParagraphStyle('TRBold', parent=body_bold, alignment=TA_RIGHT, textColor=colors.HexColor('#4F46E5')))])

    totals_table = Table(totals_data, colWidths=[140, 100])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
    ]))

    loyalty_para = Paragraph(
        f"<b>LOYALTY REWARD SUMMARY</b><br/>"
        f"Points Earned Today: <font color='#16A34A'><b>+{points_earned} pts</b></font><br/>"
        f"Current Loyalty Balance: <b>{loyalty_balance} pts</b>",
        ParagraphStyle('LoyaltyBox', parent=body_style, fontSize=8.5, leading=12)
    )

    loyalty_table = Table([[loyalty_para]], colWidths=[260])
    loyalty_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor('#ECFDF5')),
        ('BOX', (0,0), (0,0), 0.5, colors.HexColor('#A7F3D0')),
        ('PADDING', (0,0), (0,0), 10),
    ]))

    combined_totals_table = Table([[loyalty_table, totals_table]], colWidths=[270, 250])
    combined_totals_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(combined_totals_table)
    elements.append(Spacer(1, 24))

    # 5. Footer & Thank you message
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB'), spaceBefore=2, spaceAfter=12))
    footer_para = Paragraph(
        f"<b>{thank_you_msg}</b><br/>"
        f"<font color='#9CA3AF'>This is an official computer-generated invoice for {business_name}. No physical signature is required.</font>",
        ParagraphStyle('FooterText', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=11, alignment=TA_CENTER, textColor=colors.HexColor('#6B7280'))
    )
    elements.append(footer_para)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


class SalonInvoicePdfService:

    def __init__(self, db: Session):
        self.db = db

    def generate_pdf_for_visit(self, current_user: User, visit_id_str: str) -> tuple[bytes, str]:
        # 1. Try fetching Visit by UUID or latest visit
        visit = None
        parsed_uuid = None
        try:
            parsed_uuid = UUID(str(visit_id_str).strip())
        except Exception:
            parsed_uuid = None

        if parsed_uuid:
            visit_stmt = (
                select(Visit)
                .options(joinedload(Visit.services).joinedload(VisitService.service), joinedload(Visit.customer))
                .where(Visit.id == parsed_uuid, Visit.business_id == current_user.business_id)
            )
            visit = self.db.scalar(visit_stmt)

        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found for invoice PDF generation.",
            )

        # 2. Fetch Business & BusinessSettings
        biz = self.db.get(Business, current_user.business_id)
        settings_stmt = select(BusinessSettings).where(BusinessSettings.business_id == current_user.business_id)
        settings = self.db.scalar(settings_stmt)

        biz_name = biz.name if (biz and biz.name) else "Salon Business"
        biz_address = (biz.address if biz and biz.address else None) or (
            f"{settings.city}, {settings.state}" if settings and (settings.city or settings.state) else "Main Salon Address"
        )
        biz_phone = (biz.phone if biz and biz.phone else None) or (settings.whatsapp_number if settings else "N/A")
        biz_email = (biz.email if biz and biz.email else None) or "contact@salon.com"
        gst_num = settings.gst_number if settings else None
        tax_pct = settings.tax_percentage if settings else 0.0
        invoice_footer = (settings.invoice_footer if settings and settings.invoice_footer else None) or f"Thank you for visiting {biz_name}! We look forward to seeing you again soon."

        # 3. Extract Customer Info
        customer = visit.customer
        c_name = customer.name if (customer and customer.name) else "Valued Client"
        c_phone = customer.phone if (customer and customer.phone) else "—"
        c_email = customer.email if (customer and customer.email) else "—"

        # 4. Extract Services Info
        services_list = []
        if visit.services:
            for vs in visit.services:
                s_name = vs.service.name if (vs.service and vs.service.name) else "Salon Service"
                s_dur = vs.service.duration_minutes if (vs.service and vs.service.duration_minutes) else 30
                services_list.append({
                    "name": s_name,
                    "duration": s_dur,
                    "price": vs.total_price or vs.unit_price or 0.0,
                })
        else:
            services_list.append({"name": "Salon Service", "duration": 30, "price": visit.total_amount or visit.subtotal or 0.0})

        # 5. Extract Financials
        subtotal = visit.subtotal if visit.subtotal > 0 else (visit.total_amount if visit.total_amount > 0 else sum(s["price"] for s in services_list))
        tax_amount = round((subtotal * max(0.0, tax_pct)) / 100.0, 2)
        grand_total = visit.total_amount if visit.total_amount > 0 else (subtotal + tax_amount)
        advance_paid = 0.0
        if visit.notes:
            match = re.search(r"Advance Paid:\s*₹?\s*(\d+(?:\.\d+)?)", visit.notes, re.IGNORECASE)
            if match:
                advance_paid = float(match.group(1))

        remaining_balance = max(0.0, grand_total - advance_paid)

        # 6. Extract Loyalty
        pts_earned = int(grand_total // 10)
        loyalty_balance = customer.loyalty_points if customer else pts_earned

        raw_id_clean = str(visit.id).replace("-", "").upper()[:8]
        invoice_num = f"INV-{raw_id_clean}"
        appt_code = f"APP-{raw_id_clean[:5]}"
        date_str = visit.started_at.strftime("%Y-%m-%d %H:%M") if visit.started_at else datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        pay_status = "PAID" if (visit.payment_status and visit.payment_status.value == "PAID") or (visit.status and visit.status.value == "COMPLETED") else "PAID"
        pay_method = visit.payment_method.value if visit.payment_method else "UPI"

        enable_gst = settings.enable_gst if settings else True
        price_includes_gst = settings.price_includes_gst if settings else False
        coupon_disc = float(visit.discount or 0.0)

        pdf_bytes = generate_salon_invoice_pdf_bytes(
            business_name=biz_name,
            business_address=biz_address,
            business_phone=biz_phone,
            business_email=biz_email,
            gst_number=gst_num,
            invoice_number=invoice_num,
            appointment_code=appt_code,
            date_str=date_str,
            payment_status=pay_status,
            payment_method=pay_method,
            customer_name=c_name,
            customer_phone=c_phone,
            customer_email=c_email,
            services=services_list,
            subtotal=subtotal,
            tax_rate=tax_pct if enable_gst else 0.0,
            tax_amount=tax_amount if enable_gst else 0.0,
            advance_paid=advance_paid,
            grand_total=grand_total,
            remaining_balance=remaining_balance,
            points_earned=pts_earned,
            loyalty_balance=loyalty_balance,
            thank_you_msg=invoice_footer,
            coupon_discount=coupon_disc,
            enable_gst=enable_gst,
            price_includes_gst=price_includes_gst,
        )

        filename = f"Invoice_{invoice_num}.pdf"
        return pdf_bytes, filename


from reportlab.lib.pagesizes import landscape
from reportlab.pdfgen import canvas

class CustomerExportNumberedCanvas(canvas.Canvas):
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
        page_width, page_height = landscape(A4)
        margin = 36

        # Top Accent Line
        self.setStrokeColor(colors.HexColor("#4F46E5"))
        self.setLineWidth(3)
        self.line(0, page_height - 3, page_width, page_height - 3)

        # Footer Divider Line
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.75)
        self.line(margin, 34, page_width - margin, 34)

        # Footer Text
        font_name = "Helvetica"
        self.setFont(font_name, 8)
        self.setFillColor(colors.HexColor("#6B7280"))

        now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
        self.drawString(margin, 20, f"NextVisit CRM  |  Customer Intelligence Report  |  Generated: {now_str}")
        self.drawRightString(page_width - margin, 20, f"Page {self._pageNumber} of {page_count}  |  Powered by NextVisit CRM")

        self.restoreState()


def generate_customer_export_pdf_bytes(
    business_name: str,
    business_type_name: str,
    business_address: str | None,
    business_phone: str | None,
    business_email: str | None,
    logo_url: str | None,
    search_query: str | None,
    filter_segment: str | None,
    sort_order: str | None,
    customers: list[dict],
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=48,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "PDFDocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1E293B"),
    )
    subtitle_style = ParagraphStyle(
        "PDFDocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748B"),
    )
    badge_style = ParagraphStyle(
        "PDFBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#4F46E5"),
    )
    th_style = ParagraphStyle(
        "PDFTH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    td_style = ParagraphStyle(
        "PDFTD",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#334155"),
    )
    td_center = ParagraphStyle(
        "PDFTDCenter",
        parent=td_style,
        alignment=TA_CENTER,
    )
    td_right = ParagraphStyle(
        "PDFTDRight",
        parent=td_style,
        alignment=TA_RIGHT,
    )
    td_bold = ParagraphStyle(
        "PDFTDBold",
        parent=td_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0F172A"),
    )

    elements = []

    # 1. Header (Business Info + Report Title)
    header_text = f"<b>{business_name}</b> ({business_type_name})"
    sub_lines = []
    if business_address:
        sub_lines.append(business_address)
    if business_phone or business_email:
        sub_lines.append(" | ".join(filter(None, [business_phone, business_email])))
    contact_text = "<br/>".join(sub_lines) if sub_lines else "NextVisit CRM Customer Directory"

    header_table_data = [
        [
            Paragraph(f"<font size=16 color='#4F46E5'><b>{header_text}</b></font><br/><font size=8 color='#64748B'>{contact_text}</font>", title_style),
            Paragraph("CUSTOMER PERFORMANCE REPORT<br/><font size=8 color='#64748B'>Executive Customer Directory</font>", badge_style),
        ]
    ]
    header_table = Table(header_table_data, colWidths=[520, 250])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=10))

    # 2. Applied Filters & Summary Cards
    total_cust = len(customers)
    total_spend = sum(c.get("total_spent", 0.0) for c in customers)
    total_visits = sum(c.get("visit_count", 0) for c in customers)
    vip_count = sum(1 for c in customers if c.get("is_vip", False))

    search_txt = search_query if search_query else "All"
    filter_txt = filter_segment if filter_segment else "All"
    sort_txt = sort_order if sort_order else "Newest"

    summary_html = f"""
    <b>Total Customers:</b> {total_cust:,} &nbsp;|&nbsp; 
    <b>Total Revenue:</b> ₹{total_spend:,.2f} &nbsp;|&nbsp; 
    <b>Total Visits:</b> {total_visits:,} &nbsp;|&nbsp; 
    <b>VIP Customers:</b> {vip_count:,}<br/>
    <font color='#64748B'>Applied Filters &nbsp;&bull;&nbsp; Search: "{search_txt}" &nbsp;|&nbsp; Segment: {filter_txt} &nbsp;|&nbsp; Sorting: {sort_txt}</font>
    """
    summary_p = Paragraph(summary_html, subtitle_style)

    summary_box = Table([[summary_p]], colWidths=[770])
    summary_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(summary_box)
    elements.append(Spacer(1, 10))

    # 3. Customers Table
    # Col Widths: # (25), Name (130), Phone (85), Email (130), Gender (45), VIP (35), Points (45), Visits (40), Spend (85), Last Visit (85), Created (65) -> Total: 770
    table_headers = [
        Paragraph("#", th_style),
        Paragraph("Customer Name", th_style),
        Paragraph("Phone", th_style),
        Paragraph("Email", th_style),
        Paragraph("Gender", th_style),
        Paragraph("VIP", th_style),
        Paragraph("Points", th_style),
        Paragraph("Visits", th_style),
        Paragraph("Total Spend", th_style),
        Paragraph("Last Visit", th_style),
    ]

    table_rows = [table_headers]

    for idx, c in enumerate(customers, start=1):
        vip_tag = "<font color='#16A34A'><b>YES</b></font>" if c.get("is_vip") else "NO"
        row_cells = [
            Paragraph(str(idx), td_center),
            Paragraph(c.get("name", "Guest"), td_bold),
            Paragraph(c.get("phone", "—"), td_center),
            Paragraph(c.get("email") or "—", td_style),
            Paragraph(c.get("gender") or "—", td_center),
            Paragraph(vip_tag, td_center),
            Paragraph(str(c.get("loyalty_points", 0)), td_right),
            Paragraph(str(c.get("visit_count", 0)), td_right),
            Paragraph(f"₹{c.get('total_spent', 0.0):,.2f}", td_right),
            Paragraph(c.get("last_visit_at") or "Never", td_center),
        ]
        table_rows.append(row_cells)

    cust_table = Table(table_rows, colWidths=[25, 140, 85, 140, 45, 35, 45, 40, 95, 120], repeatRows=1)

    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]

    for r_i in range(1, len(table_rows)):
        if r_i % 2 == 0:
            t_style.append(("BACKGROUND", (0, r_i), (-1, r_i), colors.HexColor("#F8FAFC")))

    cust_table.setStyle(TableStyle(t_style))
    elements.append(cust_table)

    doc.build(elements, canvasmaker=CustomerExportNumberedCanvas)
    return buffer.getvalue()


def generate_catalog_export_pdf_bytes(
    business_name: str,
    business_type_name: str,
    catalog_title: str,
    items: list[dict],
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=48,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CatTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#1E293B"),
    )
    subtitle_style = ParagraphStyle(
        "CatSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748B"),
    )
    badge_style = ParagraphStyle(
        "CatBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#4F46E5"),
    )
    th_style = ParagraphStyle(
        "CatTH",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    td_style = ParagraphStyle(
        "CatTD",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#334155"),
    )
    td_center = ParagraphStyle("CatTDCenter", parent=td_style, alignment=TA_CENTER)
    td_right = ParagraphStyle("CatTDRight", parent=td_style, alignment=TA_RIGHT)
    td_bold = ParagraphStyle("CatTDBold", parent=td_style, fontName="Helvetica-Bold", textColor=colors.HexColor("#0F172A"))

    elements = []

    header_table_data = [
        [
            Paragraph(f"<font size=16 color='#4F46E5'><b>{business_name}</b></font><br/><font size=8 color='#64748B'>{business_type_name} Directory</font>", title_style),
            Paragraph(f"{catalog_title.upper()}<br/><font size=8 color='#64748B'>Official Catalog</font>", badge_style),
        ]
    ]
    header_table = Table(header_table_data, colWidths=[520, 250])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=10))

    total_items = len(items)
    categories = len(set(i.get("category_name", "General") for i in items))
    available = sum(1 for i in items if i.get("is_available", True))

    summary_html = f"<b>Total Items / Services:</b> {total_items:,} &nbsp;|&nbsp; <b>Categories:</b> {categories:,} &nbsp;|&nbsp; <b>Active Available:</b> {available:,}"
    summary_p = Paragraph(summary_html, subtitle_style)

    summary_box = Table([[summary_p]], colWidths=[770])
    summary_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_box)
    elements.append(Spacer(1, 10))

    table_headers = [
        Paragraph("#", th_style),
        Paragraph("Category", th_style),
        Paragraph("Item / Service Name", th_style),
        Paragraph("Price (₹)", th_style),
        Paragraph("Status", th_style),
    ]

    table_rows = [table_headers]

    for idx, it in enumerate(items, start=1):
        avail_str = "<font color='#16A34A'><b>Available</b></font>" if it.get("is_available", True) else "<font color='#DC2626'>Unavailable</font>"
        row_cells = [
            Paragraph(str(idx), td_center),
            Paragraph(it.get("category_name") or "General", td_style),
            Paragraph(it.get("name") or "Item", td_bold),
            Paragraph(f"₹{float(it.get('price') or 0.0):,.2f}", td_right),
            Paragraph(avail_str, td_center),
        ]
        table_rows.append(row_cells)

    cat_table = Table(table_rows, colWidths=[30, 180, 320, 120, 120], repeatRows=1)
    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]

    for r_i in range(1, len(table_rows)):
        if r_i % 2 == 0:
            t_style.append(("BACKGROUND", (0, r_i), (-1, r_i), colors.HexColor("#F8FAFC")))

    cat_table.setStyle(TableStyle(t_style))
    elements.append(cat_table)

    doc.build(elements, canvasmaker=CustomerExportNumberedCanvas)
    return buffer.getvalue()
