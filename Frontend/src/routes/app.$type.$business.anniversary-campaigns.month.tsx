import { createFileRoute } from "@/lib/route-compat";
import { CelebrationDetailPage } from "@/components/celebration-detail-page";
export const Route = createFileRoute("/app/$type/$business/anniversary-campaigns/month")({ component: () => <CelebrationDetailPage kind="anniversary" bucket="month" /> });