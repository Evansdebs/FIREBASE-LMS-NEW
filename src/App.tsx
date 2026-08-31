import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingProvider } from "@/lib/branding-context";
import { ThemeProvider } from "@/components/theme-provider";
import Login from "./pages/Login";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import UserManagement from "./pages/dashboard/UserManagement";
import PermissionsPage from "./pages/dashboard/PermissionsPage";
import CoursesPage from "./pages/dashboard/CoursesPage";
import AssignmentsPage from "./pages/dashboard/AssignmentsPage";
import LiveClassesPage from "./pages/dashboard/LiveClassesPage";
import CalendarPage from "./pages/dashboard/CalendarPage";
import StudyRoomPage from "./pages/dashboard/StudyRoomPage";
import AnalyticsPage from "./pages/dashboard/AnalyticsPage";
import MessagesPage from "./pages/dashboard/MessagesPage";
import AuditLogsPage from "./pages/dashboard/AuditLogsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import QuizzesPage from "./pages/dashboard/QuizzesPage";
import GradebookPage from "./pages/dashboard/GradebookPage";
import ResourceLibraryPage from "./pages/dashboard/ResourceLibraryPage";
import AnnouncementsPage from "./pages/dashboard/AnnouncementsPage";
import ParticipationPage from "./pages/dashboard/ParticipationPage";
import AcademicPage from "./pages/dashboard/AcademicPage";
import NotesPage from "./pages/dashboard/NotesPage";
import ShopPage from "./pages/dashboard/ShopPage";
import ForumPage from "./pages/dashboard/ForumPage";
import SimulationsPage from "./pages/dashboard/SimulationsPage";
import AITutorPage from "./pages/dashboard/AITutorPage";
import DeveloperInfo from "./components/dashboard/DeveloperInfo";
import ChangePassword from "./pages/auth/ChangePassword";
import MySubjectPage from "./pages/dashboard/MySubjectPage";
import SubjectOverviewPage from "./pages/dashboard/SubjectOverviewPage";
import TimetablePage from "./pages/dashboard/TimetablePage";
import WhiteboardPage from "./pages/dashboard/WhiteboardPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
    <QueryClientProvider client={queryClient}>
    <BrandingProvider>
      <AuthProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardHome />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="permissions" element={<PermissionsPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="my-subject" element={<MySubjectPage />} />
              <Route path="subject-hub" element={<SubjectOverviewPage />} />
              <Route path="assignments" element={<AssignmentsPage />} />
              <Route path="academic" element={<AcademicPage />} />
              <Route path="quizzes" element={<QuizzesPage />} />
              <Route path="gradebook" element={<GradebookPage />} />
              <Route path="live-classes" element={<LiveClassesPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="whiteboard" element={<WhiteboardPage />} />
              <Route path="study-room" element={<StudyRoomPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="resources" element={<ResourceLibraryPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="participation" element={<ParticipationPage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="forums" element={<ForumPage />} />
              <Route path="simulations" element={<SimulationsPage />} />
              <Route path="ai-tutor" element={<AITutorPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="developer" element={<DeveloperInfo />} />
            </Route>
            <Route path="/auth/change-password" element={<ChangePassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </BrandingProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
