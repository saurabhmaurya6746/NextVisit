import { createFileRoute } from "@tanstack/react-router";
import { CelebrationDetailPage } from "@/components/celebration-detail-page";
export const Route = createFileRoute("/app/$type/$business/birthday-campaigns/week")({ component: () => <CelebrationDetailPage kind="birthday" bucket="week" /> });