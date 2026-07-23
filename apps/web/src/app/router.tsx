import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";

import { ProtectedRoute } from "../routes/protected-route";
import { PublicOnlyRoute } from "../routes/public-only-route";
import { RootRoute } from "../routes/root-route";
import { RoleRoute } from "../routes/role-route";

const LoginPage = lazy(() =>
  import("../features/auth/pages/login-page").then((module) => ({
    default: module.LoginPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../features/auth/pages/register-page").then((module) => ({
    default: module.RegisterPage,
  })),
);
const AuthLayout = lazy(() =>
  import("../layouts/auth-layout").then((module) => ({
    default: module.AuthLayout,
  })),
);
const DashboardLayout = lazy(() =>
  import("../layouts/dashboard-layout").then((module) => ({
    default: module.DashboardLayout,
  })),
);
const AdminLayout = lazy(() =>
  import("../layouts/admin-layout").then((module) => ({
    default: module.AdminLayout,
  })),
);
const AdminOverviewPage = lazy(() =>
  import("../features/admin/pages/admin-overview-page").then((module) => ({
    default: module.AdminOverviewPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import("../features/admin/pages/admin-users-page").then((module) => ({
    default: module.AdminUsersPage,
  })),
);
const AdminUserDetailPage = lazy(() =>
  import("../features/admin/pages/admin-user-detail-page").then((module) => ({
    default: module.AdminUserDetailPage,
  })),
);
const AdminJobsPage = lazy(() =>
  import("../features/admin/pages/admin-jobs-page").then((module) => ({
    default: module.AdminJobsPage,
  })),
);
const AdminJobDetailPage = lazy(() =>
  import("../features/admin/pages/admin-job-detail-page").then((module) => ({
    default: module.AdminJobDetailPage,
  })),
);
const AdminAuditLogsPage = lazy(() =>
  import("../features/admin/pages/admin-audit-logs-page").then((module) => ({
    default: module.AdminAuditLogsPage,
  })),
);
const AdminSourcesPage = lazy(() =>
  import("../features/admin/pages/admin-sources-page").then((module) => ({
    default: module.AdminSourcesPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../pages/dashboard-page").then((module) => ({
    default: module.DashboardPage,
  })),
);
const JobHistoryPage = lazy(() =>
  import("../features/scraping-jobs/pages/job-history-page").then(
    (module) => ({
      default: module.JobHistoryPage,
    }),
  ),
);
const CreateJobPage = lazy(() =>
  import("../features/scraping-jobs/pages/create-job-page").then((module) => ({
    default: module.CreateJobPage,
  })),
);
const JobDetailPage = lazy(() =>
  import("../features/scraping-jobs/pages/job-detail-page").then((module) => ({
    default: module.JobDetailPage,
  })),
);
const LeadExplorerPage = lazy(() =>
  import("../features/leads/pages/lead-explorer-page").then((module) => ({
    default: module.LeadExplorerPage,
  })),
);
const LeadDetailPage = lazy(() =>
  import("../features/leads/pages/lead-detail-page").then((module) => ({
    default: module.LeadDetailPage,
  })),
);
const CsvImportPage = lazy(() =>
  import("../features/imports/pages/csv-import-page").then((module) => ({
    default: module.CsvImportPage,
  })),
);
const ComingSoonPage = lazy(() =>
  import("../pages/coming-soon-page").then((module) => ({
    default: module.ComingSoonPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("../pages/not-found-page").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const UnauthorizedPage = lazy(() =>
  import("../pages/unauthorized-page").then((module) => ({
    default: module.UnauthorizedPage,
  })),
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRoute />,
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: "/login",
            element: <LoginPage />,
          },
          {
            path: "/register",
            element: <RegisterPage />,
          },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: "jobs",
            element: <JobHistoryPage />,
          },
          {
            path: "jobs/new",
            element: <CreateJobPage />,
          },
          {
            path: "jobs/:jobId",
            element: <JobDetailPage />,
          },
          {
            path: "leads",
            element: <LeadExplorerPage />,
          },
          {
            path: "leads/:leadId",
            element: <LeadDetailPage />,
          },
          {
            path: "imports/csv",
            element: <CsvImportPage />,
          },
          {
            path: "settings",
            element: (
              <ComingSoonPage
                description="Profile editing and account preferences are outside Phase 6."
                showLogoutAll
                title="Settings"
              />
            ),
          },
        ],
      },
      {
        element: <RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]} />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminOverviewPage /> },
              { path: "users", element: <AdminUsersPage /> },
              { path: "users/:userId", element: <AdminUserDetailPage /> },
              { path: "jobs", element: <AdminJobsPage /> },
              { path: "jobs/:jobId", element: <AdminJobDetailPage /> },
              { path: "audit-logs", element: <AdminAuditLogsPage /> },
              { path: "sources", element: <AdminSourcesPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "/unauthorized",
    element: <UnauthorizedPage />,
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
