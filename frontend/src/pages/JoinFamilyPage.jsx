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
          setError(err.response?.data?.detail || 'This invite link is no longer valid');
          setStatus('error');
        }
      }
    };

    joinFamily();
  }, [invite_token, navigate]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--page)] flex items-center justify-center p-4">
        <div className="text-center max-w-md animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
            <span className="font-display text-2xl text-[var(--ink-muted)]">M</span>
          </div>
          <h1 className="font-display text-2xl mb-4">Invite expired</h1>
          <p className="text-[var(--ink-light)] mb-8">{error}</p>
          <a href="/login" className="btn btn-primary">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page)] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-thread-pull w-32 h-px mx-auto mb-4" />
        <p className="text-[var(--ink-muted)] text-sm font-mono text-xs tracking-wider">Opening the door...</p>
      </div>
    </div>
  );
}
