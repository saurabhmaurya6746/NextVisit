import { useParams } from "react-router-dom";
import { QrOrderView } from "@/components/qr-order-view";

export default function QrOrderPage() {
  const { table } = useParams<{ table?: string }>();
  return <QrOrderView table={table} />;
}
