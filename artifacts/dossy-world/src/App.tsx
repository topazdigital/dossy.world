import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth-context";
import NotFound from "@/pages/not-found";

import GamePage from "@/pages/GamePage";
import HistoryPage from "@/pages/HistoryPage";
import OpsGatewayPage from "@/pages/OpsGatewayPage";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/DashboardPage";
import AdminUsersPage from "@/pages/admin/UsersPage";
import AdminWithdrawalsPage from "@/pages/admin/WithdrawalsPage";
import AdminBotsPage from "@/pages/admin/BotsPage";
import AdminRoundsPage from "@/pages/admin/RoundsPage";
import AdminHistoryPage from "@/pages/admin/HistoryPage";
import AdminAuditPage from "@/pages/admin/AuditPage";
import AdminSettingsPage from "@/pages/admin/SettingsPage";

const queryClient = new QueryClient();

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={GamePage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/ops-control-9f3a2b7c" component={OpsGatewayPage} />
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/users" component={() => <AdminRoute component={AdminUsersPage} />} />
      <Route path="/admin/withdrawals" component={() => <AdminRoute component={AdminWithdrawalsPage} />} />
      <Route path="/admin/bots" component={() => <AdminRoute component={AdminBotsPage} />} />
      <Route path="/admin/rounds" component={() => <AdminRoute component={AdminRoundsPage} />} />
      <Route path="/admin/history" component={() => <AdminRoute component={AdminHistoryPage} />} />
      <Route path="/admin/audit" component={() => <AdminRoute component={AdminAuditPage} />} />
      <Route path="/admin/settings" component={() => <AdminRoute component={AdminSettingsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster theme="dark" position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
