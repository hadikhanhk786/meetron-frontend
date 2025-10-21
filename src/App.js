import React, { useState } from "react";
import VideoCall from "./components/VideoCall";

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      setJoined(true);
    }
  };

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setJoined(true);
  };

  if (joined) {
    return <VideoCall roomId={roomId} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-3xl blur-xl opacity-50"></div>
          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
            
            <div className="text-center mb-8">
              <div className="inline-block p-4 bg-white/10 rounded-2xl mb-4">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Secure Video Call</h1>
              <p className="text-white/60 text-sm">End-to-end encrypted peer-to-peer video chat</p>
              
              <div className="flex items-center justify-center gap-2 mt-4 text-green-400 text-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>AES-256-GCM Encryption</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Room Code</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                  maxLength={8}
                />
              </div>

              <button
                onClick={handleJoinRoom}
                disabled={!roomId.trim()}
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
                className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 backdrop-blur-sm"
              >
                Create New Room
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/20 rounded-xl">
              <p className="text-blue-200 text-xs text-center">
                <strong>Privacy Notice:</strong> All communications are encrypted end-to-end. No data is stored on servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
