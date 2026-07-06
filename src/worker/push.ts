// Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) implementado con WebCrypto, compatible
// con Cloudflare Workers. Sin dependencias de Node. Envía la notificación al servicio push
// del fabricante (FCM en Android/Chrome), que la entrega al dispositivo aunque la web esté cerrada.
import type { Env } from "./index";

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const b64urlToBytes = (s: string): Uint8Array => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

const concat = (...arrs: Uint8Array[]): Uint8Array => {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

async function vapidAuth(env: Env, audience: string): Promise<string> {
  const header = bytesToB64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    utf8(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: env.VAPID_SUBJECT || "mailto:admin@world-cup.dyorch.com",
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const jwk = JSON.parse(atob(env.VAPID_PRIVATE!));
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(unsigned));
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${env.VAPID_PUBLIC}`;
}

// Devuelve el status HTTP del servicio push (201 = OK; 404/410 = suscripción muerta).
export async function sendPush(env: Env, sub: PushSub, payload: string): Promise<number> {
  const uaPublic = b64urlToBytes(sub.keys.p256dh); // 65 bytes (punto sin comprimir)
  const auth = b64urlToBytes(sub.keys.auth); // 16 bytes

  // Par efímero del servidor (ECDH). Casts por quirks de @cloudflare/workers-types
  // (uniones en generateKey/exportKey y el rename público->$public); el runtime usa WebCrypto estándar.
  const as = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", as.publicKey)) as ArrayBuffer); // 65 bytes
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      as.privateKey,
      256,
    ),
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8291: derivar IKM
  const prkCombine = await hmac(auth, ecdh);
  const ikmInput = concat(utf8("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = (await hmac(prkCombine, ikmInput)).slice(0, 32);

  // RFC 8188: derivar CEK y NONCE
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(utf8("Content-Encoding: aes128gcm"), new Uint8Array([0, 1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(utf8("Content-Encoding: nonce"), new Uint8Array([0, 1])))).slice(0, 12);

  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintext = concat(utf8(payload), new Uint8Array([2])); // delimitador 0x02 (último record)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, plaintext));

  // Cabecera aes128gcm: salt(16) | rs(4)=4096 | idlen(1)=65 | asPublic(65) | ciphertext
  const body = concat(salt, new Uint8Array([0, 0, 0x10, 0x00]), new Uint8Array([asPublic.length]), asPublic, ct);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "60",
      Urgency: "high",
      Authorization: await vapidAuth(env, new URL(sub.endpoint).origin),
    },
    body,
  });
  return res.status;
}
