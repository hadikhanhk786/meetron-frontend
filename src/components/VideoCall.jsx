import React, { useRef, useEffect, useState, lazy, Suspense } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret
} from "../utils/encryption";

const ChatPanel = lazy(() => import('./ChatPanel'));

let socket;

export default function VideoCall({ roomId, onLeave, onShare }) {
  const [peers, setPeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharingUserId, setScreenSharingUserId] = useState(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [userName, setUserName] = useState("");
  
  const localVideo = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const screenStreamRef = useRef();
  const keyPairRef = useRef();
  const videoSenderRef = useRef(new Map());

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    
    socket = io("https://meetron-backend.onrender.com");
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    try {
      keyPairRef.current = await generateECDHKeyPair();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      streamRef.current = stream;
      localVideo.current.srcObject = stream;
      
      const name = `User ${Math.floor(Math.random() * 1000)}`;
      setUserName(name);
      
      socket.emit("join-room", { roomId, userName: name });
      setConnectionStatus("Connected");

      // Handle existing users in the room
      socket.on("existing-users", (existingUsers) => {
        console.log("Existing users:", existingUsers);
        existingUsers.forEach(user => {
          createPeer(user.userId, stream, true, user.userName, user.isScreenSharing);
        });
      });

      // Handle new user joining
      socket.on("user-joined", ({ userId, userName: newUserName }) => {
        console.log("New user joined:", userId);
        createPeer(userId, stream, false, newUserName, false);
      });

      // Handle signaling
      socket.on("signal", ({ signal, from }) => {
        const item = peersRef.current.find(p => p.peerID === from);
        if (item && item.peer) {
          item.peer.signal(signal);
        }
      });

      // Handle key exchange
      socket.on("key-exchange", async ({ publicKey, from }) => {
        await setupEncryption(publicKey, from);
      });

      // Handle user leaving
      socket.on("user-left", (userId) => {
        console.log("User left:", userId);
        const peerObj = peersRef.current.find(p => p.peerID === userId);
        if (peerObj) {
          peerObj.peer.destroy();
          peersRef.current = peersRef.current.filter(p => p.peerID !== userId);
          setPeers(peersRef.current);
          
          if (screenSharingUserId === userId) {
            setScreenSharingUserId(null);
          }
        }
      });

      // Handle screen share status from peers
      socket.on("peer-screen-share-status", ({ userId, isSharing }) => {
        console.log(`User ${userId} screen sharing:`, isSharing);
        if (isSharing) {
          setScreenSharingUserId(userId);
        } else if (screenSharingUserId === userId) {
          setScreenSharingUserId(null);
        }
      });

      setIsEncrypted(true);

    } catch (error) {
      console.error("Error initializing call:", error);
      setConnectionStatus("Error: " + error.message);
    }
  };

  const createPeer = (userId, stream, initiator, peerUserName, isScreenSharing) => {
    // Check if peer already exists
    if (peersRef.current.find(p => p.peerID === userId)) {
      console.log("Peer already exists:", userId);
      return;
    }

    const peer = new Peer({
      initiator,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      }
    });

    peer.on("signal", (signal) => {
      socket.emit("signal", { roomId, signal, to: userId });
    });

    peer.on("stream", (remoteStream) => {
      console.log("Received stream from:", userId);
      setPeers(prev => {
        const exists = prev.find(p => p.peerID === userId);
        if (exists) return prev;
        return [...prev, { peerID: userId, peer, stream: remoteStream, userName: peerUserName, isScreenSharing }];
      });
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
    });

    peer.on("close", () => {
      console.log("Peer closed:", userId);
    });

    // Setup data channel for chat
    if (initiator) {
      try {
        const dataChannel = peer._pc.createDataChannel("chat");
        setupDataChannel(dataChannel, userId);
      } catch (err) {
        console.error("Error creating data channel:", err);
      }
    } else {
      peer._pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, userId);
      };
    }

    // Store video sender for screen sharing
    if (peer._pc) {
      const senders = peer._pc.getSenders();
      const videoSender = senders.find(sender => sender.track?.kind === 'video');
      if (videoSender) {
        videoSenderRef.current.set(userId, videoSender);
      }
    }

    const peerObj = {
      peerID: userId,
      peer,
      userName: peerUserName,
      isScreenSharing
    };

    peersRef.current.push(peerObj);
  };

  const setupDataChannel = (channel, userId) => {
    channel.onopen = () => {
      console.log("Data channel opened with:", userId);
    };

    channel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "chat") {
        const newMessage = {
          text: data.message,
          sender: "peer",
          userName: data.userName || "User",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, newMessage]);
        
        if (!isChatOpen) {
          setUnreadCount(prev => prev + 1);
        }
      }
    };

    // Store channel reference
    const peerObj = peersRef.current.find(p => p.peerID === userId);
    if (peerObj) {
      peerObj.dataChannel = channel;
    }
  };

  const sendChatMessage = (message) => {
    peersRef.current.forEach(({ dataChannel }) => {
      if (dataChannel && dataChannel.readyState === "open") {
        const data = JSON.stringify({
          type: "chat",
          message: message,
          userName: userName
        });
        dataChannel.send(data);
      }
    });
    
    const newMessage = {
      text: message,
      sender: "me",
      userName: "You",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const setupEncryption = async (peerPublicKeyBase64, userId) => {
    try {
      const peerPublicKey = await importPublicKey(peerPublicKeyBase64);
      const sharedSecret = await deriveSharedSecret(
        keyPairRef.current.privateKey,
        peerPublicKey
      );

      console.log("Encryption established with:", userId);
    } catch (error) {
      console.error("Encryption setup error:", error);
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen) {
      setUnreadCount(0);
    }
  };

  const startScreenShare = async () => {
    if (isMobile) {
      alert("Screen sharing is not supported on mobile browsers.");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      localVideo.current.srcObject = screenStream;

      // Replace video track for all peers
      videoSenderRef.current.forEach(async (sender) => {
        if (sender) {
          await sender.replaceTrack(screenTrack);
        }
      });

      setIsScreenSharing(true);
      socket.emit("screen-share-status", { roomId, isSharing: true });

      screenTrack.onended = () => {
        stopScreenShare();
      };

    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const videoTrack = streamRef.current.getVideoTracks()[0];
      localVideo.current.srcObject = streamRef.current;

      videoSenderRef.current.forEach(async (sender) => {
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      });

      setIsScreenSharing(false);
      socket.emit("screen-share-status", { roomId, isSharing: false });
      screenStreamRef.current = null;

    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  const cleanup = () => {
    console.log("Cleaning up...");
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    peersRef.current.forEach(({ peer }) => {
      if (peer) peer.destroy();
    });
    
    if (socket) {
      socket.disconnect();
    }
  };

  const handleEndCall = () => {
    cleanup();
    if (onLeave) {
      onLeave();
    } else {
      window.location.reload();
    }
  };

  // Find screen sharing peer
  const screenSharingPeer = peers.find(p => p.peerID === screenSharingUserId);
  const isRemoteSharingLayout = screenSharingUserId && !isScreenSharing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        
        {/* Status Bar */}
        <div className="mb-6 flex justify-center">
          <div className="bg-white/10 backdrop-blur-xl rounded-full px-6 py-3 border border-white/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-white text-sm font-medium">{connectionStatus}</span>
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-white/30">
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span className="text-blue-400 text-sm font-medium">{peers.length + 1} participants</span>
              </div>
              {isEncrypted && (
                <div className="flex items-center gap-2 pl-4 border-l border-white/30">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-400 text-sm font-medium">E2E Encrypted</span>
                </div>
              )}
              {(isScreenSharing || screenSharingUserId) && (
                <div className="flex items-center gap-2 pl-4 border-l border-white/30">
                  <svg className="w-4 h-4 text-blue-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-blue-400 text-sm font-medium">
                    {isScreenSharing ? 'Sharing Screen' : 'Someone is Sharing'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video Grid */}
        <div className={`mb-8 ${isRemoteSharingLayout ? 'flex flex-col gap-4' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'}`}>
          
          {/* Screen Sharing View - Large */}
          {isRemoteSharingLayout && screenSharingPeer && (
            <div className="relative group w-full">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-50"></div>
              <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-1 shadow-2xl border border-white/20">
                <video
                  autoPlay
                  playsInline
                  ref={ref => {
                    if (ref && screenSharingPeer.stream) {
                      ref.srcObject = screenSharingPeer.stream;
                    }
                  }}
                  className="w-full rounded-xl object-contain aspect-video bg-gray-900"
                />
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
                  <p className="text-white text-sm font-semibold">{screenSharingPeer.userName}'s Screen</p>
                </div>
              </div>
            </div>
          )}

          {/* Local Video */}
          <div className={`relative group ${isRemoteSharingLayout ? 'max-w-xs' : ''}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-300"></div>
            <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-1 shadow-2xl border border-white/20 transform hover:scale-105 transition duration-300">
              <video
                ref={localVideo}
                autoPlay
                muted
                playsInline
                className={`w-full h-full rounded-xl object-cover aspect-video bg-gray-900 ${!isScreenSharing ? 'scale-x-[-1]' : ''}`}
              />
              <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
                <p className="text-white text-xs font-semibold">{isScreenSharing ? 'Your Screen' : 'You'}</p>
              </div>
              {isVideoOff && !isScreenSharing && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-xl">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg className="w-8 h-8 text-white/60" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-white/60 text-xs">Camera Off</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Remote Videos */}
          {peers.filter(p => !isRemoteSharingLayout || p.peerID !== screenSharingUserId).map((peer) => (
            <div key={peer.peerID} className={`relative group ${isRemoteSharingLayout ? 'max-w-xs' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-300"></div>
              <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-1 shadow-2xl border border-white/20 transform hover:scale-105 transition duration-300">
                <video
                  autoPlay
                  playsInline
                  ref={ref => {
                    if (ref && peer.stream) {
                      ref.srcObject = peer.stream;
                    }
                  }}
                  className="w-full h-full rounded-xl object-cover aspect-video bg-gray-900"
                />
                <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
                  <p className="text-white text-xs font-semibold">{peer.userName}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Control Panel */}
        <div className="flex justify-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full blur-lg opacity-60"></div>
            <div className="relative bg-white/10 backdrop-blur-xl rounded-full px-8 py-4 shadow-2xl border border-white/30">
              <div className="flex items-center gap-4 md:gap-6">
                
                <button
                  onClick={toggleMute}
                  className={`p-3 md:p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                    isMuted ? "bg-red-500/80" : "bg-white/20"
                  } backdrop-blur-md border border-white/20 shadow-lg`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    {isMuted ? (
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    )}
                  </svg>
                </button>

                <button
                  onClick={toggleVideo}
                  disabled={isScreenSharing}
                  className={`p-3 md:p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                    isVideoOff ? "bg-red-500/80" : "bg-white/20"
                  } backdrop-blur-md border border-white/20 shadow-lg ${isScreenSharing ? 'opacity-50' : ''}`}
                  title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    {isVideoOff ? (
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367z" clipRule="evenodd" />
                    ) : (
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    )}
                  </svg>
                </button>

                <button
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  disabled={isMobile}
                  className={`p-3 md:p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                    isScreenSharing ? "bg-blue-500/80" : "bg-white/20"
                  } backdrop-blur-md border border-white/20 shadow-lg ${isMobile ? 'opacity-50' : ''}`}
                  title={isScreenSharing ? "Stop sharing" : "Share screen"}
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z" clipRule="evenodd" />
                  </svg>
                </button>

                <button
                  onClick={toggleChat}
                  className="relative p-3 md:p-4 rounded-full transition-all duration-300 transform hover:scale-110 bg-white/20 backdrop-blur-md border border-white/20 shadow-lg"
                  title="Chat"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleEndCall}
                  className="p-3 md:p-4 rounded-full bg-red-600/90 hover:bg-red-700 transition-all duration-300 transform hover:scale-110 backdrop-blur-md border border-white/20 shadow-lg"
                  title="End call"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <Suspense fallback={<div></div>}>
          <ChatPanel
            messages={messages}
            onSendMessage={sendChatMessage}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
        </Suspense>
      </div>
    </div>
  );
}
