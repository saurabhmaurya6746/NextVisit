import { createFileRoute } from "@tanstack/react-router";
import { QrOrderView } from "@/components/qr-order-view";

export const Route = createFileRoute("/qr/$business/$table")({
  head: () => ({ meta: [{ title: "Order from your table — NextVisit" }, { name: "robots", content: "noindex" }] }),
  component: QrBizOrderPage,
});

function QrBizOrderPage() {
  const { table } = Route.useParams();
  // Business is encoded in the URL for per-client uniqueness. The current
  // prototype only serves one business per browser session, so the table
  // param is the sole routing key inside the view.
  return <QrOrderView table={table} />;
}