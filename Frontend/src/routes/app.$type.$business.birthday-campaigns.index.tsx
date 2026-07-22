import { createFileRoute } from "@tanstack/react-router";
import { CelebrationPage } from "@/components/celebration-page";
export const Route = createFileRoute("/app/$type/$business/birthday-campaigns/")({ component: () => <CelebrationPage kind="birthday" /> });