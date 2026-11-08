/* eslint-disable @typescript-eslint/no-explicit-any */
// 카카오맵 SDK 로더. 공식 타입 패키지가 없어 any로 다룬다.
export type Kakao = any;

declare global {
  interface Window {
    kakao: Kakao;
  }
}

let loading: Promise<Kakao> | null = null;

export function loadKakao(): Promise<Kakao> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저에서만 쓸 수 있어요."));
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao);
  if (loading) return loading;

  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  if (!key) return Promise.reject(new Error("NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았어요."));

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () => {
      loading = null;
      reject(new Error("카카오맵을 불러오지 못했어요. 앱 키와 등록된 도메인을 확인해 주세요."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type LatLng = { lat: number; lng: number };

/** 좌표 → 주소 (+ 건물명이 있으면 단지명 후보) */
export function reverseGeocode(kakao: Kakao, p: LatLng): Promise<{ address: string; building: string }> {
  return new Promise((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(p.lng, p.lat, (result: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !result[0]) return resolve({ address: "", building: "" });
      const r = result[0];
      resolve({
        address: r.road_address?.address_name || r.address?.address_name || "",
        building: r.road_address?.building_name || "",
      });
    });
  });
}

export function getPosition(highAccuracy = true): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("이 기기에서는 위치를 확인할 수 없어요."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 위치 접근을 허용해 주세요."
              : "현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
          ),
        ),
      { enableHighAccuracy: highAccuracy, timeout: 12000, maximumAge: 30000 },
    );
  });
}
