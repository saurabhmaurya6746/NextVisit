import { createFileRoute } from "@tanstack/react-router";
import { CelebrationPage } from "@/components/celebration-page";
export const Route = createFileRoute("/app/$type/$business/anniversary-campaigns/")({ component: () => <CelebrationPage kind="anniversary" /> });