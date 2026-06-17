import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { familyAPI } from '../lib/api';

export default function JoinFamilyPage() {
  const { invite_token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('joining');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('memoir_token');
    if (!token) {
      navigate(`/login?redirect=/join/${invite_token}`);
      return;
    }

    const joinFamily = async () => {
      try {
        const family = await familyAPI.join(invite_token);
        navigate(`/family/${family.id}`);
      } catch (err) {
        if (err.response?.status === 400) {
          try {
            const families = await familyAPI.getMyFamilies();
            const found = families.find(f => f.invite_token === invite_token);
            if (found) {
              navigate(`/family/${found.id}`);
              return;
            }
          } catch {}
          navigate('/family');
        } else {
          setError(err.response?.data?.detail || 'Invalid invite link');
          setStatus('error');
        }
      }
    };

    joinFamily();
  }, [invite_token, navigate]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-6 bg-[var(--accent)] rounded-[var(--radius-sm)] flex items-center justify-center">
            <span className="font-display italic text-[28px] text-white">M</span>
          </div>
          <h1 className="font-display text-3xl mb-4">Invalid Invite</h1>
          <p className="text-[var(--text-secondary)] mb-8">{error || 'This invite link is invalid or expired.'}</p>
          <a href="/login" className="btn btn-primary">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="text-center">
        <svg className="animate-spin mx-auto mb-4" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="text-[var(--text-secondary)] text-sm">Joining family...</p>
      </div>
    </div>
  );
}
