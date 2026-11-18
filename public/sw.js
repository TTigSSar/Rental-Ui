/* DoRent service worker (ADR-067): Web Push only. No caching, no fetch handler.
   Payload carries no message text: { title, body, conversationId, url }. */

function isWebKit() {
  var ua = (self.navigator && self.navigator.userAgent) || '';
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Android|Edg|OPR/.test(ua);
}

function safeChatPath(url) {
  if (typeof url !== 'string') return null;
  // Same-origin path only: starts with "/chat/" and not protocol-relative.
  return url.indexOf('/chat/') === 0 && url.indexOf('//') !== 0 ? url : null;
}

self.addEventListener('push', function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }
  var title = payload.title || 'DoRent';
  var url = safeChatPath(payload.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      // WebKit revokes the subscription after a few silent pushes: always show there.
      if (!isWebKit()) {
        for (var i = 0; i < windows.length; i++) {
          if (windows[i].visibilityState === 'visible') return undefined;
        }
      }
      return self.registration.showNotification(title, {
        body: payload.body || '',
        tag: payload.conversationId || undefined,
        icon: '/icon-192.png',
        data: { url: url },
      });
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = safeChatPath(event.notification.data && event.notification.data.url);
  if (url === null) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        var client = windows[i];
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.focus().then(function (focused) {
            (focused || client).postMessage({ type: 'dorent-push-navigate', url: url });
          });
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
