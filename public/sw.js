// Minimal service worker for Web Push - this app has no offline/caching needs, so this exists
// solely to receive 'push' events while the dashboard tab isn't focused (or isn't even open)
// and to focus/open the dashboard when the resulting OS notification is clicked.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "LogMonitor", body: "You have a new alert." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload - fall back to the default body above.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/branding/tulips-favicon.png",
      badge: "/branding/tulips-favicon.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/dashboard") && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/dashboard");
    })
  );
});
