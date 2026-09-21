import { useParams } from "react-router-dom";
import { QrOrderView } from "@/components/qr-order-view";

export default function QrBizOrderPage() {
  const { business, table } = useParams<{ business?: string; table?: string }>();
  return <QrOrderView table={table} business={business} />;
}