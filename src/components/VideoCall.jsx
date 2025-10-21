import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  lazy,
  Suspense,
} from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
} from "../utils/encryption";
import BuildVersion from "./BuildVersion";

// Code splitting - lazy load components
const ChatPanel = lazy(() => import("./ChatPanel"));
const VideoGrid = lazy(() => import("./VideoGrid"));
const ControlPanel = lazy(() => import("./ControlPanel"));
const StatusBar = lazy(() => import("./StatusBar"));

let socket;

export default function VideoCall({
  roomId,
  userName: userNameProp,
  onLeave,
  onShare,
}) {
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
  const [isAndroid, setIsAndroid] = useState(false);
  const [userName, setUserName] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [isHost, setIsHost] = useState(false);

  const localVideo = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const screenStreamRef = useRef();
  const keyPairRef = useRef();
  const videoSenderRef = useRef(new Map());
  const socketInitialized = useRef(false);

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent;
      const mobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
      const android = /Android/i.test(userAgent);

      setIsMobile(mobile);
      setIsAndroid(android);
    };
    checkDevice();

    if (!socketInitialized.current) {
      socket = io("https://meetron-backend.onrender.com", {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        transports: ["websocket", "polling"],
      });
      socketInitialized.current = true;
    }

    initializeCall();

    return () => {
      cleanup();
    };
  }, [roomId]);

  const initializeCall = async () => {
    try {
      keyPairRef.current = await generateECDHKeyPair();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }

      const name = userNameProp || `User ${Math.floor(Math.random() * 1000)}`;
      setUserName(name);

      socket.emit("join-room", { roomId, userName: name });
      setConnectionStatus("Connected");
      setIsEncrypted(true);

      // Host status
      socket.on("host-status", ({ isHost: hostStatus }) => {
        console.log("👑 Host status:", hostStatus);
        setIsHost(hostStatus);
      });

      // Room state for late joiners - CRITICAL FOR STATE SYNC
      socket.on(
        "room-state",
        ({ totalUsers, screenSharingUser, mutedUsers }) => {
          console.log("📊 Received room state:", {
            totalUsers,
            screenSharingUser,
            mutedUsers,
          });

          // Set screen sharing user if exists
          if (screenSharingUser) {
            console.log(
              `📺 Setting screen sharing user: ${screenSharingUser.userName}`
            );
            setScreenSharingUserId(screenSharingUser.userId);
          }

          // Mark muted users
          if (mutedUsers.length > 0) {
            console.log(`🔇 Muted users:`, mutedUsers);
            mutedUsers.forEach(({ userId }) => {
              setPeers((prevPeers) =>
                prevPeers.map((peer) =>
                  peer.peerID === userId ? { ...peer, isMuted: true } : peer
                )
              );
            });
          }
        }
      );

      socket.on("existing-users", (existingUsers) => {
        console.log("📋 Existing users with states:", existingUsers);
        setParticipantCount(existingUsers.length + 1);

        existingUsers.forEach((user) => {
          if (!peersRef.current.find((p) => p.peerID === user.userId)) {
            // Create peer with existing state
            createPeer(
              user.userId,
              stream,
              true,
              user.userName,
              user.isScreenSharing,
              user.isHost,
              user.isMuted
            );

            // Set screen sharing if this user is sharing
            if (user.isScreenSharing) {
              console.log(`📺 User ${user.userName} is sharing screen on join`);
              setScreenSharingUserId(user.userId);
            }
          }
        });
      });

      socket.on(
        "user-joined",
        ({ userId, userName: newUserName, isHost: userIsHost }) => {
          console.log("👤 New user joined:", userId, newUserName);

          if (!peersRef.current.find((p) => p.peerID === userId)) {
            createPeer(
              userId,
              stream,
              false,
              newUserName,
              false,
              userIsHost,
              false
            );
            setParticipantCount((prev) => prev + 1);

            // Send current state to new user via backend
            if (isScreenSharing) {
              console.log("📤 Sending screen share state to new user");
              socket.emit("screen-share-status", { roomId, isSharing: true });
            }
            if (isMuted) {
              console.log("📤 Sending mute state to new user");
              socket.emit("mute-status", { roomId, isMuted: true });
            }
          }
        }
      );

      socket.on("signal", ({ signal, from }) => {
        const item = peersRef.current.find((p) => p.peerID === from);
        if (item && item.peer && !item.peer.destroyed) {
          try {
            item.peer.signal(signal);
          } catch (error) {
            console.error("Signal error:", error);
          }
        }
      });

      socket.on("key-exchange", async ({ publicKey, from }) => {
        await setupEncryption(publicKey, from);
      });

      socket.on("user-left", (userId) => {
        console.log("👋 User left:", userId);
        handleUserLeft(userId);
      });

      // Screen share status updates
      socket.on(
        "peer-screen-share-status",
        ({ userId, userName: sharingUserName, isSharing }) => {
          console.log(
            `📺 Screen share status update: ${sharingUserName} (${userId}) - ${isSharing}`
          );

          if (isSharing) {
            setScreenSharingUserId(userId);
          } else if (screenSharingUserId === userId) {
            setScreenSharingUserId(null);
          }

          setPeers((prevPeers) =>
            prevPeers.map((peer) =>
              peer.peerID === userId
                ? { ...peer, isScreenSharing: isSharing }
                : peer
            )
          );
        }
      );

      // Mute status updates
      socket.on(
        "peer-mute-status",
        ({ userId, userName: mutedUserName, isMuted: peerMuted }) => {
          console.log(
            `🔇 Mute status update: ${mutedUserName} (${userId}) - ${peerMuted}`
          );

          setPeers((prevPeers) =>
            prevPeers.map((peer) =>
              peer.peerID === userId ? { ...peer, isMuted: peerMuted } : peer
            )
          );
        }
      );

      // Peer state response
      socket.on(
        "peer-state-response",
        ({
          userId,
          userName: peerUserName,
          isMuted: peerMuted,
          isScreenSharing: peerSharing,
          isHost: peerIsHost,
        }) => {
          console.log(`📡 Received peer state for ${peerUserName}:`, {
            isMuted: peerMuted,
            isScreenSharing: peerSharing,
          });

          setPeers((prevPeers) =>
            prevPeers.map((peer) =>
              peer.peerID === userId
                ? {
                    ...peer,
                    isMuted: peerMuted,
                    isScreenSharing: peerSharing,
                    isHost: peerIsHost,
                  }
                : peer
            )
          );

          if (peerSharing) {
            setScreenSharingUserId(userId);
          }
        }
      );

      socket.on("new-host", ({ userId, userName: newHostName }) => {
        console.log(`👑 New host assigned: ${newHostName}`);
        setPeers((prevPeers) =>
          prevPeers.map((peer) =>
            peer.peerID === userId
              ? { ...peer, isHost: true }
              : { ...peer, isHost: false }
          )
        );
      });

      socket.on("kicked-from-room", ({ reason }) => {
        alert(reason);
        cleanup();
        if (onLeave) {
          onLeave();
        } else {
          window.location.reload();
        }
      });

      socket.on("kick-denied", ({ reason }) => {
        alert(reason);
      });
    } catch (error) {
      console.error("❌ Error initializing call:", error);
      setConnectionStatus("Error: " + error.message);
      alert("Failed to access camera/microphone. Please check permissions.");
    }
  };

  const createPeer = useCallback(
    (
      userId,
      stream,
      initiator,
      peerUserName,
      isScreenSharing,
      peerIsHost,
      initialMuted = false
    ) => {
      const existingPeer = peersRef.current.find((p) => p.peerID === userId);
      if (existingPeer) {
        console.log("⚠️ Peer already exists:", userId);
        return;
      }

      console.log(
        `🔗 Creating peer: ${peerUserName} (Muted: ${initialMuted}, Sharing: ${isScreenSharing})`
      );

      const peer = new Peer({
        initiator,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
          ],
        },
      });

      let dataChannelRef = null;

      peer.on("signal", (signal) => {
        socket.emit("signal", { roomId, signal, to: userId });
      });

      peer.on("stream", (remoteStream) => {
        console.log("✅ Received stream from:", peerUserName);

        const peerObj = {
          peerID: userId,
          peer,
          stream: remoteStream,
          userName: peerUserName,
          isScreenSharing,
          isMuted: initialMuted, // Use initial muted state
          isHost: peerIsHost || false,
          dataChannel: dataChannelRef,
        };

        setPeers((prevPeers) => {
          const exists = prevPeers.find((p) => p.peerID === userId);
          if (exists) {
            return prevPeers.map((p) =>
              p.peerID === userId
                ? {
                    ...p,
                    stream: remoteStream,
                    isScreenSharing,
                    isMuted: initialMuted,
                  }
                : p
            );
          }
          return [...prevPeers, peerObj];
        });

        // Request latest peer state after connection
        setTimeout(() => {
          socket.emit("request-peer-state", { peerId: userId });
        }, 500);
      });

      peer.on("connect", () => {
        console.log("🤝 Peer connected:", peerUserName);

        if (initiator && !dataChannelRef) {
          try {
            console.log("🔧 Creating data channel for:", peerUserName);
            const dataChannel = peer._pc.createDataChannel("chat", {
              ordered: true,
              maxRetransmits: 30,
            });
            dataChannelRef = dataChannel;
            setupDataChannel(dataChannel, userId, peerUserName);

            const peerObj = peersRef.current.find((p) => p.peerID === userId);
            if (peerObj) {
              peerObj.dataChannel = dataChannel;
            }
          } catch (err) {
            console.error("❌ Error creating data channel:", err);
          }
        }
      });

      peer.on("error", (err) => {
        console.error("❌ Peer error:", err);
        if (err.message && err.message.includes("Ice connection failed")) {
          handleUserLeft(userId);
        }
      });

      peer.on("close", () => {
        console.log("🔌 Peer closed:", userId);
        handleUserLeft(userId);
      });

      if (!initiator) {
        peer._pc.ondatachannel = (event) => {
          console.log("✅ Received data channel from:", peerUserName);
          dataChannelRef = event.channel;
          setupDataChannel(event.channel, userId, peerUserName);

          const peerObj = peersRef.current.find((p) => p.peerID === userId);
          if (peerObj) {
            peerObj.dataChannel = event.channel;
          }
        };
      }

      if (peer._pc) {
        const senders = peer._pc.getSenders();
        const videoSender = senders.find(
          (sender) => sender.track?.kind === "video"
        );
        if (videoSender) {
          videoSenderRef.current.set(userId, videoSender);
        }
      }

      const peerObj = {
        peerID: userId,
        peer,
        userName: peerUserName,
        isScreenSharing,
        isMuted: initialMuted, // Use initial muted state
        isHost: peerIsHost || false,
        dataChannel: dataChannelRef,
      };

      peersRef.current = [...peersRef.current, peerObj];
    },
    [roomId, isScreenSharing, isMuted, screenSharingUserId]
  );

  const handleUserLeft = useCallback(
    (userId) => {
      const peerObj = peersRef.current.find((p) => p.peerID === userId);
      if (peerObj && peerObj.peer) {
        try {
          peerObj.peer.destroy();
        } catch (error) {
          console.error("Error destroying peer:", error);
        }
      }

      peersRef.current = peersRef.current.filter((p) => p.peerID !== userId);
      setPeers((prevPeers) => prevPeers.filter((p) => p.peerID !== userId));
      setParticipantCount((prev) => Math.max(1, prev - 1));

      if (screenSharingUserId === userId) {
        setScreenSharingUserId(null);
      }

      videoSenderRef.current.delete(userId);
    },
    [screenSharingUserId]
  );

  const setupDataChannel = (channel, userId, peerUserName) => {
    console.log(`💬 Setting up data channel with ${peerUserName}`);

    const peerObj = peersRef.current.find((p) => p.peerID === userId);
    if (peerObj) {
      peerObj.dataChannel = channel;
    }

    channel.onopen = () => {
      console.log("✅ Data channel opened with:", peerUserName);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "chat") {
          const newMessage = {
            text: data.message,
            sender: "peer",
            userName: data.userName || peerUserName || "User",
            time: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };

          setMessages((prev) => [...prev, newMessage]);

          if (!isChatOpen) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      } catch (error) {
        console.error("❌ Data channel message error:", error);
      }
    };

    channel.onerror = (error) => {
      console.error("❌ Data channel error with", peerUserName, ":", error);
    };

    channel.onclose = () => {
      console.log("🔌 Data channel closed with:", peerUserName);
    };
  };

  const sendChatMessage = (message) => {
    console.log("📤 Sending message:", message);

    peersRef.current.forEach(({ dataChannel, userName: peerUserName }) => {
      if (dataChannel && dataChannel.readyState === "open") {
        try {
          const data = JSON.stringify({
            type: "chat",
            message: message,
            userName: userName,
          });
          dataChannel.send(data);
        } catch (error) {
          console.error(`❌ Failed to send to ${peerUserName}:`, error);
        }
      }
    });

    const newMessage = {
      text: message,
      sender: "me",
      userName: "You",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const setupEncryption = async (peerPublicKeyBase64, userId) => {
    try {
      const peerPublicKey = await importPublicKey(peerPublicKeyBase64);
      const sharedSecret = await deriveSharedSecret(
        keyPairRef.current.privateKey,
        peerPublicKey
      );
      console.log("🔐 Encryption established with:", userId);
    } catch (error) {
      console.error("Encryption setup error:", error);
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);

      // Broadcast mute status to all peers
      socket.emit("mute-status", { roomId, isMuted: newMuteState });
    }
  };

  const toggleVideo = () => {
    if (streamRef.current && !isScreenSharing) {
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      if (isMobile && !isAndroid) {
        alert("Screen sharing is not supported on iOS devices.");
      } else {
        alert("Your browser doesn't support screen sharing.");
      }
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (localVideo.current) {
        localVideo.current.srcObject = screenStream;
      }

      const replacePromises = [];
      videoSenderRef.current.forEach((sender) => {
        if (sender) {
          replacePromises.push(
            sender.replaceTrack(screenTrack).catch((err) => {
              console.error("Failed to replace track:", err);
            })
          );
        }
      });

      await Promise.all(replacePromises);

      setIsScreenSharing(true);
      socket.emit("screen-share-status", { roomId, isSharing: true });

      screenTrack.onended = () => {
        stopScreenShare();
      };

      console.log("✅ Screen sharing started");
    } catch (error) {
      console.error("Error starting screen share:", error);
      if (error.name === "NotAllowedError") {
        alert("Screen sharing permission denied.");
      }
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const videoTrack = streamRef.current.getVideoTracks()[0];

      if (localVideo.current) {
        localVideo.current.srcObject = streamRef.current;
      }

      const replacePromises = [];
      videoSenderRef.current.forEach((sender) => {
        if (sender && videoTrack) {
          replacePromises.push(
            sender.replaceTrack(videoTrack).catch((err) => {
              console.error("Failed to replace track:", err);
            })
          );
        }
      });

      await Promise.all(replacePromises);

      setIsScreenSharing(false);
      socket.emit("screen-share-status", { roomId, isSharing: false });
      screenStreamRef.current = null;

      console.log("✅ Screen sharing stopped");
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
  };

  const kickUser = (userIdToKick) => {
    const peerToKick = peers.find((p) => p.peerID === userIdToKick);
    const confirmMessage = `Are you sure you want to remove ${
      peerToKick?.userName || "this user"
    } from the call?`;

    if (window.confirm(confirmMessage)) {
      socket.emit("kick-user", { roomId, userIdToKick });

      // Immediately remove from local state
      handleUserLeft(userIdToKick);
    }
  };

  const cleanup = () => {
    console.log("🧹 Cleaning up...");

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    peersRef.current.forEach(({ peer }) => {
      if (peer && !peer.destroyed) {
        try {
          peer.destroy();
        } catch (error) {
          console.error("Error destroying peer:", error);
        }
      }
    });

    peersRef.current = [];

    if (socket && socketInitialized.current) {
      socket.off();
      socket.disconnect();
      socketInitialized.current = false;
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

  const screenSharingPeer = peers.find((p) => p.peerID === screenSharingUserId);
  const isRemoteSharingLayout = screenSharingUserId && !isScreenSharing;
  const canScreenShare =
    navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia;
  const screenShareDisabled = !canScreenShare || (isMobile && !isAndroid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-7xl">
        {/* Status Bar with Suspense */}
        <Suspense fallback={<div className="h-16"></div>}>
          <StatusBar
            connectionStatus={connectionStatus}
            participantCount={participantCount}
            isEncrypted={isEncrypted}
            isScreenSharing={isScreenSharing}
            screenSharingUserId={screenSharingUserId}
            roomId={roomId}
          />
        </Suspense>

        {/* Stop Screen Share Button */}
        {(isScreenSharing || screenSharingUserId) && (
          <div className="mb-4 flex justify-center">
            {isScreenSharing && (
              <button
                onClick={stopScreenShare}
                className="bg-red-500/90 hover:bg-red-600 text-white font-semibold px-4 sm:px-6 py-2 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 backdrop-blur-xl border border-white/20 transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Stop Sharing Your Screen
              </button>
            )}
            {screenSharingUserId && !isScreenSharing && (
              <div className="bg-blue-500/20 backdrop-blur-xl border border-blue-400/30 text-blue-200 px-4 sm:px-6 py-2 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm sm:text-base">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">
                  {peers.find((p) => p.peerID === screenSharingUserId)
                    ?.userName || "Someone"}{" "}
                  is sharing
                </span>
              </div>
            )}
          </div>
        )}

        {/* Video Grid with Suspense */}
        <Suspense
          fallback={
            <div className="h-96 bg-white/5 rounded-2xl animate-pulse"></div>
          }
        >
          <VideoGrid
            localVideo={localVideo}
            peers={peers}
            isScreenSharing={isScreenSharing}
            isVideoOff={isVideoOff}
            isMuted={isMuted}
            screenSharingUserId={screenSharingUserId}
            screenSharingPeer={screenSharingPeer}
            isRemoteSharingLayout={isRemoteSharingLayout}
            userName={userName}
            isHost={isHost}
            onKickUser={kickUser}
          />
        </Suspense>

        {/* Control Panel with Suspense */}
        <Suspense fallback={<div className="h-20"></div>}>
          <ControlPanel
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            screenShareDisabled={screenShareDisabled}
            isChatOpen={isChatOpen}
            unreadCount={unreadCount}
            toggleMute={toggleMute}
            toggleVideo={toggleVideo}
            startScreenShare={startScreenShare}
            stopScreenShare={stopScreenShare}
            toggleChat={toggleChat}
            handleEndCall={handleEndCall}
          />
        </Suspense>

        {/* Chat Panel with Suspense */}
        <Suspense fallback={<div></div>}>
          <ChatPanel
            messages={messages}
            onSendMessage={sendChatMessage}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
        </Suspense>

        {/* Build Version */}
        <BuildVersion />
      </div>
    </div>
  );
}
