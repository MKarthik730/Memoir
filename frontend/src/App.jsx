import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LoginPage from './pages/LoginPage';
import CreateFamilyPage from './pages/CreateFamilyPage';
import JoinFamilyPage from './pages/JoinFamilyPage';
import FamilyHomePage from './pages/FamilyHomePage';
import GraphPage from './pages/GraphPage';
import SearchPage from './pages/SearchPage';
import PersonDetailPage from './pages/PersonDetailPage';
import AddMemoryPage from './pages/AddMemoryPage';
import PublicMemoryPage from './pages/PublicMemoryPage';
import SettingsPage from './pages/SettingsPage';
import AssistantPage from './pages/AssistantPage';
import FeedPage from './pages/FeedPage';
import CreatePostPage from './pages/CreatePostPage';
import VaultPage from './pages/VaultPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import { ToastProvider } from './components/ui';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('memoir_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('memoir_token');
  if (token) return <Navigate to="/family" replace />;
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
      >
        <Routes location={location}>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/join/:invite_token" element={<JoinFamilyPage />} />
          <Route path="/memories/:memory_id/public" element={<PublicMemoryPage />} />

          {/* New Instagram-style Feed */}
          <Route path="/" element={<PrivateRoute><FeedPage /></PrivateRoute>} />
          <Route path="/post/new" element={<PrivateRoute><CreatePostPage /></PrivateRoute>} />
          <Route path="/vault" element={<PrivateRoute><VaultPage /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

          {/* Legacy routes (kept for backward compat) */}
          <Route path="/create-family" element={<PrivateRoute><CreateFamilyPage /></PrivateRoute>} />
          <Route path="/family/:family_id" element={<PrivateRoute><FamilyHomePage /></PrivateRoute>} />
          <Route path="/family/:family_id/graph" element={<PrivateRoute><GraphPage /></PrivateRoute>} />
          <Route path="/family/:family_id/search" element={<PrivateRoute><SearchPage /></PrivateRoute>} />
          <Route path="/people/:person_id" element={<PrivateRoute><PersonDetailPage /></PrivateRoute>} />
          <Route path="/people/:person_id/add-memory" element={<PrivateRoute><AddMemoryPage /></PrivateRoute>} />
          <Route path="/family/:family_id/assistant" element={<PrivateRoute><AssistantPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />

          <Route path="/family" element={<PrivateRoute><FamilyRedirect /></PrivateRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AnimatedRoutes />
      </ToastProvider>
    </Router>
  );
}

function FamilyRedirect() {
  const [familyId, setFamilyId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/user/families', {
      headers: { Authorization: `Bearer ${localStorage.getItem('memoir_token')}` },
    })
      .then((r) => r.json())
      .then((families) => {
        if (Array.isArray(families) && families.length > 0) {
          setFamilyId(families[0].id);
        } else {
          window.location.href = '/create-family';
        }
      })
      .catch(() => {
        window.location.href = '/create-family';
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (familyId) return <Navigate to={`/family/${familyId}`} replace />;
  return <Navigate to="/create-family" replace />;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full border-2 border-[var(--seal)] flex items-center justify-center">
          <span className="font-display text-2xl text-[var(--seal)]">M</span>
        </div>
        <div className="animate-thread-pull w-32 h-px mx-auto mb-4" />
        <h1 className="font-display text-lg text-[var(--ink)]">Memoir</h1>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[var(--page)] flex items-center justify-center p-8">
      <div className="text-center max-w-md animate-fade-in-up">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
          <span className="font-display text-2xl text-[var(--ink-muted)]">M</span>
        </div>
        <h1 className="font-display text-2xl mb-4">Page not found</h1>
        <p className="text-[var(--ink-light)] mb-8">This page doesn't exist or has been moved.</p>
        <a href="/" className="btn btn-primary">Go Home</a>
      </div>
    </div>
  );
}
