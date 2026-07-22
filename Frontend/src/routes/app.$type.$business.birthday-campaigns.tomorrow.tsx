import { createFileRoute } from "@tanstack/react-router";
import { CelebrationDetailPage } from "@/components/celebration-detail-page";
export const Route = createFileRoute("/app/$type/$business/birthday-campaigns/tomorrow")({ component: () => <CelebrationDetailPage kind="birthday" bucket="tomorrow" /> });