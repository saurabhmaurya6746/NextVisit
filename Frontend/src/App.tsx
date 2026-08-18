import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "sonner";

// Layouts
import { AdminLayout } from "./routes/admin";
import { AppLayout } from "./routes/app.$type.$business";

// Public & Auth Pages
import LandingPage from "./routes/index";
import FeaturesPage from "./routes/features";
import PricingPage from "./routes/pricing";
import UseCasesPage from "./routes/use-cases";
import DocsPage from "./routes/docs";
import TermsPage from "./routes/terms";
import LoginIndexPage from "./routes/login.index";
import LoginBusinessPage from "./routes/login.business";
import LoginAdminPage from "./routes/login.admin";
import SignupPage from "./routes/signup";
import QrBusinessTablePage from "./routes/qr.$business.$table";
import QrTablePage from "./routes/qr.$table";

// Admin Pages
import AdminDashboardPage from "./routes/admin.index";
import AdminClientsPage from "./routes/admin.clients.index";
import AdminClientDetailPage from "./routes/admin.clients.$id";
import AdminApprovalsPage from "./routes/admin.approvals";
import AdminCreditsPage from "./routes/admin.credits";
import AdminSubscriptionsPage from "./routes/admin.subscriptions";
import AdminMonitoringPage from "./routes/admin.monitoring";
import AdminSettingsPage from "./routes/admin.settings";

// Business App Pages
import { AppIndexPage } from "./routes/app.index";
import AppDashboardPage from "./routes/app.$type.$business.dashboard";
import AppWelcomePage from "./routes/app.$type.$business.welcome";
import AppSetupPage from "./routes/app.$type.$business.setup";
import AppMenuPage from "./routes/app.$type.$business.menu";
import AppTablesPage from "./routes/app.$type.$business.tables";
import AppOrdersIndexPage from "./routes/app.$type.$business.orders.index";
import AppOrderDetailPage from "./routes/app.$type.$business.orders.$id";
import AppServicesPage from "./routes/app.$type.$business.services";
import AppAppointmentsPage from "./routes/app.$type.$business.appointments";
import AppCalendarPage from "./routes/app.$type.$business.calendar";
import AppWorkstationsPage from "./routes/app.$type.$business.workstations";
import AppCustomersIndexPage from "./routes/app.$type.$business.customers.index";
import AppCustomerDetailPage from "./routes/app.$type.$business.customers.$id";
import AppLoyaltyPage from "./routes/app.$type.$business.loyalty";
import AppCouponsPage from "./routes/app.$type.$business.coupons";
import AppWhatsappCampaignsPage from "./routes/app.$type.$business.whatsapp-campaigns";
import AppWhatsappHistoryPage from "./routes/app.$type.$business.whatsapp-history";
import AppFestivalCampaignsPage from "./routes/app.$type.$business.festival-campaigns";

// Celebration Pages
import CelebrationPage from "./components/celebration-page";
import CelebrationDetailPage from "./components/celebration-detail-page";

import AppCustomerRecoveryPage from "./routes/app.$type.$business.customer-recovery";
import AppCustomerRecoveryDaysPage from "./routes/app.$type.$business.customer-recovery.$days";
import AppReviewBoosterPage from "./routes/app.$type.$business.review-booster";
import AppReportsPage from "./routes/app.$type.$business.reports";
import AppRevenuePage from "./routes/app.$type.$business.revenue";
import AppVipPage from "./routes/app.$type.$business.vip";
import AppMarketingPage from "./routes/app.$type.$business.marketing";
import AppBookingsPage from "./routes/app.$type.$business.bookings";
import AppTeamPage from "./routes/app.$type.$business.team";
import AppTemplatesPage from "./routes/app.$type.$business.templates";
import AppSubscriptionPage from "./routes/app.$type.$business.subscription";
import AppSettingsPage from "./routes/app.$type.$business.settings";

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Marketing Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/use-cases" element={<UseCasesPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/terms-and-conditions" element={<TermsPage />} />

            {/* Auth Routes */}
            <Route path="/login" element={<LoginIndexPage />} />
            <Route path="/login/business" element={<LoginBusinessPage />} />
            <Route path="/login/admin" element={<LoginAdminPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Public Customer QR Routes */}
            <Route path="/qr/:business/:table" element={<QrBusinessTablePage />} />
            <Route path="/qr/:table" element={<QrTablePage />} />
            <Route path="/restaurant/qr/:business/:table" element={<QrBusinessTablePage />} />
            <Route path="/restaurant/qr/:table" element={<QrTablePage />} />

            {/* Admin Console Subtree */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="clients" element={<AdminClientsPage />} />
              <Route path="clients/:id" element={<AdminClientDetailPage />} />
              <Route path="approvals" element={<AdminApprovalsPage />} />
              <Route path="credits" element={<AdminCreditsPage />} />
              <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
              <Route path="monitoring" element={<AdminMonitoringPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>

            {/* Business Scope App Root */}
            <Route path="/app" element={<AppIndexPage />} />

            {/* Business App Subtree */}
            <Route path="/app/:type/:business" element={<AppLayout />}>
              <Route index element={<AppDashboardPage />} />
              <Route path="welcome" element={<AppWelcomePage />} />
              <Route path="dashboard" element={<AppDashboardPage />} />
              <Route path="setup" element={<AppSetupPage />} />
              <Route path="menu" element={<AppMenuPage />} />
              <Route path="tables" element={<AppTablesPage />} />
              <Route path="orders" element={<AppOrdersIndexPage />} />
              <Route path="orders/:id" element={<AppOrderDetailPage />} />
              <Route path="services" element={<AppServicesPage />} />
              <Route path="appointments" element={<AppAppointmentsPage />} />
              <Route path="calendar" element={<AppCalendarPage />} />
              <Route path="workstations" element={<AppWorkstationsPage />} />
              <Route path="customers" element={<AppCustomersIndexPage />} />
              <Route path="customers/:id" element={<AppCustomerDetailPage />} />
              <Route path="loyalty" element={<AppLoyaltyPage />} />
              <Route path="coupons" element={<AppCouponsPage />} />
              <Route path="whatsapp-campaigns" element={<AppWhatsappCampaignsPage />} />
              <Route path="whatsapp-history" element={<AppWhatsappHistoryPage />} />
              <Route path="festival-campaigns" element={<AppFestivalCampaignsPage />} />

              {/* Birthday Campaigns */}
              <Route path="birthday-campaigns" element={<CelebrationPage kind="birthday" />} />
              <Route path="birthday-campaigns/today" element={<CelebrationDetailPage kind="birthday" bucket="today" />} />
              <Route path="birthday-campaigns/tomorrow" element={<CelebrationDetailPage kind="birthday" bucket="tomorrow" />} />
              <Route path="birthday-campaigns/week" element={<CelebrationDetailPage kind="birthday" bucket="week" />} />
              <Route path="birthday-campaigns/month" element={<CelebrationDetailPage kind="birthday" bucket="month" />} />

              {/* Anniversary Campaigns */}
              <Route path="anniversary-campaigns" element={<CelebrationPage kind="anniversary" />} />
              <Route path="anniversary-campaigns/today" element={<CelebrationDetailPage kind="anniversary" bucket="today" />} />
              <Route path="anniversary-campaigns/tomorrow" element={<CelebrationDetailPage kind="anniversary" bucket="tomorrow" />} />
              <Route path="anniversary-campaigns/week" element={<CelebrationDetailPage kind="anniversary" bucket="week" />} />
              <Route path="anniversary-campaigns/month" element={<CelebrationDetailPage kind="anniversary" bucket="month" />} />

              <Route path="customer-recovery" element={<AppCustomerRecoveryPage />} />
              <Route path="customer-recovery/:days" element={<AppCustomerRecoveryDaysPage />} />
              <Route path="review-booster" element={<AppReviewBoosterPage />} />
              <Route path="reports" element={<AppReportsPage />} />
              <Route path="revenue" element={<AppRevenuePage />} />
              <Route path="vip" element={<AppVipPage />} />
              <Route path="marketing" element={<AppMarketingPage />} />
              <Route path="bookings" element={<AppBookingsPage />} />
              <Route path="team" element={<AppTeamPage />} />
              <Route path="templates" element={<AppTemplatesPage />} />
              <Route path="subscription" element={<AppSubscriptionPage />} />
              <Route path="settings" element={<AppSettingsPage />} />
            </Route>

            {/* 404 Catch-All */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
