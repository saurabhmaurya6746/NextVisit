from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class GstCalculationResult:
    subtotal: float
    enable_gst: bool
    gst_percentage: float
    price_includes_gst: bool
    taxable_amount: float
    cgst_rate: float
    sgst_rate: float
    cgst_amount: float
    sgst_amount: float
    total_gst_amount: float
    total_amount: float
    gst_number: str | None = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subtotal": self.subtotal,
            "enable_gst": self.enable_gst,
            "gst_percentage": self.gst_percentage,
            "price_includes_gst": self.price_includes_gst,
            "taxable_amount": self.taxable_amount,
            "cgst_rate": self.cgst_rate,
            "sgst_rate": self.sgst_rate,
            "cgst_amount": self.cgst_amount,
            "sgst_amount": self.sgst_amount,
            "total_gst_amount": self.total_gst_amount,
            "total_amount": self.total_amount,
            "gst_number": self.gst_number,
        }


def calculate_business_gst(
    amount: float,
    enable_gst: bool = True,
    gst_percentage: float = 18.0,
    price_includes_gst: bool = False,
    gst_number: str | None = None,
) -> GstCalculationResult:
    """
    Core GST Calculation Engine supporting BOTH Inclusive & Exclusive modes per business.

    Mode 1: Price Includes GST (Inclusive)
    - Example: Service Price ₹500, GST 18%
    - total_amount = ₹500
    - taxable_amount = ₹423.73
    - total_gst_amount = ₹76.27 (CGST ₹38.14 + SGST ₹38.13)

    Mode 2: Price Excludes GST (Exclusive)
    - Example: Service Price ₹500, GST 18%
    - taxable_amount = ₹500
    - total_gst_amount = ₹90.00 (CGST ₹45.00 + SGST ₹45.00)
    - total_amount = ₹590.00
    """
    if amount < 0:
        amount = 0.0

    if not enable_gst or gst_percentage <= 0:
        return GstCalculationResult(
            subtotal=round(amount, 2),
            enable_gst=False,
            gst_percentage=0.0,
            price_includes_gst=price_includes_gst,
            taxable_amount=round(amount, 2),
            cgst_rate=0.0,
            sgst_rate=0.0,
            cgst_amount=0.0,
            sgst_amount=0.0,
            total_gst_amount=0.0,
            total_amount=round(amount, 2),
            gst_number=gst_number,
        )

    rate = round(gst_percentage, 2)
    cgst_r = round(rate / 2.0, 2)
    sgst_r = round(rate / 2.0, 2)

    if price_includes_gst:
        total_amount = round(amount, 2)
        taxable_amount = round(total_amount / (1.0 + (rate / 100.0)), 2)
        total_gst = round(total_amount - taxable_amount, 2)
        cgst_amt = round(total_gst / 2.0, 2)
        sgst_amt = round(total_gst - cgst_amt, 2)
    else:
        taxable_amount = round(amount, 2)
        total_gst = round(taxable_amount * (rate / 100.0), 2)
        cgst_amt = round(taxable_amount * (cgst_r / 100.0), 2)
        sgst_amt = round(total_gst - cgst_amt, 2)
        total_amount = round(taxable_amount + total_gst, 2)

    return GstCalculationResult(
        subtotal=round(amount, 2),
        enable_gst=True,
        gst_percentage=rate,
        price_includes_gst=price_includes_gst,
        taxable_amount=taxable_amount,
        cgst_rate=cgst_r,
        sgst_rate=sgst_r,
        cgst_amount=cgst_amt,
        sgst_amount=sgst_amt,
        total_gst_amount=total_gst,
        total_amount=total_amount,
        gst_number=gst_number,
    )


def calculate_payment_breakdown(
    subtotal: float,
    coupon_discount: float = 0.0,
    enable_gst: bool = True,
    gst_percentage: float = 18.0,
    price_includes_gst: bool = False,
    gst_number: str | None = None,
) -> Dict[str, Any]:
    """
    Calculates complete payment breakdown integrating Coupon discount and Business GST:
    Subtotal -> Apply Coupon -> Discount -> Taxable Amount -> GST -> Grand Total -> Payment
    """
    subtotal_val = max(0.0, round(subtotal, 2))
    discount_val = max(0.0, min(subtotal_val, round(coupon_discount, 2)))
    net_after_discount = round(subtotal_val - discount_val, 2)

    gst_res = calculate_business_gst(
        amount=net_after_discount,
        enable_gst=enable_gst,
        gst_percentage=gst_percentage,
        price_includes_gst=price_includes_gst,
        gst_number=gst_number,
    )

    return {
        "subtotal": subtotal_val,
        "coupon_discount": discount_val,
        "net_amount": net_after_discount,
        "enable_gst": gst_res.enable_gst,
        "gst_percentage": gst_res.gst_percentage,
        "price_includes_gst": gst_res.price_includes_gst,
        "taxable_amount": gst_res.taxable_amount,
        "cgst_rate": gst_res.cgst_rate,
        "sgst_rate": gst_res.sgst_rate,
        "cgst_amount": gst_res.cgst_amount,
        "sgst_amount": gst_res.sgst_amount,
        "total_gst_amount": gst_res.total_gst_amount,
        "grand_total": gst_res.total_amount,
        "gst_number": gst_res.gst_number,
    }
