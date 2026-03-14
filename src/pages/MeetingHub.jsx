import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Video, MessageSquare, Mic, User, Send, LockKeyhole, Bot } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { getFallbackBookById } from '../utils/bookFallback';
import { getBookAccessState, markQuizAsPassed, syncSingleBookAccess } from '../utils/readingAccess';
import './MeetingHub.css';

const socketServer = (() => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) {
    return envUrl;
  }

  if (import.meta.env.DEV && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    return `${window.location.protocol}//${host}:5000`;
  }

  return 'http://127.0.0.1:5000';
})();

const MeetingHub = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState('quiz');
  const [book, setBook] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomId, setRoomId] = useState(null);
  const [matchRole, setMatchRole] = useState(null);
  const [messages, setMessages] = useState([]);
  const [socketReady, setSocketReady] = useState(false);
  const [matchNotice, setMatchNotice] = useState('');
  const [searchHint, setSearchHint] = useState('');
  const [bookFriendOffered, setBookFriendOffered] = useState(false);
  const [bookFriendSessionId, setBookFriendSessionId] = useState(null);
  const [bookFriendLoading, setBookFriendLoading] = useState(false);
  const socketRef = useRef(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const roomIdRef = useRef(null);
  const startCallRef = useRef(null);
  const [mediaStatus, setMediaStatus] = useState('idle'); // idle | requesting | ready | connecting | connected | failed
  const [mediaError, setMediaError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [prefType, setPrefType] = useState('text');
  const accessMode = location.state?.accessMode || null;
  const gateNotice = location.state?.notice || '';

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    const buildQuiz = (selectedBook) => {
      if (!selectedBook) {
        setQuizQuestions([]);
        return;
      }

      setQuizQuestions([
        { text: `What was the most striking moment in ${selectedBook.title} for you?` },
        { text: `How did the author's style influence your reading pace?` },
        { text: 'Which character did you relate to most?' }
      ]);
    };

    const fetchData = async () => {
      const access = getBookAccessState(bookId);
      if (access.quizPassed && accessMode !== 'thread-gate') {
        setPhase('preferences');
      }

      try {
        const { data } = await api.get(`/books/${bookId}`);
        setBook(data);
        buildQuiz(data);
      } catch (error) {
        const fallbackBook = getFallbackBookById(bookId);
        console.error('Fetch error, using local fallback:', error);
        setBook(fallbackBook);
        buildQuiz(fallbackBook);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    socketRef.current = io(socketServer, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 600,
      timeout: 3000,
    });

    socketRef.current.on('connect', () => {
      setSocketReady(true);
      setMatchNotice('');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection failed:', error);
      setSocketReady(false);
      setMatchNotice('Live matching is offline right now. You can still enter the community thread.');
    });

    socketRef.current.on('match_found', ({ roomId: matchedRoomId, role }) => {
      setBookFriendOffered(false);
      setRoomId(matchedRoomId);
      setMatchRole(role || null);
      setPhase('connected');
    });

    socketRef.current.on('receive_message', ({ message }) => {
      setMessages((prev) => [...prev, { text: message, sender: 'partner', timestamp: new Date() }]);
    });

    socketRef.current.on('webrtc_offer', async ({ offer }) => {
      if (!offer) return;

      try {
        if (!localStreamRef.current) {
          pendingOfferRef.current = offer;
          if (typeof startCallRef.current === 'function') {
            startCallRef.current();
          }
          return;
        }

        const pc = peerRef.current;
        if (!pc) {
          pendingOfferRef.current = offer;
          return;
        }

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('webrtc_answer', { roomId: roomIdRef.current, answer: pc.localDescription });
        setMediaStatus('connecting');
      } catch (error) {
        console.error('[MEET] Failed handling WebRTC offer:', error);
        setMediaError(error?.message || 'Failed handling WebRTC offer.');
        setMediaStatus('failed');
      }
    });

    socketRef.current.on('webrtc_answer', async ({ answer }) => {
      if (!answer) return;

      try {
        const pc = peerRef.current;
        if (!pc) {
          return;
        }

        await pc.setRemoteDescription(answer);
        setMediaStatus('connecting');
      } catch (error) {
        console.error('[MEET] Failed handling WebRTC answer:', error);
        setMediaError(error?.message || 'Failed handling WebRTC answer.');
        setMediaStatus('failed');
      }
    });

    socketRef.current.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (!candidate) return;

      try {
        const pc = peerRef.current;
        if (!pc) {
          return;
        }

        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('[MEET] Failed adding ICE candidate:', error);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [accessMode, bookId]);

  const cleanupMedia = useCallback(() => {
    if (peerRef.current) {
      try {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;
        peerRef.current.close();
      } catch {
        // ignore
      }
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;
    pendingOfferRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setMediaStatus('idle');
    setMediaError('');
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const ensurePeerConnection = useCallback(() => {
    if (peerRef.current) {
      return peerRef.current;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
      ],
    });

    remoteStreamRef.current = new MediaStream();

    pc.ontrack = (event) => {
      const [stream] = event.streams || [];
      const remoteStream = remoteStreamRef.current;

      if (stream) {
        stream.getTracks().forEach((track) => remoteStream.addTrack(track));
      } else if (event.track) {
        remoteStream.addTrack(event.track);
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }

      setMediaStatus('connected');
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit('webrtc_ice_candidate', { roomId: roomIdRef.current, candidate: event.candidate });
    };

    const updateState = () => {
      const state = pc.connectionState || pc.iceConnectionState;
      if (state === 'connected') {
        setMediaStatus('connected');
      } else if (state === 'connecting' || state === 'checking') {
        setMediaStatus('connecting');
      } else if (state === 'failed' || state === 'disconnected') {
        setMediaStatus('failed');
      }
    };

    pc.onconnectionstatechange = updateState;
    pc.oniceconnectionstatechange = updateState;

    peerRef.current = pc;
    return pc;
  }, []);

  const getMediaConstraints = useCallback(() => {
    if (prefType === 'voice') {
      return { audio: true, video: false };
    }

    if (prefType === 'video') {
      return {
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
    }

    return null;
  }, [prefType]);

  const startCall = useCallback(async () => {
    if (!socketRef.current?.connected || !roomIdRef.current) {
      setMediaError('Connection is not ready yet. Please try again.');
      setMediaStatus('failed');
      return;
    }

    const constraints = getMediaConstraints();
    if (!constraints) {
      return;
    }

    if (localStreamRef.current) {
      return;
    }

    setMediaStatus('requesting');
    setMediaError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = ensurePeerConnection();

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      setMediaStatus('ready');

      if (pendingOfferRef.current && matchRole === 'callee') {
        const offer = pendingOfferRef.current;
        pendingOfferRef.current = null;
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('webrtc_answer', { roomId: roomIdRef.current, answer: pc.localDescription });
        setMediaStatus('connecting');
        return;
      }

      if (matchRole === 'caller') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('webrtc_offer', { roomId: roomIdRef.current, offer: pc.localDescription });
        setMediaStatus('connecting');
      }
    } catch (error) {
      console.error('[MEET] Failed starting call:', error);
      setMediaError(error?.message || 'Unable to access microphone/camera.');
      setMediaStatus('failed');
    }
  }, [ensurePeerConnection, getMediaConstraints, matchRole]);

  useEffect(() => {
    startCallRef.current = startCall;
  }, [startCall]);

  useEffect(() => {
    if (phase !== 'connected') {
      return undefined;
    }

    if (prefType !== 'voice' && prefType !== 'video') {
      cleanupMedia();
      return undefined;
    }

    const isAlreadyStarted = Boolean(localStreamRef.current);
    if (isAlreadyStarted || mediaStatus === 'requesting') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      startCall();
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cleanupMedia, mediaStatus, phase, prefType, startCall]);

  const mediaLabel = useMemo(() => {
    if (prefType === 'voice') return 'Voice call';
    if (prefType === 'video') return 'Video call';
    return 'Call';
  }, [prefType]);

  useEffect(() => {
    if (phase !== 'searching') {
      setSearchHint('');
      setBookFriendOffered(false);
      return undefined;
    }

    setSearchHint(`Waiting for another reader who chose ${prefType}.`);

    const reminderTimeoutId = window.setTimeout(() => {
      setSearchHint('Still searching for a reader.');
    }, 12000);

    const bookFriendTimeoutId = window.setTimeout(() => {
      setBookFriendOffered(true);
      setSearchHint('No reader joined yet. You can start a text chat with BookFriend.');
    }, 30000);

    return () => {
      window.clearTimeout(reminderTimeoutId);
      window.clearTimeout(bookFriendTimeoutId);
    };
  }, [phase, prefType]);


  useEffect(() => () => {
    if (bookFriendSessionId) {
      api.post('/agent/end', { session_id: bookFriendSessionId }).catch(() => {});
    }
  }, [bookFriendSessionId]);

  if (loading) return <div className="p-10 text-center mt-20 font-serif">Deep in the archives... Seeking your book.</div>;
  if (!book) return <div className="p-10 text-center mt-20 font-serif">Book not found. Perhaps it's still being written?</div>;

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex((index) => index + 1);
      setCurrentAnswer('');
    } else {
      const accessState = markQuizAsPassed(book._id || book.id);
      syncSingleBookAccess(book._id || book.id, accessState).catch((error) => {
        console.error('Failed to sync quiz progress:', error);
      });
      if (accessMode === 'thread-gate') {
        navigate(`/thread/${bookId}`, {
          state: {
            notice: `Access unlocked. Welcome to ${book.title}'s thread.`,
          },
        });
        return;
      }
      setPhase('preferences');
      setCurrentAnswer('');
    }
  };

  const handleStartSearch = () => {
    if (!socketRef.current?.connected) {
      setMatchNotice('Live matching is unavailable right now. Please try again shortly, or enter the community thread.');
      return;
    }

    setPhase('searching');
    setMatchNotice('');
    socketRef.current.emit('join_matchmaking', {
      bookId,
      prefType,
      anonymousId: `user_${Math.random().toString(36).slice(2, 11)}`,
    });
  };

  const handleTalkToBookFriend = async () => {
    setBookFriendLoading(true);
    setMatchNotice('');

    try {
      const { data } = await api.post('/agent/start', {
        book_id: book._id || book.id || bookId,
      });

      setBookFriendSessionId(data.session_id);
      setMessages([]);
      setPhase('bookfriend');
    } catch (error) {
      console.error('Failed to start BookFriend session:', error);
      setMatchNotice('BookFriend is unavailable right now. Please try again shortly.');
    } finally {
      setBookFriendLoading(false);
    }
  };

  const sendBookFriendMessage = async (event) => {
    event.preventDefault();
    const trimmed = chatInput.trim();

    if (!trimmed || !bookFriendSessionId) {
      return;
    }

    setMessages((prev) => [...prev, { text: trimmed, sender: 'me', timestamp: new Date() }]);
    setChatInput('');

    try {
      const { data } = await api.post('/agent/message', {
        session_id: bookFriendSessionId,
        message: trimmed,
      });

      setMessages((prev) => [...prev, { text: data.response, sender: 'bookfriend', timestamp: new Date() }]);
    } catch (error) {
      console.error('BookFriend reply failed:', error);
      setMessages((prev) => [...prev, {
        text: 'Sorry, I lost the thread for a moment. Could you try that again?',
        sender: 'bookfriend',
        timestamp: new Date(),
      }]);
    }
  };

  const endBookFriendSession = async () => {
    if (bookFriendSessionId) {
      try {
        await api.post('/agent/end', { session_id: bookFriendSessionId });
      } catch (error) {
        console.error('Failed to end BookFriend session:', error);
      }
    }

    setBookFriendSessionId(null);
    setMessages([]);
    setChatInput('');
    setBookFriendOffered(false);
    setPhase('preferences');
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!chatInput.trim() || !roomId || !socketRef.current) return;

    const msgData = { roomId, message: chatInput, senderId: socketRef.current.id };
    socketRef.current.emit('send_message', msgData);
    setMessages((prev) => [...prev, { text: chatInput, sender: 'me', timestamp: new Date() }]);
    setChatInput('');
  };

  return (
    <div className="meeting-hub animate-fade-in">
      {phase === 'quiz' && (
        <div className="quiz-container">
          <div className="quiz-card glass-panel">
            {gateNotice && (
              <div className="quiz-gate-banner">
                <LockKeyhole size={18} />
                <span>{gateNotice}</span>
              </div>
            )}
            <div className="quiz-header">
              <ShieldCheck size={32} className="text-accent mb-2" />
              <h2 className="font-serif">Knowledge Verification</h2>
              <p className="text-muted text-sm">To ensure genuine conversations, please answer a few questions about <em>{book.title}</em>.</p>
            </div>

            <div className="quiz-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(currentQuestionIndex / Math.max(quizQuestions.length, 1)) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted">Question {currentQuestionIndex + 1} of {quizQuestions.length}</span>
            </div>

            <div className="quiz-question-area animate-fade-in" key={currentQuestionIndex}>
              <h3 className="question-text">{quizQuestions[currentQuestionIndex]?.text}</h3>
              <textarea
                className="quiz-input"
                placeholder="Type your answer here... (Accuracy isn't strict, we just want to verify you've read it)"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                autoFocus
              />
            </div>

            <div className="quiz-footer">
              <button
                className="btn-primary"
                onClick={handleNextQuestion}
                disabled={currentAnswer.trim().length < 3 || quizQuestions.length === 0}
              >
                {currentQuestionIndex === quizQuestions.length - 1 ? 'Submit & Enter Hub' : 'Next Question'} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'preferences' && (
        <div className="preferences-container animate-fade-in">
          <div className="preferences-content glass-panel">
            <h2 className="font-serif text-center mb-2">How would you like to connect?</h2>
            <p className="text-muted text-center mb-8">Select your preferred medium to discuss <em>{book.title}</em>. Your identity remains anonymous.</p>

            <div className="pref-options">
              <button
                type="button"
                className={`pref-card ${prefType === 'text' ? 'selected' : ''}`}
                onClick={() => { setPrefType('text'); setMatchNotice(''); }}
                aria-pressed={prefType === 'text'}
              >
                <div className="pref-icon-wrapper"><MessageSquare size={32} /></div>
                <h3>Text Chat</h3>
                <p>Quiet, thoughtful discussion.</p>
              </button>

              <button
                type="button"
                className={`pref-card ${prefType === 'voice' ? 'selected' : ''}`}
                onClick={() => { setPrefType('voice'); setMatchNotice(''); }}
                aria-pressed={prefType === 'voice'}
              >
                <div className="pref-icon-wrapper"><Mic size={32} /></div>
                <h3>Voice Call</h3>
                <p>Vocalize your thoughts securely.</p>
              </button>

              <button
                type="button"
                className={`pref-card ${prefType === 'video' ? 'selected' : ''}`}
                onClick={() => { setPrefType('video'); setMatchNotice(''); }}
                aria-pressed={prefType === 'video'}
              >
                <div className="pref-icon-wrapper"><Video size={32} /></div>
                <h3>Video Call</h3>
                <p>Face-to-face, masked connection.</p>
              </button>
            </div>

            {matchNotice && (
              <div className="meeting-notice" role="status">
                {matchNotice}
              </div>
            )}

            <div className="mt-8 text-center flex-column-center gap-4">
              <button
                className="btn-primary"
                disabled={!prefType || !socketReady}
                onClick={handleStartSearch}
              >
                Find a reading partner <ArrowRight size={18} />
              </button>
              <button className="btn-secondary" onClick={() => navigate(`/thread/${bookId}`)}>
                Skip to Community Thread instead
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'searching' && (
        <div className="searching-container animate-fade-in">
          <div className="radar-animation">
            <div className="radar-circle"></div>
            <div className="radar-circle delay-1"></div>
            <div className="radar-circle delay-2"></div>
            <User size={48} className="radar-center-icon text-accent" />
          </div>
          <h2 className="font-serif">Searching the cosmos...</h2>
          <p className="text-muted mt-2">Looking for someone who just finished <em>{book.title}</em></p>
          {searchHint && <p className="text-muted">{searchHint}</p>}
          {bookFriendOffered && (
            <button className="btn-primary mt-6" onClick={handleTalkToBookFriend} disabled={bookFriendLoading}>
              <Bot size={18} /> {bookFriendLoading ? 'Starting BookFriend...' : 'Talk to BookFriend'}
            </button>
          )}
          <button className="btn-secondary mt-8" onClick={() => { setBookFriendOffered(false); setPhase('preferences'); }}>Cancel Search</button>
        </div>
      )}


      {phase === 'bookfriend' && (
        <div className="room-container animate-fade-in">
          <div className="room-header glass-panel">
            <div className="partner-info">
              <div className="partner-avatar bg-gradient" />
              <div>
                <h3 className="font-serif">BookFriend Connected</h3>
                <p className="text-xs text-muted">Text-only reading companion for {book.title}</p>
              </div>
            </div>
            <div className="room-actions">
              <button type="button" className="btn-secondary sm" onClick={endBookFriendSession}>
                End Chat
              </button>
            </div>
          </div>

          <div className="room-main glass-panel">
            <div className="chat-interface">
              <div className="chat-messages">
                {messages.map((msg, index) => (
                  <div key={index} className={`message ${msg.sender === 'me' ? 'sent' : 'received'}`}>
                    <div className="msg-bubble">{msg.text}</div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center text-muted p-10">
                    Hi, I'm BookFriend. What stood out most to you in this book?
                  </div>
                )}
              </div>
              <form className="chat-input-area" onSubmit={sendBookFriendMessage}>
                <input
                  type="text"
                  placeholder="Share a thought about the book..."
                  className="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="send-btn bg-gradient"><Send size={20} /></button>
              </form>
            </div>
          </div>
        </div>
      )}

      {phase === 'connected' && (
        <div className="room-container animate-fade-in">
          <div className="room-header glass-panel">
            <div className="partner-info">
              <div className="partner-avatar bg-gradient" />
              <div>
                <h3 className="font-serif">Reading Partner Connected</h3>
                <p className="text-xs text-muted">Prefers {prefType} | In {roomId}</p>
              </div>
            </div>
            <div className="room-actions">
              <button
                type="button"
                className="btn-secondary sm"
                onClick={() => {
                  cleanupMedia();
                  setRoomId(null);
                  setMatchRole(null);
                  setMessages([]);
                  setPhase('preferences');
                }}
              >
                Leave Room
              </button>
            </div>
          </div>

          <div className="room-main glass-panel">
            {prefType === 'text' ? (
              <div className="chat-interface">
                <div className="chat-messages">
                  {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender === 'me' ? 'sent' : 'received'}`}>
                      <div className="msg-bubble">{msg.text}</div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-center text-muted p-10">Matched! Say hi to your fellow reader.</div>
                  )}
                </div>
                <form className="chat-input-area" onSubmit={sendMessage}>
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="chat-input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="send-btn bg-gradient"><Send size={20} /></button>
                </form>
              </div>
            ) : (
              <div className="media-interface">
                <div className="media-stage" role="group" aria-label={mediaLabel}>
                  <div className="media-grid">
                    <div className="media-tile">
                      <div className="media-tile-label">You</div>
                      {prefType === 'video' ? (
                        <video ref={localVideoRef} autoPlay muted playsInline className="media-video" />
                      ) : (
                        <div className="media-avatar">
                          <User size={48} />
                          <span>Your mic</span>
                        </div>
                      )}
                    </div>

                    <div className="media-tile">
                      <div className="media-tile-label">Partner</div>
                      <video ref={remoteVideoRef} autoPlay playsInline className="media-video" />
                      <audio ref={remoteAudioRef} autoPlay />
                    </div>
                  </div>

                  <div className="media-controls">
                    {(mediaStatus === 'failed' || mediaError) && (
                      <div className="media-error" role="status">
                        {mediaError || 'Call failed. Try again.'}
                      </div>
                    )}

                    <div className="media-actions">
                      <button
                        type="button"
                        className="btn-secondary sm"
                        onClick={() => {
                          const stream = localStreamRef.current;
                          const tracks = stream ? stream.getAudioTracks() : [];
                          tracks.forEach((track) => {
                            track.enabled = isMuted;
                          });
                          setIsMuted((muted) => !muted);
                        }}
                        disabled={!localStreamRef.current}
                      >
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>

                      {prefType === 'video' && (
                        <button
                          type="button"
                          className="btn-secondary sm"
                          onClick={() => {
                            const stream = localStreamRef.current;
                            const tracks = stream ? stream.getVideoTracks() : [];
                            tracks.forEach((track) => {
                              track.enabled = isCameraOff;
                            });
                            setIsCameraOff((off) => !off);
                          }}
                          disabled={!localStreamRef.current}
                        >
                          {isCameraOff ? 'Camera on' : 'Camera off'}
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-primary sm"
                        onClick={() => {
                          cleanupMedia();
                          startCall();
                        }}
                        disabled={mediaStatus === 'requesting'}
                      >
                        {mediaStatus === 'requesting' ? 'Requesting…' : (localStreamRef.current ? 'Reconnect' : 'Start call')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingHub;
