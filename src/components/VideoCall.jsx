import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import {
  generateECDHKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret
} from "../utils/encryption";

let socket;

export default function VideoCall({ roomId }) {
  const [remoteId, setRemoteId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  
  const localVideo = useRef();
  const remoteVideo = useRef();
  const peerRef = useRef();
  const streamRef = useRef();
  const workerRef = useRef();
  const keyPairRef = useRef();
  const isInitiatorRef = useRef(false);

  useEffect(() => {
    socket = io("http://localhost:5001");
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    try {
      // Generate ECDH key pair
      keyPairRef.current = await generateECDHKeyPair();
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      streamRef.current = stream;
      localVideo.current.srcObject = stream;
      
      // Join room
      socket.emit("join-room", roomId);
      setConnectionStatus("Waiting for peer...");

      // Handle user joined (we are the initiator)
      socket.on("user-joined", async (userId) => {
        if (peerRef.current) return; // Already connected
        
        console.log("User joined, I am initiator");
        setRemoteId(userId);
        setConnectionStatus("Peer found. Establishing connection...");
        isInitiatorRef.current = true;
        
        // Send public key
        const publicKey = await exportPublicKey(keyPairRef.current.publicKey);
        socket.emit("key-exchange", { roomId, publicKey, to: userId });
        
        // Create peer as initiator
        createPeer(userId, stream, true);
      });

      // Handle signaling
      socket.on("signal", async ({ signal, from }) => {
        console.log("Received signal from:", from);
        
        if (!peerRef.current) {
          // We are not the initiator, create peer
          console.log("Creating peer as receiver");
          isInitiatorRef.current = false;
          setRemoteId(from);
          
          // Send our public key
          const publicKey = await exportPublicKey(keyPairRef.current.publicKey);
          socket.emit("key-exchange", { roomId, publicKey, to: from });
          
          createPeer(from, stream, false);
        }
        
        // Signal the peer
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.signal(signal);
        }
      });

      // Handle key exchange
      socket.on("key-exchange", async ({ publicKey, from }) => {
        console.log("Received encryption key from:", from);
        await setupEncryption(publicKey);
      });

      socket.on("user-left", () => {
        console.log("User left");
        setConnectionStatus("Peer disconnected");
        setRemoteId(null);
        destroyPeer();
      });

    } catch (error) {
      console.error("Error initializing call:", error);
      setConnectionStatus("Error: " + error.message);
    }
  };

  const createPeer = (userId, stream, initiator) => {
    // Don't create if peer already exists
    if (peerRef.current && !peerRef.current.destroyed) {
      console.log("Peer already exists");
      return;
    }

    console.log("Creating peer, initiator:", initiator);
    
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
      console.log("Sending signal");
      socket.emit("signal", { roomId, signal, to: userId });
    });

    peer.on("stream", (remoteStream) => {
      console.log("Received remote stream");
      remoteVideo.current.srcObject = remoteStream;
      setConnectionStatus("Connected");
    });

    peer.on("connect", () => {
      console.log("Peer connected!");
      setConnectionStatus("Connected & Encrypted");
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setConnectionStatus("Connection error");
    });

    peer.on("close", () => {
      console.log("Peer closed");
      setConnectionStatus("Connection closed");
    });

    peerRef.current = peer;
  };

  const setupEncryption = async (peerPublicKeyBase64) => {
    try {
      const peerPublicKey = await importPublicKey(peerPublicKeyBase64);
      const sharedSecret = await deriveSharedSecret(
        keyPairRef.current.privateKey,
        peerPublicKey
      );

      workerRef.current = new Worker("/crypto-worker.js");
      workerRef.current.postMessage({
        type: "set-key",
        key: sharedSecret
      });

      setIsEncrypted(true);
      console.log("End-to-end encryption established!");
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

  const destroyPeer = () => {
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  };

  const cleanup = () => {
    console.log("Cleaning up...");
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    
    destroyPeer();
    
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    if (socket) {
      socket.off("user-joined");
      socket.off("signal");
      socket.off("key-exchange");
      socket.off("user-left");
      socket.disconnect();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        
        {/* Status Bar */}
        <div className="mb-6 flex justify-center">
          <div className="bg-white/10 backdrop-blur-xl rounded-full px-6 py-3 border border-white/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${remoteId ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
                <span className="text-white text-sm font-medium">{connectionStatus}</span>
              </div>
              {isEncrypted && (
                <div className="flex items-center gap-2 pl-4 border-l border-white/30">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-400 text-sm font-medium">End-to-End Encrypted</span>
                </div>
              )}
              <div className="pl-4 border-l border-white/30">
                <span className="text-white/60 text-xs font-mono">Room: {roomId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          {/* Remote Video */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-300"></div>
            <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-1 shadow-2xl border border-white/20 transform hover:scale-105 transition duration-300 hover:rotate-1">
              <video
                ref={remoteVideo}
                autoPlay
                playsInline
                className="w-full h-full rounded-xl object-cover aspect-video bg-gray-900"
              />
              {!remoteId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
                  <p className="text-white/60 text-lg font-medium">Waiting for participant...</p>
                  <p className="text-white/40 text-sm mt-2">Share room code: {roomId}</p>
                </div>
              )}
              {remoteId && (
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
                  <p className="text-white text-sm font-semibold">Remote Peer</p>
                </div>
              )}
            </div>
          </div>

          {/* Local Video */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-300"></div>
            <div className="relative bg-white/10 backdrop-blur-lg rounded-2xl p-1 shadow-2xl border border-white/20 transform hover:scale-105 transition duration-300 hover:-rotate-1">
              <video
                ref={localVideo}
                autoPlay
                muted
                playsInline
                className="w-full h-full rounded-xl object-cover aspect-video bg-gray-900 scale-x-[-1]"
              />
              <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
                <p className="text-white text-sm font-semibold">You</p>
              </div>
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-xl">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-10 h-10 text-white/60" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-white/60 text-sm">Camera Off</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="flex justify-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full blur-lg opacity-60"></div>
            <div className="relative bg-white/10 backdrop-blur-xl rounded-full px-8 py-4 shadow-2xl border border-white/30 transform hover:scale-105 transition duration-300">
              <div className="flex items-center gap-6">
                
                {/* Mute Button */}
                <button
                  onClick={toggleMute}
                  className={`relative group/btn p-4 rounded-full transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 ${
                    isMuted
                      ? "bg-red-500/80 hover:bg-red-600/90"
                      : "bg-white/20 hover:bg-white/30"
                  } backdrop-blur-md border border-white/20 shadow-lg`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    {isMuted ? (
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    )}
                  </svg>
                </button>

                {/* Video Toggle */}
                <button
                  onClick={toggleVideo}
                  className={`relative group/btn p-4 rounded-full transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 ${
                    isVideoOff
                      ? "bg-red-500/80 hover:bg-red-600/90"
                      : "bg-white/20 hover:bg-white/30"
                  } backdrop-blur-md border border-white/20 shadow-lg`}
                  title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                >
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    {isVideoOff ? (
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367z" clipRule="evenodd" />
                    ) : (
                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    )}
                  </svg>
                </button>

                {/* End Call */}
                <button
                  onClick={() => {
                    cleanup();
                    window.location.href = "/";
                  }}
                  className="relative group/btn p-4 rounded-full bg-red-600/90 hover:bg-red-700 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 backdrop-blur-md border border-white/20 shadow-lg"
                  title="End call"
                >
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
