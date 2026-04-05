import React, { useCallback, useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import SessionNavigationGuard from './components/session/SessionNavigationGuard';
import LandingPage from './pages/LandingPage';
import Library from './pages/Library';
import BooksLibrary from './pages/BooksLibrary';
import MeetingAccessHub from './pages/MeetingAccessHub';
import ReadingRoom from './pages/ReadingRoom';
import MeetingHub from './pages/MeetingHub';
import BookThread from './pages/BookThread';
import ThreadAccessHub from './pages/ThreadAccessHub';
import WizardMerch from './pages/WizardMerch';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import BookQuiz from './pages/BookQuiz';
import RequestBookPage from './pages/RequestBookPage';
import { clearAuthSession, getStoredUser, updateStoredUser } from './utils/auth';
import { DEFAULT_UI_THEME, THEME_STORAGE_KEY, UI_THEMES } from './utils/uiThemes';
import './index.css';

const VALID_THEMES = UI_THEMES.map((theme) => theme.id);
const isDevAuthBypass = (
  import.meta.env.DEV &&
  (
    import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
    || (typeof process !== 'undefined' && process.env?.DEV_AUTH_BYPASS === 'true')
  )
);

const RequireMember = ({ currentUser, children }) => {
  const location = useLocation();
  const storedUser = getStoredUser();
  const effectiveUser = currentUser || storedUser;

  if (!effectiveUser && !isDevAuthBypass) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const AppShell = ({ currentUser, onLogout, onUserUpdate, uiTheme, onThemeChange, onAuthSuccess }) => {
  const location = useLocation();
  const hideNavbar = location.pathname.startsWith('/read/');

  return (
    <div className="app-container">
      <SessionNavigationGuard />
      {!hideNavbar && (
        <Navbar currentUser={currentUser} onLogout={onLogout} uiTheme={uiTheme} onThemeChange={onThemeChange} />
      )}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<LandingPage currentUser={currentUser} />} />
          <Route path="/auth" element={<AuthPage currentUser={currentUser} onAuthSuccess={onAuthSuccess} />} />
          <Route path="/desk" element={<RequireMember currentUser={currentUser}><BooksLibrary currentUser={currentUser} /></RequireMember>} />
          <Route path="/library" element={<RequireMember currentUser={currentUser}><Library /></RequireMember>} />
          <Route path="/books" element={<Navigate to="/desk" replace />} />
          <Route path="/request-book" element={<RequireMember currentUser={currentUser}><RequestBookPage /></RequireMember>} />
          <Route path="/read" element={<RequireMember currentUser={currentUser}><Navigate to="/request-book" replace /></RequireMember>} />
          <Route path="/meet" element={<MeetingAccessHub currentUser={currentUser} />} />
          <Route path="/threads" element={<ThreadAccessHub currentUser={currentUser} />} />
          <Route path="/profile" element={<RequireMember currentUser={currentUser}><ProfilePage currentUser={currentUser} onUserUpdate={onUserUpdate} /></RequireMember>} />
          <Route path="/settings" element={<RequireMember currentUser={currentUser}><SettingsPage uiTheme={uiTheme} onThemeChange={onThemeChange} currentUser={currentUser} onUserUpdate={onUserUpdate} /></RequireMember>} />
          <Route path="/read/gutenberg/:gutenbergId" element={<RequireMember currentUser={currentUser}><ReadingRoom uiTheme={uiTheme} onThemeChange={onThemeChange} /></RequireMember>} />
          <Route path="/read/:bookId" element={<RequireMember currentUser={currentUser}><ReadingRoom uiTheme={uiTheme} onThemeChange={onThemeChange} /></RequireMember>} />
          <Route path="/quiz/:bookId" element={<RequireMember currentUser={currentUser}><BookQuiz /></RequireMember>} />
          <Route path="/meet/:bookId" element={<RequireMember currentUser={currentUser}><MeetingHub /></RequireMember>} />
          <Route path="/thread/:bookId" element={<RequireMember currentUser={currentUser}><BookThread /></RequireMember>} />
          <Route path="/merch" element={<WizardMerch />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [uiTheme, setUiTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'midnight') {
      return DEFAULT_UI_THEME;
    }

    return VALID_THEMES.includes(storedTheme) ? storedTheme : DEFAULT_UI_THEME;
  });

  useEffect(() => {
    // HashRouter should ignore pathname, but stray prefixes (e.g. "/$#/desk") confuse users and break
    // any code that reads `window.location.pathname`. Normalize once at startup.
    try {
      if (typeof window !== 'undefined') {
        if (window.location.hash.startsWith('#/') && window.location.pathname !== '/') {
          window.history.replaceState(null, '', `/${window.location.hash}`);
          return;
        }

        if (!window.location.hash && window.location.pathname && window.location.pathname !== '/') {
          const search = window.location.search || '';
          const nextHash = `#${window.location.pathname}${search}`;
          window.history.replaceState(null, '', `/${nextHash}`);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, uiTheme);
  }, [uiTheme, currentUser?._id]);

  const handleAuthSuccess = useCallback((user) => {
    setCurrentUser(user);
  }, []);

  const handleUserUpdate = useCallback((userPatch) => {
    const nextUser = updateStoredUser(userPatch) || userPatch;
    setCurrentUser((prev) => ({ ...(prev || {}), ...nextUser }));
  }, []);

  const handleLogout = async () => {
    clearAuthSession();
    setCurrentUser(getStoredUser());
  };

  return (
    <Router>
      <AppShell
        currentUser={currentUser}
        onLogout={handleLogout}
        onUserUpdate={handleUserUpdate}
        uiTheme={uiTheme}
        onThemeChange={setUiTheme}
        onAuthSuccess={handleAuthSuccess}
      />
    </Router>
  );
};

export default App;
