'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Meeting, Participant } from '@/types';
import { api } from '@/lib/api';
import ToastContainer, { ToastItem } from './Toast';

interface MeetingRoomProps { meetingId: string; }
interface ChatMessage { id?: number; name: string; time: string; text: string; }
interface FloatingReaction { id: number; emoji: string; x: number; }

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
const REACTION_EMOJIS = ['👍','❤️','😂','🎉','👏','🤔','🙌','🔥'];

export default function MeetingRoom({ meetingId }: MeetingRoomProps) {
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [screensharingParticipants, setScreensharingParticipants] = useState<Record<number, boolean>>({});
  const isScreenSharingRef = useRef(false);

  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    // Clean up any screen sharing states for participants who are no longer in the meeting
    setScreensharingParticipants(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(pidStr => {
        const pid = parseInt(pidStr);
        if (!participants.some(p => p.id === pid)) {
          delete next[pid];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [participants]);

  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [hasJoined, setHasJoined] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [guestName, setGuestName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zoom_remembered_name') || '';
    }
    return '';
  });
  const [guestJoinError, setGuestJoinError] = useState('');
  const [localParticipantId, setLocalParticipantId] = useState<number | null>(null);
  const [localDisplayName, setLocalDisplayName] = useState<string>('');

  // Lobby Preview states
  const [lobbyStream, setLobbyStream] = useState<MediaStream | null>(null);
  const [lobbyMuted, setLobbyMuted] = useState(false);
  const [lobbyVideoOff, setLobbyVideoOff] = useState(false);
  const lobbyVideoRef = useRef<HTMLVideoElement | null>(null);
  const [meetingPasscode, setMeetingPasscode] = useState('');
  const [rememberName, setRememberName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zoom_remember_name_flag') === 'true';
    }
    return false;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localPidRef = useRef<number | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const originalCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const pcsRef = useRef<Record<number, RTCPeerConnection>>({});
  const iceBufferRef = useRef<Record<number, RTCIceCandidateInit[]>>({});
  const participantsRef = useRef<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});

  // Synchronize participants state with participantsRef to prevent stale closure bugs
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Synchronize localPidRef immediately during render to prevent state updates timing out
  localPidRef.current = localParticipantId;

  useEffect(() => {
    Object.entries(remoteStreams).forEach(([pidStr, stream]) => {
      const el = document.getElementById(`remote-video-${pidStr}`) as HTMLVideoElement;
      if (el) {
        if (el.srcObject !== stream) {
          el.srcObject = stream;
        }
        el.play().catch(err => {
          console.warn(`[WebRTC] Auto-play prevented for peer ${pidStr}:`, err);
        });
      }
    });
  }, [remoteStreams]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const showToast = useCallback((msg: string, type: ToastItem['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const spawnReaction = useCallback((emoji: string) => {
    const id = Date.now() + Math.random();
    const x = 5 + Math.random() * 85;
    setReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
  }, []);

  // WebRTC Peer Connection Helper
  const getOrCreatePC = useCallback((peerId: number, ws: WebSocket) => {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    console.log(`[WebRTC] Creating PeerConnection for peer ${peerId}`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    pcsRef.current[peerId] = pc;

    // Handle local ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'webrtc-ice',
          sender_id: localPidRef.current,
          target_id: peerId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        }));
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from peer ${peerId}, kind: ${event.track.kind}`);
      setRemoteStreams(prev => {
        const existing = prev[peerId];
        const newStream = new MediaStream(existing ? existing.getTracks() : []);
        if (!newStream.getTracks().some(t => t.id === event.track.id)) {
          newStream.addTrack(event.track);
        }
        return {
          ...prev,
          [peerId]: newStream
        };
      });
    };

    // Standard negotiationneeded handler (only client with HIGHER ID initiates the offer)
    pc.onnegotiationneeded = async () => {
      const pid = localPidRef.current;
      if (pid && pid > peerId) {
        try {
          console.log(`[WebRTC] negotiationneeded: Initiating offer to peer ${peerId}`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'webrtc-offer',
              sender_id: pid,
              target_id: peerId,
              sdp: offer
            }));
          }
        } catch (e) {
          console.error('[WebRTC] negotiationneeded offer error:', e);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connectionState changed to:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        delete pcsRef.current[peerId];
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    // Add local stream tracks if available
    let hasAudio = false;
    let hasVideo = false;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
        if (track.kind === 'audio') hasAudio = true;
        if (track.kind === 'video') hasVideo = true;
      });
    }

    // Ensure audio and video transceivers always exist to maintain constant m-line ordering!
    if (!hasAudio) {
      try { pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch (e) { console.warn("addTransceiver audio error:", e); }
    }
    if (!hasVideo) {
      try { pc.addTransceiver('video', { direction: 'sendrecv' }); } catch (e) { console.warn("addTransceiver video error:", e); }
    }

    return pc;
  }, []);

  // ── WebRTC camera/mic / Lobby Preview ────────────────────────────────────────
  useEffect(() => {
    if (!hasJoined) {
      // Lobby pre-join phase: request local media stream immediately for webcam preview
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setLobbyStream(stream);
          if (lobbyVideoRef.current) {
            lobbyVideoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error('[Lobby] Camera/mic preview error:', err);
        });

      return () => {
        // Clean up only if they never joined
      };
    } else {
      // Meeting active phase: transfer lobby stream or request fresh
      if (lobbyStream) {
        console.log('[Lobby] Transferring lobby stream to active meeting stream');
        localStreamRef.current = lobbyStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = lobbyStream;
        }
        setIsMuted(lobbyMuted);
        setIsVideoOn(!lobbyVideoOff);
        setMediaReady(true);
      } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(stream => {
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setMediaReady(true);
          })
          .catch(() => {
            showToast('Camera/mic unavailable — continuing without media', 'info');
            setMediaReady(true);
          });
      }

      return () => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        setMediaReady(false);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasJoined]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const data = await api.getMeeting(meetingId);
        setMeeting(data);

        if (data.status === 'ended') {
          alert('This meeting has already ended.');
          router.push('/');
          return;
        }

        // Resume from sessionStorage (same tab refresh)
        const savedPid = sessionStorage.getItem(`p_id_${meetingId}`);
        if (savedPid) {
          setLocalParticipantId(parseInt(savedPid));
          const savedName = sessionStorage.getItem(`p_name_${meetingId}`) || 'Me';
          setLocalDisplayName(savedName);
          setHasJoined(true);
          setLoading(false);
          return;
        }

        // Host tab
        const isHostTab = sessionStorage.getItem(`host_of_${meetingId}`) === 'true';
        if (isHostTab) {
          const activeParts = await api.listParticipants(meetingId);
          setParticipants(activeParts);
          const hostPart = activeParts.find(p => p.role === 'host');
          if (hostPart) {
            sessionStorage.setItem(`p_id_${meetingId}`, hostPart.id.toString());
            sessionStorage.setItem(`p_name_${meetingId}`, hostPart.display_name);
            setLocalParticipantId(hostPart.id);
            setLocalDisplayName(hostPart.display_name);
            setHasJoined(true);
          }
          setLoading(false);
          return;
        }

        // Guest via ?name= query param
        const urlParams = new URLSearchParams(window.location.search);
        const queryName = urlParams.get('name');
        if (queryName) {
          try {
            const part = await api.joinMeeting(meetingId, { display_name: queryName });
            sessionStorage.setItem(`p_id_${meetingId}`, part.id.toString());
            sessionStorage.setItem(`p_name_${meetingId}`, queryName);
            setLocalParticipantId(part.id);
            setLocalDisplayName(queryName);
            setHasJoined(true);
          } catch (e) {
            console.error('Auto-join error:', e);
          }
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading meeting:', err);
        // Offline fallback
        setMeeting({
          id: 0, meeting_id: meetingId, title: 'Zoom Meeting', description: null,
          host_id: 1, status: 'active', scheduled_at: new Date().toISOString(),
          duration_minutes: 60, invite_link: `${window.location.origin}/meeting/${meetingId}`,
          passcode: 'abc123', created_at: new Date().toISOString(), ended_at: null,
          host: null, participants: [],
        });
        setLocalDisplayName('Guest');
        setHasJoined(true);
        setLoading(false);
      }
    };
    loadMeeting();
  }, [meetingId, router]);

  // ── WebSocket connection (replaces polling) ─────────────────────────────────
  useEffect(() => {
    if (!hasJoined || loading || !mediaReady) return;

    // Helper to trigger mesh signaling check
    const triggerMeshSignaling = (activeWs: WebSocket, partsList?: Participant[]) => {
      const parts = partsList || participantsRef.current;
      const pid = localPidRef.current;
      if (!pid || !activeWs || activeWs.readyState !== WebSocket.OPEN) return;

      console.log(`[WebRTC] Running mesh signaling check. Total participants: ${parts.length}`);

      // 1. Clean up stale connections
      Object.keys(pcsRef.current).forEach(peerIdStr => {
        const pId = parseInt(peerIdStr);
        if (!parts.some(p => p.id === pId)) {
          console.log(`[WebRTC] Peer ${pId} left. Closing connection.`);
          pcsRef.current[pId]?.close();
          delete pcsRef.current[pId];
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[pId];
            return next;
          });
        }
      });

      // 2. Establish connections with new participants (will trigger onnegotiationneeded inside getOrCreatePC)
      parts.forEach((peer) => {
        if (peer.id === pid) return; // skip self
        if (!pcsRef.current[peer.id]) {
          getOrCreatePC(peer.id, activeWs);
        }
      });
    };

    // 1. Load initial data via REST
    const initData = async () => {
      try {
        const [parts, msgs] = await Promise.all([
          api.listParticipants(meetingId),
          api.listMessages(meetingId),
        ]);
        setParticipants(parts);
        setMessages(
          msgs.map(m => ({
            id: m.id,
            name: m.sender_name,
            time: new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            text: m.text,
          }))
        );
        // Sync own mute/video state
        const me = parts.find(p => p.id === localPidRef.current);
        if (me) {
          setIsMuted(me.is_muted);
          setIsVideoOn(me.is_video_on);
        }

        // If WS is already open, trigger signaling
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          triggerMeshSignaling(wsRef.current, parts);
        }
      } catch (err) {
        console.error('Initial data load error:', err);
      }
    };
    initData();

    // 2. Open WebSocket
    const ws = new WebSocket(`${WS_BASE}/ws/${meetingId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to meeting room:', meetingId);
      // Wait 500ms to ensure initData REST call has populated the participants list
      setTimeout(() => {
        triggerMeshSignaling(ws);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'request_screen_share_status' }));
        }
      }, 500);
    };

    ws.onmessage = async (event) => {
      // Ignore plain-text heartbeat replies
      if (event.data === 'pong') return;
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'participants') {
          const parts: Participant[] = msg.data;
          setParticipants(parts);

          // Check if we were removed
          const pid = localPidRef.current;
          if (pid && !parts.some(p => p.id === pid)) {
            return;
          }

          // Sync own mute/video state from server
          const me = parts.find(p => p.id === pid);
          if (me) {
            setIsMuted(me.is_muted);
            setIsVideoOn(me.is_video_on);
          }

          // Trigger mesh signaling check
          triggerMeshSignaling(ws, parts);
        } else if (msg.type === 'new_message') {
          const m = msg.data;
          setMessages(prev => {
            if (prev.some(x => x.id === m.id)) return prev;
            return [
              ...prev,
              {
                id: m.id,
                name: m.sender_name,
                time: new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                text: m.text,
              },
            ];
          });
        } else if (msg.type === 'meeting_ended') {
          cleanup();
          showToast('This meeting has been ended by the host.', 'error');
          setTimeout(() => router.push('/'), 2500);
        } else if (msg.type === 'participant_removed') {
          if (msg.participant_id === localPidRef.current) {
            cleanup();
            showToast('You have been removed from the meeting.', 'error');
            setTimeout(() => router.push('/'), 2500);
          }
        } else if (msg.type === 'reaction') {
          spawnReaction(msg.data.emoji);
        } else if (msg.type === 'screen_share_status') {
          const { participant_id, is_sharing } = msg;
          console.log(`[ScreenShare] Received screen_share_status: participant ${participant_id} is sharing: ${is_sharing}`);
          setScreensharingParticipants(prev => ({
            ...prev,
            [participant_id]: is_sharing
          }));
        } else if (msg.type === 'request_screen_share_status') {
          console.log(`[ScreenShare] Received request_screen_share_status`);
          if (isScreenSharingRef.current && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'screen_share_status',
              participant_id: localPidRef.current,
              is_sharing: true
            }));
          }
        } else if (msg.type === 'webrtc-offer' && msg.target_id === localPidRef.current) {
          console.log(`[WebRTC] Received offer from peer ${msg.sender_id}`);
          const pc = getOrCreatePC(msg.sender_id, ws);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

            // Drain buffered ICE candidates
            const buffer = iceBufferRef.current[msg.sender_id] || [];
            while (buffer.length > 0) {
              const cand = buffer.shift();
              if (cand) {
                try {
                  console.log(`[WebRTC] Draining buffered ICE candidate for peer ${msg.sender_id}`);
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (err) {
                  console.warn('[WebRTC] Error adding buffered ICE candidate:', err);
                }
              }
            }
            delete iceBufferRef.current[msg.sender_id];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({
              type: 'webrtc-answer',
              sender_id: localPidRef.current,
              target_id: msg.sender_id,
              sdp: answer
            }));
          } catch (e) {
            console.error('[WebRTC] Offer processing error:', e);
          }
        } else if (msg.type === 'webrtc-answer' && msg.target_id === localPidRef.current) {
          console.log(`[WebRTC] Received answer from peer ${msg.sender_id}`);
          const pc = pcsRef.current[msg.sender_id];
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

              // Drain buffered ICE candidates
              const buffer = iceBufferRef.current[msg.sender_id] || [];
              while (buffer.length > 0) {
                const cand = buffer.shift();
                if (cand) {
                  try {
                    console.log(`[WebRTC] Draining buffered ICE candidate for peer ${msg.sender_id}`);
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (err) {
                    console.warn('[WebRTC] Error adding buffered ICE candidate:', err);
                  }
                }
              }
              delete iceBufferRef.current[msg.sender_id];
            } catch (e) {
              console.error('[WebRTC] Answer processing error:', e);
            }
          }
        } else if (msg.type === 'webrtc-ice' && msg.target_id === localPidRef.current) {
          console.log(`[WebRTC] Received ICE candidate from peer ${msg.sender_id}`);
          const pc = pcsRef.current[msg.sender_id];
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } catch (e) {
              console.error('[WebRTC] ICE candidate addition error:', e);
            }
          } else {
            console.log(`[WebRTC] Buffering ICE candidate from peer ${msg.sender_id} (PC or remoteDesc not ready)`);
            if (!iceBufferRef.current[msg.sender_id]) {
              iceBufferRef.current[msg.sender_id] = [];
            }
            iceBufferRef.current[msg.sender_id].push(msg.candidate);
          }
        }
      } catch (err) {
        console.error('[WS] Message parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };

    ws.onclose = () => {
      console.log('[WS] Connection closed');
    };

    // 3. Heartbeat ping every 30 s to keep connection alive
    pingRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000);

    return () => {
      ws.close();
      if (pingRef.current) clearInterval(pingRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasJoined, loading, meetingId, mediaReady]);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const cleanup = useCallback(() => {
    sessionStorage.removeItem(`p_id_${meetingId}`);
    sessionStorage.removeItem(`p_name_${meetingId}`);
    sessionStorage.removeItem(`host_of_${meetingId}`);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
  }, [meetingId]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    const isHost = participants.find(p => p.id === localParticipantId)?.role === 'host';
    try {
      if (isHost) {
        await api.updateMeeting(meetingId, { status: 'ended' });
      } else if (localParticipantId) {
        await api.removeParticipant(localParticipantId);
      }
    } catch (e) { console.error(e); }
    cleanup();
    router.push('/');
  }, [meetingId, router, participants, localParticipantId, cleanup]);

  const handleMuteAll = async () => {
    try { await api.muteAll(meetingId); } catch {}
  };

  const handleRemoveParticipant = async (pid: number) => {
    try { await api.removeParticipant(pid); } catch {}
  };

  const handleToggleMute = async () => {
    const next = !isMuted;
    setIsMuted(next);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
    if (localParticipantId) {
      try { await api.updateParticipant(localParticipantId, { is_muted: next }); } catch {}
    }
  };

  const handleToggleVideo = async () => {
    const next = !isVideoOn;
    setIsVideoOn(next);
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
    if (localParticipantId) {
      try { await api.updateParticipant(localParticipantId, { is_video_on: next }); } catch {}
    }
  };

  const replaceVideoTrack = async (newTrack: MediaStreamTrack | null) => {
    for (const [peerIdStr, pc] of Object.entries(pcsRef.current)) {
      const peerId = Number(peerIdStr);
      try {
        const videoTransceiver = pc.getTransceivers().find(t => t.receiver.track.kind === "video");
        const sender = videoTransceiver?.sender;
        if (sender) {
          await sender.replaceTrack(newTrack);
          console.log(`[WebRTC] Successfully replaced video track on sender for peer ${peerId}`);
        } else {
          console.warn(`[WebRTC] Video sender not found for peer ${peerId}`);
        }
      } catch (e) {
        console.warn(`[WebRTC] replaceVideoTrack failed for peer ${peerId}`, e);
      }
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      screenTrackRef.current?.stop();
      const cam = originalCamTrackRef.current;
      if (cam && localStreamRef.current) {
        const currentTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentTrack) localStreamRef.current.removeTrack(currentTrack);
        localStreamRef.current.addTrack(cam);
        await replaceVideoTrack(cam);
      }
      screenTrackRef.current = null;
      originalCamTrackRef.current = null;
      setIsScreenSharing(false);
      setLocalScreenStream(null);
      
      // Broadcast screen share stopped
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'screen_share_status',
          participant_id: localParticipantId,
          is_sharing: false
        }));
      }

      showToast('Screen sharing stopped', 'info');
      return;
    }

    if (!localStreamRef.current) return;
    try {
      const ds = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (c: object) => Promise<MediaStream> }).getDisplayMedia({ video: true, audio: false });
      const track = ds.getVideoTracks()[0];
      
      track.onended = () => {
        handleScreenShare();
      };
      
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      originalCamTrackRef.current = camTrack || null;
      if (camTrack) localStreamRef.current.removeTrack(camTrack);
      localStreamRef.current.addTrack(track);
      screenTrackRef.current = track;
      await replaceVideoTrack(track);
      setIsScreenSharing(true);
      setLocalScreenStream(ds);

      // Broadcast screen share started
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'screen_share_status',
          participant_id: localParticipantId,
          is_sharing: true
        }));
      }

      showToast('You are now sharing your screen', 'success');
    } catch (e) {
      console.warn("Screen share cancelled", e);
      showToast('Screen share cancelled', 'info');
    }
  };

  const handleReaction = async (emoji: string) => {
    setShowReactionBar(false);
    spawnReaction(emoji);
    try { await api.sendReaction(meetingId, { emoji, sender_name: localDisplayName || 'Guest' }); } catch {}
  };

  const handleCopyInvite = async (text: string, field: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedField(field); setTimeout(() => setCopiedField(null), 2000); } catch {}
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    const senderName = localDisplayName || 'Guest';
    setChatInput('');
    try {
      // No optimistic update — WebSocket broadcasts the message back instantly,
      // so adding it here too would cause every message to appear twice.
      await api.sendMessage(meetingId, { sender_name: senderName, text });
    } catch (err) {
      console.error('Send chat error:', err);
    }
  };

  const handleGuestJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) { setGuestJoinError('Please enter a display name'); return; }
    setGuestJoinError('');
    
    // Save to localStorage if "Remember my name" is selected
    if (rememberName) {
      localStorage.setItem('zoom_remembered_name', guestName.trim());
      localStorage.setItem('zoom_remember_name_flag', 'true');
    } else {
      localStorage.removeItem('zoom_remembered_name');
      localStorage.removeItem('zoom_remember_name_flag');
    }

    try {
      const part = await api.joinMeeting(meetingId, { display_name: guestName.trim() });
      sessionStorage.setItem(`p_id_${meetingId}`, part.id.toString());
      sessionStorage.setItem(`p_name_${meetingId}`, guestName.trim());
      setLocalParticipantId(part.id);
      setLocalDisplayName(guestName.trim());
      setHasJoined(true);
    } catch (err: unknown) {
      setGuestJoinError(err instanceof Error ? err.message : 'Could not join meeting. Try again.');
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const gridClass =
    participants.length <= 1 ? 'grid-1' :
    participants.length === 2 ? 'grid-2' :
    participants.length <= 4 ? 'grid-3-4' : 'grid-5-plus';

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="meeting-room" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', fontSize: '16px', opacity: 0.7 }}>Connecting to meeting…</div>
      </div>
    );
  }

  // ── Name entry overlay ──────────────────────────────────────────────────────
  if (!hasJoined) {
    return (
      <div className="zoom-lobby-screen">
        <div className="zoom-lobby-header">
          <button className="back-link" onClick={() => router.push('/')}>
            <span className="material-symbols-outlined back-arrow">chevron_left</span> Back
          </button>
        </div>

        <div className="zoom-lobby-split-container">
          {/* Left Column: Webcam preview */}
          <div className="zoom-lobby-left">
            <div className="zoom-lobby-webcam-box">
              <video
                ref={lobbyVideoRef}
                autoPlay
                playsInline
                muted
                className={`lobby-preview-video ${lobbyVideoOff ? 'video-off' : ''}`}
              />
              {lobbyVideoOff && (
                <div className="lobby-preview-fallback">
                  <span className="material-symbols-outlined camera-placeholder">videocam_off</span>
                </div>
              )}
              {/* Floating Controls Overlay at bottom center */}
              <div className="lobby-webcam-controls">
                <button
                  className={`lobby-ctrl-btn ${lobbyMuted ? 'muted' : ''}`}
                  onClick={() => {
                    const next = !lobbyMuted;
                    setLobbyMuted(next);
                    if (lobbyStream) {
                      lobbyStream.getAudioTracks().forEach(t => t.enabled = !next);
                    }
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined">{lobbyMuted ? 'mic_off' : 'mic'}</span>
                  <span className="btn-chevron">^</span>
                  <div className="btn-label">{lobbyMuted ? 'Mute' : 'Mute'}</div>
                </button>
                <button
                  className={`lobby-ctrl-btn ${lobbyVideoOff ? 'muted' : ''}`}
                  onClick={() => {
                    const next = !lobbyVideoOff;
                    setLobbyVideoOff(next);
                    if (lobbyStream) {
                      lobbyStream.getVideoTracks().forEach(t => t.enabled = !next);
                    }
                  }}
                  type="button"
                >
                  <span className="material-symbols-outlined">{lobbyVideoOff ? 'videocam_off' : 'videocam'}</span>
                  <span className="btn-chevron">^</span>
                  <div className="btn-label">{lobbyVideoOff ? 'Start Video' : 'Stop Video'}</div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Enter Meeting Info */}
          <div className="zoom-lobby-right">
            <div className="zoom-lobby-form-card">
              <h1 className="lobby-form-title">Enter Meeting Info</h1>
              <form onSubmit={handleGuestJoinSubmit} className="lobby-joining-form">
                <div className="form-group-field">
                  <label htmlFor="passcode-input">Meeting Passcode</label>
                  <input
                    type="text"
                    id="passcode-input"
                    placeholder="Enter meeting passcode"
                    value={meetingPasscode}
                    onChange={e => setMeetingPasscode(e.target.value)}
                  />
                </div>

                <div className="form-group-field">
                  <label htmlFor="guest-name-input">Your Name</label>
                  <input
                    type="text"
                    id="guest-name-input"
                    placeholder="Enter display name"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    required
                  />
                </div>

                <label className="lobby-checkbox-container">
                  <input
                    type="checkbox"
                    checked={rememberName}
                    onChange={e => setRememberName(e.target.checked)}
                  />
                  <span className="checkbox-custom" />
                  <span className="checkbox-label">Remember my name for future meetings</span>
                </label>

                {guestJoinError && <p className="lobby-error-alert">{guestJoinError}</p>}

                <button
                  type="submit"
                  className={`lobby-submit-btn ${!guestName.trim() ? 'disabled' : ''}`}
                  disabled={!guestName.trim()}
                >
                  Join
                </button>
              </form>

              {/* Bottom Disclaimers */}
              <p className="lobby-disclaimer">
                By clicking "Join", you agree to our <span className="disclaimer-link">Terms of Service</span> and <span className="disclaimer-link">Privacy Statement</span>.
              </p>
              <p className="lobby-disclaimer sub">
                Zoom is protected by reCAPTCHA and their <span className="disclaimer-link">Privacy Policy</span> and <span className="disclaimer-link">Terms of Service</span> apply.
              </p>
            </div>
          </div>
        </div>

        <div className="zoom-lobby-footer">
          © 2026 Zoom Communications, Inc. All rights reserved. <span className="footer-link">Privacy & Legal Policies</span> | <span className="footer-link">Send Report</span>
        </div>
      </div>
    );
  }

  const amHost = participants.find(p => p.id === localParticipantId)?.role === 'host';

  const activeScreenSharer = isScreenSharing
    ? { id: localParticipantId, display_name: 'Your Screen', isLocal: true }
    : (() => {
        const remoteSharer = participants.find(p => screensharingParticipants[p.id]);
        return remoteSharer ? { ...remoteSharer, isLocal: false } : null;
      })();

  // ── Main meeting room ───────────────────────────────────────────────────────
  return (
    <div className="meeting-room">
      {/* Header */}
      <div className="meeting-room-header">
        <div className="meeting-info">
          <div style={{
            padding: 3,
            backgroundColor: '#10B981',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 4
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#fff', fontVariationSettings: "'FILL' 1" }}>verified_user</span>
          </div>
          <span className="meeting-title">{meeting?.title || 'Zoom Meeting'}</span>
          <span className="meeting-id-badge">{meetingId}</span>
        </div>
        <div className="header-controls">
          <span className="security-badge">
            <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>verified_user</span>
            Encrypted
          </span>
          {/* WS indicator */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: '#10B981', fontSize: 11, fontWeight: 600,
            background: 'rgba(16,185,129,0.12)', padding: '4px 10px', borderRadius: 6,
            border: '1px solid rgba(16,185,129,0.2)'
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#10B981', display: 'inline-block',
            }} />
            Live
          </span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>
            {formatElapsed(elapsed)}
          </span>
        </div>
      </div>

      {/* Toasts */}
      <ToastContainer toasts={toasts} />

      {/* Body */}
      <div className="meeting-room-body">
        <div className="video-area" style={{ position: 'relative' }}>
          {/* Floating reactions layer */}
          <div className="reaction-layer">
            {reactions.map(r => (
              <span key={r.id} className="reaction-float" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
          {/* Reaction picker */}
          {showReactionBar && (
            <div className="reaction-bar">
              {REACTION_EMOJIS.map(e => (
                <button key={e} className="reaction-btn" onClick={() => handleReaction(e)}>{e}</button>
              ))}
            </div>
          )}
          {activeScreenSharer ? (
            <div className="presentation-layout">
              {/* Screen Share Stage */}
              <div className="screen-share-stage">
                {activeScreenSharer.isLocal ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0d14', borderRadius: 'inherit', overflow: 'hidden' }}>
                    {localScreenStream ? (
                      <video
                        ref={(el) => {
                          if (el) {
                            if (el.srcObject !== localScreenStream) {
                              el.srcObject = localScreenStream;
                            }
                            el.play().catch(err => console.log("[LocalStageVideo] play error:", err));
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }}
                      />
                    ) : (
                      <div className="local-presenting-placeholder" style={{ background: 'transparent' }}>
                        <span className="material-symbols-outlined play-glow">screen_share</span>
                        <h3>You are presenting to everyone</h3>
                        <p>Your screen is visible to other participants in this meeting.</p>
                        <button className="stop-presenting-btn" onClick={handleScreenShare}>
                          Stop sharing
                        </button>
                      </div>
                    )}
                    <div className="local-presenting-overlay-banner">
                      <span className="live-dot animate-pulse"></span>
                      <span>You are presenting your screen</span>
                      <button className="stop-sharing-overlay-btn" onClick={handleScreenShare}>
                        Stop sharing
                      </button>
                    </div>
                  </div>
                ) : (
                  <video
                    ref={(el) => {
                      if (el && activeScreenSharer.id !== null) {
                        const stream = remoteStreams[activeScreenSharer.id];
                        if (stream) {
                          if (el.srcObject !== stream) {
                            el.srcObject = stream;
                          }
                          el.play().catch(err => console.log("[StageVideo] play error:", err));
                          
                          // Trigger playback robustly when active screen sharing frames start flowing
                          const vt = stream.getVideoTracks()[0];
                          if (vt) {
                            vt.onunmute = () => {
                              el.play().catch(err => console.log("[StageVideo] onunmute play error:", err));
                            };
                          }
                        }
                      }
                    }}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }}
                  />
                )}
                <span className="screen-share-label">
                  🖥️ {activeScreenSharer.isLocal ? 'Your Screen' : `${activeScreenSharer.display_name}'s Screen`}
                </span>
              </div>

              {/* Participant Strip */}
              <div className="participant-strip">
                {participants.map((p, i) => {
                  const isCurrentSharer = p.id === activeScreenSharer.id;
                  return (
                    <div
                      key={`${p.id}-${i}`}
                      className={`video-tile strip-tile ${i === 0 ? 'speaking' : ''} ${!p.is_video_on || isCurrentSharer ? 'video-off' : ''}`}
                    >
                      {/* Microphone state indicator bubble */}
                      <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 5,
                        padding: 4,
                        borderRadius: '50%',
                        backgroundColor: p.is_muted ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.15)'
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#fff', fontVariationSettings: "'FILL' 1" }}>
                          {p.is_muted ? 'mic_off' : 'mic'}
                        </span>
                      </div>

                      {isCurrentSharer ? (
                        <div className="avatar-circle presenting" style={{ background: 'var(--zoom-blue)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#fff', marginBottom: 4 }}>screen_share</span>
                          <div style={{ fontSize: 11, color: '#fff', opacity: 0.8 }}>Presenting</div>
                        </div>
                      ) : p.id === localParticipantId ? (
                        <>
                          <video
                            ref={(el) => {
                              (localVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                              if (el && localStreamRef.current) {
                                el.srcObject = localStreamRef.current;
                              }
                            }}
                            autoPlay
                            muted
                            playsInline
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: 'inherit',
                              display: p.is_video_on ? 'block' : 'none'
                            }}
                          />
                          {!p.is_video_on && <div className="avatar-circle">{getInitials(p.display_name)}</div>}
                        </>
                      ) : (
                        <>
                          {remoteStreams[p.id] && (
                            <video
                              id={`remote-video-${p.id}`}
                              ref={(el) => {
                                if (el && remoteStreams[p.id]) {
                                  el.srcObject = remoteStreams[p.id];
                                }
                              }}
                              autoPlay
                              playsInline
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: 'inherit',
                                display: p.is_video_on ? 'block' : 'none'
                              }}
                            />
                          )}
                          {!p.is_video_on && (
                            <div className="avatar-circle">{getInitials(p.display_name)}</div>
                          )}
                        </>
                      )}
                      <div className="tile-name">
                        {p.display_name}
                        {p.role === 'host' && ' (Host)'}
                        {p.id === localParticipantId && ' (Me)'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={`video-grid ${gridClass}`}>
              {participants.map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className={`video-tile ${i === 0 ? 'speaking' : ''} ${!p.is_video_on ? 'video-off' : ''}`}
                >
                  {/* Microphone state indicator bubble */}
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 5,
                    padding: 4,
                    borderRadius: '50%',
                    backgroundColor: p.is_muted ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#fff', fontVariationSettings: "'FILL' 1" }}>
                      {p.is_muted ? 'mic_off' : 'mic'}
                    </span>
                  </div>

                  {/* Show real camera for local participant */}
                  {p.id === localParticipantId ? (
                    <>
                      <video
                        ref={(el) => {
                          (localVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                          if (el && localStreamRef.current) {
                            el.srcObject = localStreamRef.current;
                          }
                        }}
                        autoPlay
                        muted
                        playsInline
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: 'inherit',
                          display: p.is_video_on ? 'block' : 'none'
                        }}
                      />
                      {!p.is_video_on && <div className="avatar-circle">{getInitials(p.display_name)}</div>}
                    </>
                  ) : (
                    <>
                      {remoteStreams[p.id] && (
                        <video
                          id={`remote-video-${p.id}`}
                          ref={(el) => {
                            if (el && remoteStreams[p.id]) {
                              el.srcObject = remoteStreams[p.id];
                            }
                          }}
                          autoPlay
                          playsInline
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 'inherit',
                            display: p.is_video_on ? 'block' : 'none'
                          }}
                        />
                      )}
                      {!p.is_video_on && (
                        <div className="avatar-circle">{getInitials(p.display_name)}</div>
                      )}
                    </>
                  )}
                  <div className="tile-name">
                    {p.display_name}
                    {p.role === 'host' && ' (Host)'}
                    {p.id === localParticipantId && ' (Me)'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participants Panel */}
        {showParticipants && (
          <div className="side-panel">
            <div className="side-panel-header">
              <h3>Participants ({participants.length})</h3>
              <button className="side-panel-close" onClick={() => setShowParticipants(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            {amHost && (
              <div className="host-controls">
                <button className="host-controls-btn" onClick={handleMuteAll}>
                  Mute All Participants
                </button>
              </div>
            )}
            <div className="side-panel-body">
              {participants.map((p, i) => (
                <div className="participant-item" key={`${p.id}-${i}`}>
                  <div className="participant-avatar">{getInitials(p.display_name)}</div>
                  <span className="participant-name">
                    {p.display_name}
                    {p.id === localParticipantId && ' (Me)'}
                    {p.role === 'host' && <span className="participant-role"> (Host)</span>}
                  </span>
                  <div className="participant-controls">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: p.is_muted ? '#ef4444' : '#10B981' }}>
                      {p.is_muted ? 'mic_off' : 'mic'}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: p.is_video_on ? '#10B981' : '#ef4444' }}>
                      {p.is_video_on ? 'videocam' : 'videocam_off'}
                    </span>
                    {amHost && p.role !== 'host' && (
                      <button
                        className="participant-ctrl-btn"
                        title="Remove"
                        onClick={() => handleRemoveParticipant(p.id)}
                        style={{ marginLeft: 10, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div className="side-panel">
            <div className="side-panel-header">
              <h3>Meeting Chat</h3>
              <button className="side-panel-close" onClick={() => setShowChat(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
                  No messages yet. Say hello! 👋
                </p>
              )}
              {messages.map((msg, i) => (
                <div className="chat-msg" key={msg.id ?? i}>
                  <div className="chat-msg-header">
                    <span className="chat-msg-name">{msg.name}</span>
                    <span className="chat-msg-time">{msg.time}</span>
                  </div>
                  <div className="chat-msg-text">{msg.text}</div>
                </div>
              ))}
            </div>
            <form className="chat-input-area" onSubmit={handleSendChat}>
              <input
                className="chat-input"
                placeholder="To: Everyone"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button type="submit" className="chat-send">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              </button>
            </form>
          </div>
        )}

        {/* Invite Panel */}
        {showInvite && (
          <div className="side-panel">
            <div className="side-panel-header">
              <h3>Meeting Info</h3>
              <button className="side-panel-close" onClick={() => setShowInvite(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="side-panel-body" style={{ padding: 0 }}>
              <div className="invite-row">
                <div className="invite-label">Meeting ID</div>
                <div className="invite-value">
                  <span>{meetingId}</span>
                  <button className={`invite-copy-btn ${copiedField==='id'?'copied':''}`} onClick={() => handleCopyInvite(meetingId,'id')}>{copiedField==='id'?'✓ Copied':'Copy'}</button>
                </div>
              </div>
              <div className="invite-row">
                <div className="invite-label">Passcode</div>
                <div className="invite-value">
                  <span>{meeting?.passcode || '——'}</span>
                  <button className={`invite-copy-btn ${copiedField==='pass'?'copied':''}`} onClick={() => handleCopyInvite(meeting?.passcode||'','pass')}>{copiedField==='pass'?'✓ Copied':'Copy'}</button>
                </div>
              </div>
              <div className="invite-row">
                <div className="invite-label">Invite Link</div>
                <div className="invite-value" style={{ flexDirection:'column', alignItems:'flex-start', gap:8 }}>
                  <span style={{ fontSize:11, wordBreak:'break-all' }}>{meeting?.invite_link || `${typeof window!=='undefined'?window.location.origin:''}/meeting/${meetingId}`}</span>
                  <button className={`invite-copy-btn ${copiedField==='link'?'copied':''}`} onClick={() => handleCopyInvite(meeting?.invite_link||`${window.location.origin}/meeting/${meetingId}`,'link')}>{copiedField==='link'?'✓ Copied':'Copy Link'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="control-bar">
        <button className={`control-btn ${isMuted ? 'muted' : ''}`} onClick={handleToggleMute}>
          <div className="ctrl-icon">
            <span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span>
          </div>
          <div className="ctrl-label">{isMuted ? 'Unmute' : 'Mute'}</div>
        </button>
        <button className={`control-btn ${!isVideoOn ? 'muted' : ''}`} onClick={handleToggleVideo}>
          <div className="ctrl-icon">
            <span className="material-symbols-outlined">{isVideoOn ? 'videocam' : 'videocam_off'}</span>
          </div>
          <div className="ctrl-label">{isVideoOn ? 'Stop Video' : 'Start Video'}</div>
        </button>

        <div className="control-divider"></div>

        <button className={`control-btn ${showParticipants ? 'active' : ''}`} onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); setShowInvite(false); }}>
          <div className="ctrl-icon">
            <span className="material-symbols-outlined">group</span>
          </div>
          <div className="ctrl-label">Participants ({participants.length})</div>
        </button>
        <button className={`control-btn ${showChat ? 'active' : ''}`} onClick={() => { setShowChat(!showChat); setShowParticipants(false); setShowInvite(false); }}>
          <div className="ctrl-icon">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: showChat ? "'FILL' 1" : "'FILL' 0" }}>chat</span>
          </div>
          <div className="ctrl-label">Chat</div>
        </button>
        <button className={`control-btn ${isScreenSharing ? 'screen-sharing' : ''}`} onClick={handleScreenShare}>
          <div className="ctrl-icon">
            <span className="material-symbols-outlined" style={{ color: isScreenSharing ? '#10B981' : 'inherit' }}>screen_share</span>
          </div>
          <div className="ctrl-label">{isScreenSharing ? 'Stop Share' : 'Share Screen'}</div>
        </button>
        <button className={`control-btn ${showReactionBar ? 'active' : ''}`} onClick={() => setShowReactionBar(r => !r)}>
          <div className="ctrl-icon">
            <span className="material-symbols-outlined">add_reaction</span>
          </div>
          <div className="ctrl-label">React</div>
        </button>
        <button className={`control-btn ${showInvite ? 'active' : ''}`} onClick={() => { setShowInvite(!showInvite); setShowChat(false); setShowParticipants(false); }}>
          <div className="ctrl-icon">
            <span className="material-symbols-outlined">link</span>
          </div>
          <div className="ctrl-label">Invite</div>
        </button>

        <div className="control-divider"></div>

        <button className="control-btn end-call" onClick={handleEndCall}>
          <div className="ctrl-label">{amHost ? 'End' : 'Leave'}</div>
        </button>
      </div>
    </div>
  );
}
