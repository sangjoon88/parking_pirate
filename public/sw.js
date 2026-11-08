// 주차해적단 service worker: 홈 화면 설치용 최소 구성.
// 지도·정박 정보는 항상 최신이어야 하므로 캐시하지 않고 네트워크로 보낸다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#07111f;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0"><p>오프라인이에요. 연결되면 다시 열어 주세요 ☠</p></body>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        ),
    ),
  );
});
