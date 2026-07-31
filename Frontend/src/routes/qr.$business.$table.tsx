import { createFileRoute } from "@tanstack/react-router";
import { QrOrderView } from "@/components/qr-order-view";

export const Route = createFileRoute("/qr/$business/$table")({
  head: () => ({ meta: [{ title: "Order from your table — NextVisit" }, { name: "robots", content: "noindex" }] }),
  component: QrBizOrderPage,
});

function QrBizOrderPage() {
  const { business, table } = Route.useParams();
  return <QrOrderView table={table} business={business} />;
}