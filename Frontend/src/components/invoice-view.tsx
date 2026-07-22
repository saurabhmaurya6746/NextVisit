import { useProfile } from "@/lib/business-profile";
import { orderCode, invoiceNumber, type Order } from "@/lib/orders-store";
import { fmt } from "@/lib/currency";

export function InvoiceView({ order }: { order: Order }) {
  const profile = useProfile("restaurant");
  const gst = profile.gstEnabled;
  const d = new Date(order.createdAt);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div id="print-invoice" className="mx-auto max-w-md rounded-2xl border bg-background p-6 text-sm print:border-0 print:shadow-none">
      <div className="text-center">
        {profile.logo && <img src={profile.logo} alt="" className="mx-auto mb-2 h-12 object-contain" />}
        <p className="font-display text-xl font-semibold">{profile.name}</p>
        {profile.address && <p className="text-[11px] text-muted-foreground">{profile.address}</p>}
        {gst && profile.gstNumber && <p className="text-xs text-muted-foreground">GSTIN: {profile.gstNumber}</p>}
      </div>
      <div className="my-3 border-y py-2 text-xs">
        <div className="flex justify-between"><span>Order</span><span className="font-mono">{orderCode(order)}</span></div>
        <div className="flex justify-between"><span>Invoice</span><span className="font-mono">{invoiceNumber(order.createdAt, order.id)}</span></div>
        <div className="flex justify-between"><span>Table</span><span>{order.table}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{date}</span></div>
        <div className="flex justify-between"><span>Time</span><span>{time}</span></div>
        {order.customerName && <div className="flex justify-between"><span>Customer</span><span>{order.customerName}</span></div>}
        {order.customerPhone && <div className="flex justify-between"><span>Phone</span><span>{order.customerPhone}</span></div>}
        {order.payment && <div className="flex justify-between"><span>Payment</span><span className="capitalize">{order.payment}</span></div>}
        <div className="flex justify-between"><span>Status</span><span className="capitalize">{order.paymentStatus}</span></div>
      </div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="text-left"><th className="pb-1">Item</th><th className="pb-1 text-right">Qty</th><th className="pb-1 text-right">Price</th><th className="pb-1 text-right">Total</th></tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id}><td className="py-1">{i.name}{i.notes && <div className="text-[10px] text-muted-foreground">{i.notes}</div>}</td><td className="text-right">{i.qty}</td><td className="text-right">{fmt(i.price)}</td><td className="text-right">{fmt(i.price * i.qty)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 border-t pt-2 text-xs">
        <div className="flex justify-between"><span>Subtotal</span><span>{fmt(order.subtotal)}</span></div>
        {gst && <div className="flex justify-between"><span>GST ({profile.gstPercent}%)</span><span>{fmt(order.gst)}</span></div>}
        <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{fmt(order.total)}</span></div>
      </div>
      <p className="mt-4 text-center text-[10px] text-muted-foreground">Thank you — visit again!</p>
    </div>
  );
}