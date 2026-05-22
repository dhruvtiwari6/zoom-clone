# ✨ Zoom Clone - Key Features

This document outlines the standout architecture, security protocols, and interactive capabilities that make this high-performance Zoom Clone unique.

---

## 🔒 1. Advanced Passcode Security & Smart Lobby

To protect meetings from unauthorized entry, we implemented a robust, dual-layered meeting validation system:

*   **Enforced Database-Backed Passcodes**: Every instant and scheduled meeting automatically generates a secure, random alphanumeric passcode stored directly in the **Neon PostgreSQL database**.
*   **Intelligent Lobby Interceptor**: Unauthenticated guest participants are caught by a pre-join lobby. 
    *   If no passcode is provided, the lobby prompts them for both their **Display Name** and the **Meeting Passcode**.
    *   Validation is performed asynchronously on the backend (`401 Unauthorized` for incorrect codes) and rendered natively in the UI.
*   **Direct-Link Passcode Embedding**: Generated invite links automatically embed the passcode as a query parameter (e.g. `?passcode=vbcDwM`).
*   **Zero-Friction Auto-Validation**: If a guest joins using a full invite link, the frontend detects the query parameter, **intelligently hides the passcode input field** in the lobby to keep the form clean, and handles validation seamlessly in the background!
*   **Host Validation Bypass**: The meeting creator (host) is auto-authenticated via their host profile, completely bypassing passcode checks to allow frictionless, instant room startup.

---

## 💬 2. Real-time Communication & Interactive Panels

Engagement and presence are central to virtual classrooms and meetings:

*   **Real-time WebSocket Chat**: Live, full-duplex chat panel supporting instant text messaging between all active room participants.
*   **Unread Message Badges**: When the chat sidebar is closed, an interactive **chat notification badge** pops up next to the Chat control button, showing a live counter of missed messages. This keeps participants informed without disrupting active presentations.
*   **Floating Emoji Reactions**: Participants can click reaction buttons to spawn real-time floating emojis (e.g., 👍, 🎉, ❤️, 😮) that drift up their viewport. These reactions are instantly broadcasted and rendered on all participants' screens.

---

## 🔊 3. Industrial-Grade LiveKit & WebRTC Streaming

High-performance media handling was prioritized for maximum audio-visual clarity:

*   **WebRTC Audio Track Synchronization**: Resolved the common WebRTC silent-stream issue on mobile and desktop browsers by dynamically binding to LiveKit's `TrackSubscribed` and `TrackUnsubscribed` events.
*   **Memory-Leak Prevention**: Audio elements are programmatically attached to the DOM on subscription and completely detached and disposed of on unsubscribe, preventing persistent audio residue or orphan media streams.
*   **Dynamic Grid Layouts**: Responsive video gallery layouts that automatically resize and reposition depending on the number of active participants:
    *   *Grid 1*: Focus layout for single presenters.
    *   *Grid 2*: Split screen view for side-by-side discussion.
    *   *Grid 3-4*: Balanced quad layout.
    *   *Grid 5+*: Expanded grid designed for large audience meetings.

---

## 🎨 4. Premium Responsive Design System

The application has been styled to deliver a stunning visual first impression:

*   **Curated HSL Color Scheme**: Rich glassmorphic elements, deep custom slate backgrounds, and vibrant call-to-action indicators that emulate professional software suites.
*   **Modern Sans-Serif Typography**: Custom Google Fonts (Inter / Outfit) replacing generic browser fallbacks for a clean, editorial look.
*   **Persistent Preferences**: Form values (such as "Remember my display name" options) are securely saved inside local and session storage, providing a customizable experience on subsequent visits.
