import { createFileRoute } from "@tanstack/react-router";
import { CelebrationDetailPage } from "@/components/celebration-detail-page";
export const Route = createFileRoute("/app/$type/$business/anniversary-campaigns/today")({ component: () => <CelebrationDetailPage kind="anniversary" bucket="today" /> });