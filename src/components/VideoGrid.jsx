import React from 'react';

export default function VideoGrid({ 
  localVideo, 
  peers, 
  isScreenSharing, 
  isVideoOff, 
  screenSharingUserId, 
  screenSharingPeer, 
  isRemoteSharingLayout,
  userName 
}) {
  return (
    <div className={`mb-4 sm:mb-8 ${
      isRemoteSharingLayout 
        ? 'flex flex-col gap-4' 
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4'
    }`}>
      
      {/* Screen Sharing View - Large */}
      {isRemoteSharingLayout && screenSharingPeer && (
        <div className="relative group w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl sm:rounded-2xl blur-xl opacity-50"></div>
          <div className="relative bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-1 shadow-2xl border border-white/20">
            <video
              autoPlay
              playsInline
              ref={ref => {
                if (ref && screenSharingPeer.stream) {
                  ref.srcObject = screenSharingPeer.stream;
                }
              }}
              className="w-full rounded-lg sm:rounded-xl object-contain aspect-video bg-gray-900"
            />
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 bg-black/40 backdrop-blur-md px-2 sm:px-3 py-1 rounded-full flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z" clipRule="evenodd" />
              </svg>
              <p className="text-white text-xs sm:text-sm font-semibold">{screenSharingPeer.userName}'s Screen</p>
            </div>
          </div>
        </div>
      )}

      {/* Local Video */}
      <div className={`relative group ${isRemoteSharingLayout ? 'max-w-xs' : ''}`}>
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl sm:rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-300"></div>
        <div className="relative bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-1 shadow-2xl border border-white/20 transform hover:scale-105 transition duration-300">
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className={`w-full h-full rounded-lg sm:rounded-xl object-cover aspect-video bg-gray-900 ${!isScreenSharing ? 'scale-x-[-1]' : ''}`}
          />
          <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
            <p className="text-white text-xs font-semibold">{isScreenSharing ? 'Your Screen' : 'You'}</p>
          </div>
          {isVideoOff && !isScreenSharing && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg sm:rounded-xl">
              <div className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white/60" fill="currentColor" viewBox="0 0 20 20">
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
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl sm:rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition duration-300"></div>
          <div className="relative bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-1 shadow-2xl border border-white/20 transform hover:scale-105 transition duration-300">
            <video
              autoPlay
              playsInline
              ref={ref => {
                if (ref && peer.stream) {
                  ref.srcObject = peer.stream;
                }
              }}
              className="w-full h-full rounded-lg sm:rounded-xl object-cover aspect-video bg-gray-900"
            />
            <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-2">
              <p className="text-white text-xs font-semibold">{peer.userName}</p>
              {peer.isMuted && (
                <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
