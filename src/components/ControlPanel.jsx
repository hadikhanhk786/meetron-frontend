import React from 'react';

export default function ControlPanel({
  isMuted,
  isVideoOff,
  isScreenSharing,
  screenShareDisabled,
  isChatOpen,
  unreadCount,
  toggleMute,
  toggleVideo,
  startScreenShare,
  stopScreenShare,
  toggleChat,
  handleEndCall
}) {
  return (
    <div className="flex justify-center">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full blur-lg opacity-60"></div>
        <div className="relative bg-white/10 backdrop-blur-xl rounded-full px-4 sm:px-8 py-3 sm:py-4 shadow-2xl border border-white/30">
          <div className="flex items-center gap-3 sm:gap-6">
            
            <button
              onClick={toggleMute}
              className={`p-3 sm:p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                isMuted ? "bg-red-500/80" : "bg-white/20"
              } backdrop-blur-md border border-white/20 shadow-lg`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
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
              className={`p-3 sm:p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                isVideoOff ? "bg-red-500/80" : "bg-white/20"
              } backdrop-blur-md border border-white/20 shadow-lg ${isScreenSharing ? 'opacity-50' : ''}`}
              title={isVideoOff ? "Turn on camera" : "Turn off camera"}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                {isVideoOff ? (
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367z" clipRule="evenodd" />
                ) : (
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                )}
              </svg>
            </button>

            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              disabled={screenShareDisabled}
              className={`p-3 sm:p-4 rounded-full transition-all duration-300 transform hover:scale-110 ${
                isScreenSharing ? "bg-blue-500/80" : "bg-white/20"
              } backdrop-blur-md border border-white/20 shadow-lg ${screenShareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={screenShareDisabled ? "Not supported" : (isScreenSharing ? "Stop sharing" : "Share screen")}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z" clipRule="evenodd" />
              </svg>
            </button>

            <button
              onClick={toggleChat}
              className="relative p-3 sm:p-4 rounded-full transition-all duration-300 transform hover:scale-110 bg-white/20 backdrop-blur-md border border-white/20 shadow-lg"
              title="Chat"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
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
              className="p-3 sm:p-4 rounded-full bg-red-600/90 hover:bg-red-700 transition-all duration-300 transform hover:scale-110 backdrop-blur-md border border-white/20 shadow-lg"
              title="End call"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
