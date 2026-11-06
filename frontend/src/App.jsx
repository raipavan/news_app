import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import RequireAuth from './components/RequireAuth';
import DashboardLayout from './components/DashboardLayout';

import Home from './pages/Home';
import Latest from './pages/Latest';
import Category from './pages/Category';
import District from './pages/District';
import SearchPage from './pages/Search';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import PolicyPage from './pages/PolicyPage';
import NotFound from './pages/NotFound';

import DashboardHome from './pages/dashboard/DashboardHome';
import MyArticles from './pages/dashboard/MyArticles';
import ArticleEditor from './pages/dashboard/ArticleEditor';
import ReviewQueue from './pages/dashboard/ReviewQueue';
import ReviewDetail from './pages/dashboard/ReviewDetail';
import Bookmarks from './pages/dashboard/Bookmarks';

import AdminDashboard from './pages/dashboard/admin/AdminDashboard';
import Users from './pages/dashboard/admin/Users';
import Taxonomy from './pages/dashboard/admin/Taxonomy';
import Ads from './pages/dashboard/admin/Ads';
import Moderation from './pages/dashboard/admin/Moderation';
import Analytics from './pages/dashboard/admin/Analytics';
import Audit from './pages/dashboard/admin/Audit';

import { useAuth } from './context/AuthContext';

function WriterRoute({ children }) {
  const { hasPermission, isStaff } = useAuth();
  if (!isStaff && !hasPermission('article.create')) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="latest" element={<Latest />} />
        <Route path="category/:slug" element={<Category />} />
        <Route path="district/:slug" element={<District />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path=":policy" element={<PolicyPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route
        path="dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route
          path="articles"
          element={
            <WriterRoute>
              <MyArticles />
            </WriterRoute>
          }
        />
        <Route
          path="articles/new"
          element={
            <WriterRoute>
              <ArticleEditor />
            </WriterRoute>
          }
        />
        <Route
          path="articles/:id"
          element={
            <WriterRoute>
              <ArticleEditor />
            </WriterRoute>
          }
        />
        <Route path="bookmarks" element={<Bookmarks />} />

        <Route path="review" element={<RequireAuth staff><ReviewQueue /></RequireAuth>} />
        <Route path="review/:id" element={<RequireAuth staff><ReviewDetail /></RequireAuth>} />

        <Route path="admin" element={<RequireAuth staff><Outlet /></RequireAuth>}>
          <Route index element={<RequireAuth admin><AdminDashboard /></RequireAuth>} />
          <Route path="users" element={<RequireAuth admin><Users /></RequireAuth>} />
          <Route path="taxonomy" element={<RequireAuth admin><Taxonomy /></RequireAuth>} />
          <Route path="ads" element={<RequireAuth admin><Ads /></RequireAuth>} />
          <Route path="moderation" element={<Moderation />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="audit" element={<RequireAuth admin><Audit /></RequireAuth>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
