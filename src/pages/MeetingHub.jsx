import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Video, MessageSquare, Mic, User, Send, Bot } from 'lucide-react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { getFallbackBookById } from '../utils/bookFallback';
import { getSocketServerUrl } from '../utils/serviceUrls';
import './MeetingHub.css';

const socketServer = getSocketServerUrl();

const MeetingHub = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('preferences');
  const [book, setBook] = useState(null);
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
  const [mediaStatus, setMediaStatus] = useState('idle');
  const [mediaError, setMediaError] = useState('');

  const [chatInput, setChatInput] = useState('');
  const [prefType, setPrefType] = useState('text');

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get(`/books/${bookId}`);
        setBook(data);
      } catch (error) {
        const fallbackBook = getFallbackBookById(bookId);
        console.error('Fetch error, using local fallback:', error);
        setBook(fallbackBook);
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
          if (typeof startCallRef.current === 'function') startCallRef.current();
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
        setMediaError(error?.message || 'Failed handling WebRTC offer.');
        setMediaStatus('failed');
      }
    });

    socketRef.current.on('webrtc_answer', async ({ answer }) => {
      if (!answer) return;
      try {
        const pc = peerRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(answer);
        setMediaStatus('connecting');
      } catch (error) {
        setMediaError(error?.message || 'Failed handling WebRTC answer.');
        setMediaStatus('failed');
      }
    });

    socketRef.current.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (!candidate) return;
      try {
        const pc = peerRef.current;
        if (!pc) return;
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [bookId]);

  const cleanupMedia = useCallback(() => {
    if (peerRef.current) {
      try { peerRef.current.close(); } catch { /* ignore */ }
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    pendingOfferRef.current = null;
    setMediaStatus('idle');
    setMediaError('');
  }, []);

  const startCall = useCallback(async () => {
    if (prefType === 'text') return;
    try {
      setMediaStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: prefType === 'video' });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerRef.current = pc;
      remoteStreamRef.current = new MediaStream();
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStreamRef.current;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => event.streams[0].getTracks().forEach((track) => remoteStreamRef.current?.addTrack(track));
      pc.onicecandidate = (event) => {
        if (event.candidate) socketRef.current?.emit('webrtc_ice_candidate', { roomId: roomIdRef.current, candidate: event.candidate });
      };
      if (matchRole === 'offerer') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('webrtc_offer', { roomId: roomIdRef.current, offer: pc.localDescription });
      }
      setMediaStatus('ready');
    } catch (error) {
      setMediaError(error?.message || 'Unable to access camera or microphone.');
      setMediaStatus('failed');
    }
  }, [matchRole, prefType]);

  startCallRef.current = startCall;

  useEffect(() => {
    if (phase !== 'connected') cleanupMedia();
  }, [cleanupMedia, phase]);

  useEffect(() => {
    if (phase !== 'searching') return undefined;
    setSearchHint(`Waiting for another reader who chose ${prefType}.`);
    const reminderTimeoutId = window.setTimeout(() => setSearchHint('Still searching for a reader.'), 12000);
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
    if (bookFriendSessionId) api.post('/agent/end', { session_id: bookFriendSessionId }).catch(() => {});
  }, [bookFriendSessionId]);

  if (loading) return <div className="p-10 text-center mt-20 font-serif">Deep in the archives... Seeking your book.</div>;
  if (!book) return <div className="p-10 text-center mt-20 font-serif">Book not found. Perhaps it's still being written?</div>;

  const handleStartSearch = () => {
    if (!socketRef.current?.connected) {
      setMatchNotice('Live matching is unavailable right now. Please try again shortly, or enter the community thread.');
      return;
    }
    setPhase('searching');
    setMatchNotice('');
    socketRef.current.emit('join_matchmaking', { bookId, prefType, anonymousId: `user_${Math.random().toString(36).slice(2, 11)}` });
  };

  const handleTalkToBookFriend = async () => {
    setBookFriendLoading(true);
    setMatchNotice('');
    try {
      const { data } = await api.post('/agent/start', { book_id: book._id || book.id || bookId });
      setBookFriendSessionId(data.session_id);
      setMessages([]);
      setPhase('bookfriend');
    } catch {
      setMatchNotice('BookFriend is unavailable right now. Please try again shortly.');
    } finally {
      setBookFriendLoading(false);
    }
  };

  const sendBookFriendMessage = async (event) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || !bookFriendSessionId) return;
    setMessages((prev) => [...prev, { text: trimmed, sender: 'me', timestamp: new Date() }]);
    setChatInput('');
    try {
      const { data } = await api.post('/agent/message', { session_id: bookFriendSessionId, message: trimmed });
      setMessages((prev) => [...prev, { text: data.response, sender: 'bookfriend', timestamp: new Date() }]);
    } catch {
      setMessages((prev) => [...prev, { text: 'Sorry, I lost the thread for a moment. Could you try that again?', sender: 'bookfriend', timestamp: new Date() }]);
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!chatInput.trim() || !roomId || !socketRef.current) return;
    const msgData = { roomId, message: chatInput, senderId: socketRef.current.id };
    socketRef.current.emit('send_message', msgData);
    setMessages((prev) => [...prev, { text: chatInput, sender: 'me', timestamp: new Date() }]);
    setChatInput('');
  };

  const mediaConnected = mediaStatus === 'ready' || mediaStatus === 'connecting' || mediaStatus === 'connected';

  return (
    <div className="meeting-hub animate-fade-in">
      {phase === 'preferences' && (
        <div className="preferences-container animate-fade-in">
          <div className="preferences-content glass-panel">
            <h2 className="font-serif text-center mb-2">How would you like to connect?</h2>
            <p className="text-muted text-center mb-8">Select your preferred medium to discuss <em>{book.title}</em>. Your identity remains anonymous.</p>
            <div className="pref-options">
              <button type="button" className={`pref-card ${prefType === 'text' ? 'selected' : ''}`} onClick={() => { setPrefType('text'); setMatchNotice(''); }}><div className="pref-icon-wrapper"><MessageSquare size={32} /></div><h3>Text Chat</h3><p>Quiet, thoughtful discussion.</p></button>
              <button type="button" className={`pref-card ${prefType === 'voice' ? 'selected' : ''}`} onClick={() => { setPrefType('voice'); setMatchNotice(''); }}><div className="pref-icon-wrapper"><Mic size={32} /></div><h3>Voice Call</h3><p>Vocalize your thoughts securely.</p></button>
              <button type="button" className={`pref-card ${prefType === 'video' ? 'selected' : ''}`} onClick={() => { setPrefType('video'); setMatchNotice(''); }}><div className="pref-icon-wrapper"><Video size={32} /></div><h3>Video Call</h3><p>Face-to-face, masked connection.</p></button>
            </div>
            {matchNotice && <div className="meeting-notice" role="status">{matchNotice}</div>}
            <div className="mt-8 text-center flex-column-center gap-4">
              <button className="btn-primary" disabled={!prefType || !socketReady} onClick={handleStartSearch}>Find a reading partner <ArrowRight size={18} /></button>
              <button className="btn-secondary" onClick={() => navigate(`/thread/${bookId}`)}>Skip to Community Thread instead</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'searching' && <div className="searching-container animate-fade-in"><div className="searching-card glass-panel"><h2 className="font-serif">Finding a reader...</h2><p className="text-muted">{searchHint}</p>{bookFriendOffered && <button className="btn-secondary" disabled={bookFriendLoading} onClick={handleTalkToBookFriend}>{bookFriendLoading ? 'Starting BookFriend...' : 'Talk to BookFriend'}</button>}<button className="btn-tertiary" onClick={() => setPhase('preferences')}>Back</button></div></div>}

      {phase === 'bookfriend' && <div className="chat-shell animate-fade-in"><div className="chat-header glass-panel"><Bot size={18} /><span>BookFriend</span></div><div className="chat-messages glass-panel">{messages.map((m, i) => <div key={`${m.sender}-${i}`} className={`chat-row ${m.sender === 'me' ? 'mine' : 'theirs'}`}>{m.text}</div>)}</div><form className="chat-input-row" onSubmit={sendBookFriendMessage}><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Share your thought..." /><button type="submit" className="btn-primary"><Send size={16} /></button><button type="button" className="btn-secondary" onClick={() => setPhase('preferences')}>Leave</button></form></div>}

      {phase === 'connected' && <div className="chat-shell animate-fade-in"><div className="chat-header glass-panel"><User size={18} /><span>Matched reader {matchRole ? `(${matchRole})` : ''}</span></div>{prefType !== 'text' && <div className="media-stage glass-panel">{prefType === 'video' && <><video ref={localVideoRef} autoPlay muted playsInline className="local-video" /><video ref={remoteVideoRef} autoPlay playsInline className="remote-video" /></>} {prefType === 'voice' && <audio ref={remoteAudioRef} autoPlay />} {!mediaConnected && <button className="btn-primary" onClick={startCall}>Start call</button>} {mediaError && <p className="text-error text-xs">{mediaError}</p>}</div>}<div className="chat-messages glass-panel">{messages.map((m, i) => <div key={`${m.sender}-${i}`} className={`chat-row ${m.sender === 'me' ? 'mine' : 'theirs'}`}>{m.text}</div>)}</div><form className="chat-input-row" onSubmit={sendMessage}><input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Send a message..." /><button type="submit" className="btn-primary"><Send size={16} /></button><button type="button" className="btn-secondary" onClick={() => { socketRef.current?.emit('leave_room', { roomId }); setRoomId(null); setMessages([]); setPhase('preferences'); }}>Leave</button></form></div>}
    </div>
  );
};

export default MeetingHub;
