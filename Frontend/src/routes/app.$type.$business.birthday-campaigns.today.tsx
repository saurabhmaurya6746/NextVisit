import { createFileRoute } from "@/lib/route-compat";
import { CelebrationDetailPage } from "@/components/celebration-detail-page";
export const Route = createFileRoute("/app/$type/$business/birthday-campaigns/today")({ component: () => <CelebrationDetailPage kind="birthday" bucket="today" /> });