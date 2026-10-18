import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { Explore } from "./pages/Explore";
import { CohortDetail } from "./pages/CohortDetail";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { CoursePlayer } from "./pages/CoursePlayer";
import { InstructorHub } from "./pages/InstructorHub";
import { InstructorOnboarding } from "./pages/InstructorOnboarding";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Profile } from "./pages/Profile";
import { JoinLive } from "./pages/JoinLive";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 mins
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Discovery & Landing Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/cohorts/:slug" element={<CohortDetail />} />

                {/* Guest-only Routes (Redirects authenticated users) */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>

                {/* Learning Dashboard & Common Authenticated User Routes */}
                <Route element={<ProtectedRoute allowedRoles={["STUDENT", "INSTRUCTOR", "ADMIN"]} />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/cohorts/:cohortId/learn" element={<CoursePlayer />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/cohorts/:cohortId/join-live" element={<JoinLive />} />
                </Route>

                {/* Instructor / Admin Protected Routes */}
                <Route element={<ProtectedRoute allowedRoles={["INSTRUCTOR", "ADMIN"]} />}>
                  <Route path="/instructor" element={<InstructorHub />} />
                </Route>

                {/* Instructor / Admin Onboarding Route */}
                <Route path="/onboard/instructor" element={<InstructorOnboarding />} />

                {/* Admin Protected Routes */}
                <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;