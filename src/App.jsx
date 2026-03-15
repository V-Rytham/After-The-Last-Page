import React, { useEffect, useRef, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import LandingPage from './pages/LandingPage';
import BooksLibrary from './pages/BooksLibrary';
import Library from './pages/Library';
import MeetingAccessHub from './pages/MeetingAccessHub';
import ReadingRoom from './pages/ReadingRoom';
import MeetingHub from './pages/MeetingHub';
import BookThread from './pages/BookThread';
import ThreadAccessHub from './pages/ThreadAccessHub';
import WizardMerch from './pages/WizardMerch';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import api from './utils/api';
import { clearAuthSession, getStoredToken, getStoredUser, saveAuthSession, updateStoredUser } from './utils/auth';
import { getCurrentActorAccessState, hydrateBookAccessForUser, syncCurrentAccessState } from './utils/readingAccess';
import './index.css';

const THEME_STORAGE_KEY = 'atlp-ui-theme';
const VALID_THEMES = ['light', 'sepia', 'dark'];

const RequireMember = ({ currentUser, children }) => {
  const location = useLocation();
  const storedUser = getStoredUser();
  const effectiveUser = currentUser && !currentUser.isAnonymous ? currentUser : storedUser;

  if (!effectiveUser || effectiveUser.isAnonymous) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const AppShell = ({ currentUser, onLogout, uiTheme, onThemeChange, onAuthSuccess }) => {
  const location = useLocation();
  const hideNavbar = location.pathname.startsWith('/read/');

  return (
    <div className="app-container">
      {!hideNavbar && (
        <Navbar currentUser={currentUser} onLogout={onLogout} uiTheme={uiTheme} onThemeChange={onThemeChange} />
      )}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<LandingPage currentUser={currentUser} />} />
          <Route path="/auth" element={<AuthPage currentUser={currentUser} onAuthSuccess={onAuthSuccess} />} />
          <Route path="/desk" element={<RequireMember currentUser={currentUser}><BooksLibrary /></RequireMember>} />
          <Route path="/library" element={<RequireMember currentUser={currentUser}><Library /></RequireMember>} />
          <Route path="/books" element={<Navigate to="/desk" replace />} />
          <Route path="/meet" element={<MeetingAccessHub currentUser={currentUser} />} />
          <Route path="/threads" element={<ThreadAccessHub currentUser={currentUser} />} />
          <Route path="/profile" element={<RequireMember currentUser={currentUser}><ProfilePage currentUser={currentUser} /></RequireMember>} />
          <Route path="/settings" element={<RequireMember currentUser={currentUser}><SettingsPage uiTheme={uiTheme} onThemeChange={onThemeChange} /></RequireMember>} />
          <Route path="/read/:bookId" element={<RequireMember currentUser={currentUser}><ReadingRoom uiTheme={uiTheme} onThemeChange={onThemeChange} /></RequireMember>} />
          <Route path="/meet/:bookId" element={<MeetingHub />} />
          <Route path="/thread/:bookId" element={<BookThread />} />
          <Route path="/merch" element={<WizardMerch />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const bootstrapStartedRef = useRef(false);
  const [uiTheme, setUiTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.includes(storedTheme) ? storedTheme : 'sepia';
  });

  useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }

    bootstrapStartedRef.current = true;

    const bootstrapSession = async () => {
      const token = getStoredToken();

      if (token) {
        try {
          const existingAccessState = getCurrentActorAccessState();
          const { data } = await api.get('/users/profile');
          const user = updateStoredUser(data) || data;
          hydrateBookAccessForUser(user, { mergeExisting: true });
          if (Object.keys(existingAccessState).length > 0) {
            syncCurrentAccessState().catch((error) => {
              console.error('[AUTH] Failed to sync local reading access:', error);
            });
          }
          setCurrentUser(user);
          return;
        } catch (error) {
          console.error('[AUTH] Stored session is invalid, replacing with guest session:', error);
          clearAuthSession();
        }
      }

      try {
        const { data } = await api.post('/users/anonymous');
        const user = saveAuthSession(data);
        hydrateBookAccessForUser(user);
        setCurrentUser(user);
        console.log('[AUTH] Anonymous identity created:', user.anonymousId);
      } catch (error) {
        console.error('[AUTH] Failed to register anonymous user:', error);
        setCurrentUser(null);
      }
    };

    bootstrapSession();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, uiTheme);
  }, [uiTheme]);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    clearAuthSession();

    try {
      const { data } = await api.post('/users/anonymous');
      const guestUser = saveAuthSession(data);
      hydrateBookAccessForUser(guestUser);
      setCurrentUser(guestUser);
    } catch (error) {
      console.error('[AUTH] Failed to create guest session after logout:', error);
      setCurrentUser(null);
    }
  };

  return (
    <Router>
      <AppShell
        currentUser={currentUser}
        onLogout={handleLogout}
        uiTheme={uiTheme}
        onThemeChange={setUiTheme}
        onAuthSuccess={handleAuthSuccess}
      />
    </Router>
  );
};

export default App;
