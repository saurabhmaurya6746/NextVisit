import { createFileRoute } from "@/lib/route-compat";
import { CelebrationPage } from "@/components/celebration-page";
export const Route = createFileRoute("/app/$type/$business/birthday-campaigns/")({ component: () => <CelebrationPage kind="birthday" /> });