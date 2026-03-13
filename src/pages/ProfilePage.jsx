import React, { useMemo } from 'react';
import { Mail, ShieldCheck, User } from 'lucide-react';
import { getStoredUser } from '../utils/auth';
import './ProfilePage.css';

const ProfilePage = ({ currentUser }) => {
  const user = useMemo(() => {
    if (currentUser && !currentUser.isAnonymous) {
      return currentUser;
    }
    return getStoredUser();
  }, [currentUser]);

  const displayName = user?.name || user?.email || 'Reader';
  const email = user?.email || '—';

  return (
    <div className="profile-page animate-fade-in">
      <header className="profile-head">
        <h1 className="font-serif">Profile</h1>
        <p>Your membership details and account basics.</p>
      </header>

      <section className="profile-card glass-panel" aria-label="Account details">
        <div className="profile-row">
          <div className="profile-label">
            <User size={16} aria-hidden="true" />
            <span>Name</span>
          </div>
          <div className="profile-value">{displayName}</div>
        </div>

        <div className="profile-row">
          <div className="profile-label">
            <Mail size={16} aria-hidden="true" />
            <span>Email</span>
          </div>
          <div className="profile-value">{email}</div>
        </div>

        <div className="profile-row">
          <div className="profile-label">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Status</span>
          </div>
          <div className="profile-value">Member</div>
        </div>
      </section>
    </div>
  );
};

export default ProfilePage;

