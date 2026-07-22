import { createFileRoute } from "@tanstack/react-router";
import { QrOrderView } from "@/components/qr-order-view";

export const Route = createFileRoute("/qr/$table")({
  head: () => ({ meta: [{ title: "Order from your table — NextVisit" }, { name: "robots", content: "noindex" }] }),
  component: QrOrderPage,
});

function QrOrderPage() {
  const { table } = Route.useParams();
  return <QrOrderView table={table} />;
}
