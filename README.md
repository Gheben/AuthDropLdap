
# AuthDrop

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Express](https://img.shields.io/badge/Express-4.x-blue.svg)
![SQLite3](https://img.shields.io/badge/SQLite3-Latest-lightblue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-Windows%20|%20Linux%20|%20macOS-lightgrey.svg)

**A modern web application for peer-to-peer file transfer directly in your browser**

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20-yellow.svg?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/guidoballau)

</div>

---

**AuthDrop** is a web application for peer-to-peer file transfer that works directly in your browser, with no installation required.

## Features

- 🔄 Peer-to-peer file transfer via WebRTC
- 🌐 Fully browser-based (PWA)
- 🔒 Direct and secure device-to-device connection
- 📱 Multi-platform support (Windows, Mac, Linux, iOS, Android)
- 💾 No file size limits
- 🚀 Transfer speed limited only by your network
- 🌍 35+ languages supported
- 🎨 Automatic light/dark theme
- 📴 Works offline after first visit
- 🔐 Total privacy: files never pass through external servers


## Dashboard Screenshots

Below are some screenshots of the AuthDrop dashboard:

### Main Dashboard
![Main Dashboard](screenshot/2025-12-28%2013_22_48-.png)


### Group Management
![Group Management](screenshot/2025-12-28%2013_27_16-.png)

### Device List
![Device List](screenshot/2025-12-28%2013_23_52-.png)

## Technologies

- **Frontend**: HTML5, CSS3, JavaScript ES6
- **Backend**: Node.js with Express
- **Communication**: WebRTC and WebSockets
- **PWA**: Progressive Web App


## Installation

### Prerequisites

- Node.js >= 15.0.0
- npm

### Instructions

```bash
# Clone or download this repository
cd AuthDrop

# Install dependencies
npm install

# Start the server
npm start
```

The server will be available at `http://localhost:3441`

## Development

```bash
# Development mode
npm run dev
```

## Deployment

### With Docker

```bash
docker build -t AuthDrop .
docker run -d --restart=unless-stopped --name=AuthDrop -p 127.0.0.1:3441:3441 AuthDrop
```

### With Node.js

```bash
npm run start:prod
```

## Project Structure

```
AuthDrop/
├── public/           # Frontend files (HTML, CSS, JS, images)
├── server/           # Node.js backend
├── package.json      # npm configuration
└── README.md         # This file
```

## How It Works

1. Open AuthDrop in the browser on all devices you want to connect
2. Devices on the same local network will automatically discover each other
3. Click on the target device and select the files to send
4. The transfer happens directly between devices (P2P)

## Advanced Features

### Device Pairing
You can permanently pair your devices by entering a shared room code, even if they are on different networks.

### Reset Database
To reset the database to a clean state (super admin only):

```bash
node reset-database.js
```

This creates a new database with only the super admin user configured in `.env`.

## FAQ

**Is it secure?**  
Yes, files are transferred directly between your devices using WebRTC. They never pass through external servers.

**Does it work without internet?**  
Yes, on the local network it works offline. Internet is only needed for the initial signaling server.

**Which browsers are supported?**  
All modern browsers: Chrome, Edge, Firefox, Safari, Opera.

**Can I use it with devices on different networks?**  
Yes, by using the pairing feature with a shared room code.

## Author

Guido Ballarini - [git.ballarini.app](https://git.ballarini.app/guido/AuthDrop)

## License

GPL-3.0
