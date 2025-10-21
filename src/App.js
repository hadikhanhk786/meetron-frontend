import React, { useState, useEffect } from "react";
import VideoCall from "./components/VideoCall";
import { BUILD_INFO } from "./components/BuildVersion";

function App() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    // Check if room ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get("room");
    if (roomFromUrl) {
      setRoomId(roomFromUrl.toUpperCase());
    }
  }, []);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleJoinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      setJoined(true);
      // Update URL without reload
      const newUrl = `${window.location.pathname}?room=${roomId}`;
      window.history.pushState({}, "", newUrl);
    }
  };

  const handleCreateRoom = () => {
    if (userName.trim()) {
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      setJoined(true);
      // Update URL with room ID
      const newUrl = `${window.location.pathname}?room=${newRoomId}`;
      window.history.pushState({}, "", newUrl);
    }
  };

  const handleLeaveRoom = () => {
    setJoined(false);
    setRoomId("");
    // Clear URL parameters
    window.history.pushState({}, "", window.location.pathname);
  };

  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard
      .writeText(roomLink)
      .then(() => {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        alert("Failed to copy link. Please copy manually: " + roomLink);
      });
  };

  const shareRoom = () => {
    const roomLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

    if (navigator.share) {
      navigator
        .share({
          title: "Join my Meetron video call",
          text: `Join my encrypted video call on Meetron. Room code: ${roomId}`,
          url: roomLink,
        })
        .catch((err) => {
          console.log("Share cancelled or failed:", err);
        });
    } else {
      copyRoomLink();
    }
  };

  if (joined) {
    return (
      <>
        <VideoCall
          roomId={roomId}
          userName={userName}
          onLeave={handleLeaveRoom}
          onShare={shareRoom}
        />

        {/* Floating Share Button */}
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={shareRoom}
            className="relative group bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-4 py-3 rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span className="hidden sm:inline">Share Room</span>
          </button>

          {showCopied && (
            <div className="absolute top-full right-0 mt-2 bg-green-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg whitespace-nowrap">
              ✓ Link copied to clipboard!
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-3xl blur-xl opacity-50"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-white/10 rounded-2xl mb-4">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Meetron</h1>
              <p className="text-white/60 text-sm">
                End-to-end encrypted video chat
              </p>

              <div className="flex items-center justify-center gap-2 mt-4 text-green-400 text-xs">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>AES-256-GCM Encryption</span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Username Input */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value.slice(0, 20))}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                  maxLength={20}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && userName.trim() && roomId.trim()) {
                      handleJoinRoom();
                    }
                  }}
                />
                <p className="text-white/40 text-xs mt-1">
                  {userName.length}/20 characters
                </p>
              </div>

              {/* Room Code Input */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Room Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm pr-12"
                    maxLength={8}
                    onKeyPress={(e) => {
                      if (
                        e.key === "Enter" &&
                        userName.trim() &&
                        roomId.trim()
                      ) {
                        handleJoinRoom();
                      }
                    }}
                  />
                  {roomId && (
                    <button
                      onClick={copyRoomLink}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-all"
                      title="Copy room link"
                    >
                      <svg
                        className="w-5 h-5 text-white/60 hover:text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {showCopied && (
                  <p className="text-green-400 text-xs mt-2 flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Link copied to clipboard!
                  </p>
                )}
              </div>

              <button
                onClick={handleJoinRoom}
                disabled={!roomId.trim() || !userName.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
              >
                Join Room
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-white/60">or</span>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={!userName.trim()}
                className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Create New Room
              </button>

              {/* Quick Share Options */}
              {roomId && !joined && userName.trim() && (
                <div className="pt-4 border-t border-white/20">
                  <p className="text-white/60 text-xs text-center mb-3">
                    Share this room:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={copyRoomLink}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy Link
                    </button>
                    <button
                      onClick={shareRoom}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                        />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-xl">
              <p className="text-blue-200 text-xs text-center">
                <strong>Privacy Notice:</strong> All communications are
                encrypted end-to-end.
              </p>
            </div>
            <div className="mt-4 text-center">
              <p className="text-white/40 text-xs font-mono">
                Meetron v{BUILD_INFO.version} · Build {BUILD_INFO.build}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
