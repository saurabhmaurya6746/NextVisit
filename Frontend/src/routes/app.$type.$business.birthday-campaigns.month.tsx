import { createFileRoute } from "@tanstack/react-router";
import { CelebrationDetailPage } from "@/components/celebration-detail-page";
export const Route = createFileRoute("/app/$type/$business/birthday-campaigns/month")({ component: () => <CelebrationDetailPage kind="birthday" bucket="month" /> });