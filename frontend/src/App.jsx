import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import CreateFamilyPage from './pages/CreateFamilyPage';
import JoinFamilyPage from './pages/JoinFamilyPage';
import FamilyHomePage from './pages/FamilyHomePage';
import GraphPage from './pages/GraphPage';
import SearchPage from './pages/SearchPage';
import PersonDetailPage from './pages/PersonDetailPage';
import AddMemoryPage from './pages/AddMemoryPage';
import PublicMemoryPage from './pages/PublicMemoryPage';

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

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/join/:invite_token" element={<JoinFamilyPage />} />
        <Route path="/memories/:memory_id/public" element={<PublicMemoryPage />} />
        
        <Route path="/create-family" element={<PrivateRoute><CreateFamilyPage /></PrivateRoute>} />
        <Route path="/family/:family_id" element={<PrivateRoute><FamilyHomePage /></PrivateRoute>} />
        <Route path="/family/:family_id/graph" element={<PrivateRoute><GraphPage /></PrivateRoute>} />
        <Route path="/family/:family_id/search" element={<PrivateRoute><SearchPage /></PrivateRoute>} />
        <Route path="/people/:person_id" element={<PrivateRoute><PersonDetailPage /></PrivateRoute>} />
        <Route path="/people/:person_id/add-memory" element={<PrivateRoute><AddMemoryPage /></PrivateRoute>} />
        
        <Route path="/family" element={<PrivateRoute><FamilyRedirect /></PrivateRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
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
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-6 bg-[#2C1810] rounded-sm flex items-center justify-center">
          <span className="font-display italic text-[28px] text-[#FAF7F2]">M</span>
        </div>
        <h1 className="font-display italic text-2xl text-[#2C1810] animate-pulse-slow">Memoir</h1>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📖</div>
        <h1 className="font-display text-4xl text-[#2C1810] mb-4">This memory is lost.</h1>
        <p className="text-[#8B7355] mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <a href="/" className="btn-primary inline-block">Go Home</a>
      </div>
    </div>
  );
}
