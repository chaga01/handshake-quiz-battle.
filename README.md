# Quiz Battle — Handshake Multiplayer Project

Quiz Battle is a browser-based real-time trivia game. Players join from separate devices using a five-character room code.

## Features
- 2–12 players per room
- Host-created rooms and room codes
- Eight multiple-choice questions
- 15-second timer per question
- Faster correct answers earn more points (1,000–1,500)
- Live leaderboard and final winner
- Responsive layout for phones, tablets, and computers
- Server-authoritative scoring and answer checking

## Run locally
1. Install Node.js 18 or newer.
2. Open a terminal in this project folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

To test on separate devices on the same Wi-Fi, open the computer's local network IP address on the other device, using port 3000. For play across different networks, deploy to Render.

## Publish with GitHub and Render

### GitHub
1. Sign in to GitHub and create a new repository named `handshake-quiz-battle`.
2. Upload the contents of this project folder (the `server.js`, `package.json`, `README.md`, and `public` folder). Do not upload the ZIP file as the only repository item.
3. Commit the files to the repository's main branch.

### Render
1. Sign in to Render and choose **New + → Web Service**.
2. Connect your GitHub account and select `handshake-quiz-battle`.
3. Use these settings:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: Free (if available to your account)
4. Click **Create Web Service** and wait for the deploy to finish.
5. Open the `https://...onrender.com` URL Render provides.
6. Share that URL with players. One player creates a room; everyone else joins with the room code.

## Test checklist
- [ ] Open the deployed URL on two separate devices or browser sessions.
- [ ] Create a room on device 1.
- [ ] Join using the room code on device 2.
- [ ] Confirm both names appear in the lobby.
- [ ] Confirm the host can start only after a second player joins.
- [ ] Submit correct and incorrect answers.
- [ ] Confirm the timer, scores, leaderboard, and winner display work.

## Project architecture
- `server.js`: Express web server, Socket.IO events, room management, timer, answer validation, and scoring.
- `public/index.html`: Screens and page structure.
- `public/style.css`: Responsive visual design.
- `public/client.js`: Browser interaction and real-time event handling.

## Important notes
- Rooms and scores are stored in server memory. They reset if the Render service restarts or redeploys.
- This starter version removes a player from the room if their connection disconnects; refresh/reconnect support can be added as an enhancement.
- The game requires an active internet connection after deployment.
