import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ToastProvider, useAuth } from './context/AppContext';
import { PublicLayout, AppLayout } from './layouts/Layouts';
import { ProtectedRoute, RoleGuard } from './routes/guards';
import { AboutPage, CareersPage, CandidateRegisterPage, ContactPage, HomePage, LoginPage, RegisterPage } from './pages/PublicPages';

const DashboardPage = lazy(() => import('./dashboards/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const AdminDashboardPage = lazy(() => import('./dashboards/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const ModulePage = lazy(() => import('./pages/ModulePages').then((module) => ({ default: module.ModulePage })));
const AdminDirectoryPage = lazy(() => import('./pages/AdminDirectoryPage').then((module) => ({ default: module.AdminDirectoryPage })));
const CaseWorkflowPage = lazy(() => import('./pages/WorkflowPages').then((module) => ({ default: module.CaseWorkflowPage })));
const AppointmentsWorkflowPage = lazy(() => import('./pages/WorkflowPages').then((module) => ({ default: module.AppointmentsWorkflowPage })));
const DocumentsWorkflowPage = lazy(() => import('./pages/WorkflowPages').then((module) => ({ default: module.DocumentsWorkflowPage })));
const BillingWorkflowPage = lazy(() => import('./pages/WorkflowPages').then((module) => ({ default: module.BillingWorkflowPage })));
const AssignedClientsPage = lazy(() => import('./pages/WorkflowPages').then((module) => ({ default: module.AssignedClientsPage })));
const MessagesWorkflowPage = lazy(() => import('./pages/WorkflowPages').then((module) => ({ default: module.MessagesWorkflowPage })));
const EmployeeManagementPage = lazy(() => import('./pages/PeopleOpsPages').then((module) => ({ default: module.EmployeeManagementPage })));
const AttendanceManagementPage = lazy(() => import('./pages/PeopleOpsPages').then((module) => ({ default: module.AttendanceManagementPage })));
const MyAttendancePage = lazy(() => import('./pages/PeopleOpsPages').then((module) => ({ default: module.MyAttendancePage })));
const LeaveManagementPage = lazy(() => import('./pages/PeopleOpsPages').then((module) => ({ default: module.LeaveManagementPage })));
const PayrollManagementPage = lazy(() => import('./pages/PeopleOpsPages').then((module) => ({ default: module.PayrollManagementPage })));
const HrDashboardPage = lazy(() => import('./pages/PeopleOpsPages').then((module) => ({ default: module.HrDashboardPage })));

function ClientsRoute() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDirectoryPage resource="clients" />;
  return user?.role === 'lawyer' ? <AssignedClientsPage /> : <ModulePage type="clients" />;
}

function DashboardRoute() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminDashboardPage />;
  if (user?.role === 'hr') return <HrDashboardPage />;
  return <DashboardPage />;
}

function AttendanceRoute() {
  const { user } = useAuth();
  if (['admin', 'hr'].includes(user?.role)) return <AttendanceManagementPage />;
  return user?.role === 'employee' ? <MyAttendancePage /> : <ModulePage type="attendance" />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<main className="app-main" aria-busy="true">Loading workspace…</main>}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/candidate-register" element={<CandidateRegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/app/:role" element={<RoleGuard />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardRoute />} />
                  <Route path="clients" element={<ClientsRoute />} />
                  <Route path="users" element={<AdminDirectoryPage resource="users" />} />
                  <Route path="employees" element={<EmployeeManagementPage />} />
                  <Route path="lawyers" element={<AdminDirectoryPage resource="lawyers" />} />
                  <Route path="cases" element={<CaseWorkflowPage />} />
                  <Route path="hearings" element={<ModulePage type="hearings" />} />
                  <Route path="appointments" element={<AppointmentsWorkflowPage />} />
                  <Route path="documents" element={<DocumentsWorkflowPage />} />
                  <Route path="messages" element={<MessagesWorkflowPage />} />
                  <Route path="billing" element={<BillingWorkflowPage />} />
                  <Route path="invoices" element={<BillingWorkflowPage />} />
                  <Route path="recruitment" element={<ModulePage type="recruitment" />} />
                  <Route path="payroll" element={<PayrollManagementPage />} />
                  <Route path="reports" element={<ModulePage type="reports" />} />
                  <Route path="attendance" element={<AttendanceRoute />} />
                  <Route path="leave" element={<LeaveManagementPage />} />
                  <Route path="tasks" element={<ModulePage type="tasks" />} />
                  <Route path="profile" element={<ModulePage type="profile" />} />
                  <Route path="settings" element={<ModulePage type="settings" />} />
                  <Route path="expenses" element={<ModulePage type="expenses" />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  );
}
