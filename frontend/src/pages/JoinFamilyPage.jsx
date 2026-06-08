import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { familyAPI } from '../lib/api';
import { Loader2 } from 'lucide-react';

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
          // Already a member - try to find the family
          try {
            const families = await familyAPI.getMyFamilies();
            const found = families.find(f => f.invite_token === invite_token);
            if (found) {
              navigate(`/family/${found.id}`);
              return;
            }
          } catch {}
          setError('Already a member. Redirecting to dashboard...');
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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😕</div>
          <h1 className="font-display text-3xl text-[#4A1C0A] mb-4">Invalid Invite</h1>
          <p className="text-[#8B7355] mb-8">{error || 'This invite link is invalid or expired.'}</p>
          <a href="/login" className="btn-primary">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-[#B8975A] mx-auto mb-4" />
        <p className="font-body italic text-[#8B7355]">Joining family...</p>
      </div>
    </div>
  );
}
