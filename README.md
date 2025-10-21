# Meetron Frontend

Meetron Frontend is a **React-based WebRTC video calling application** with **end-to-end encryption (E2EE)**.  
It allows users to connect securely for real-time audio and video communication directly in the browser.

---

## ✨ Features
- 🔒 End-to-end encrypted (E2EE) calls
- 🧠 Peer-to-peer communication using WebRTC
- 🎨 Clean and responsive UI (built with Tailwind CSS)
- ⚡ Fast and lightweight React setup
- 🧰 Simple configuration via environment variables

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/hadikhanhk786/meetron-frontend.git
cd meetron-frontend
```

### 2. Install dependencies
```bash
npm install
# or
yarn install
```

### 3. Start the development server
```bash
npm start
# or
yarn start
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root and configure your signaling server and STUN/TURN servers:

```bash
REACT_APP_SIGNALING_SERVER_URL=https://your-signaling-server.com
REACT_APP_STUN_TURN_SERVERS=stun:stun.l.google.com:19302
```

---

## 🛠 Build for Production
To create an optimized production build:
```bash
npm run build
```
The build output will be located in the `build/` folder.

---

## 📁 Project Structure
```
meetron-frontend/
├── public/                # Static assets
├── src/                   # React source files
│   ├── components/        # UI components
│   ├── pages/             # App pages
│   └── utils/             # Helper functions
├── .env.example           # Example environment file
├── tailwind.config.js     # Tailwind CSS config
├── config-overrides.js    # CRA overrides
└── package.json
```

---

## 🤝 Contributing

Contributions are welcome!  
1. Fork the project  
2. Create your feature branch (`git checkout -b feature/my-feature`)  
3. Commit your changes (`git commit -m 'Add my feature'`)  
4. Push to the branch (`git push origin feature/my-feature`)  
5. Open a Pull Request  

---

## 🗺 Roadmap
- 🧑‍🤝‍🧑 Group video conferencing
- 💬 Chat support
- 🖥 Screen sharing
- 📱 PWA support
- 🔔 Notifications

---

## 📜 License
MIT © 2025 Hadi Khan

---
⭐ Star this repo if you find it helpful!
