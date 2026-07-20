import crypto from "crypto";

// Minimal ONVIF (Profile S) SOAP client — no XML/SOAP dependency in this repo, so requests
// are hand-built strings and responses parsed with targeted regexes (same approach already
// used for RSS feeds elsewhere in this app). ONVIF is a wide, loosely-enforced spec; this
// covers the common Device/Media operations needed to discover and preview an NVR's
// channels, not the full spec.

// Strips an optional scheme://host[:port] prefix, however malformed the host/port part is
// (some devices echo back a corrupted self-referential address, e.g. a duplicated port) —
// everything from the first "/" after the scheme is the actual path, and that's the only
// part of a device's self-reported XAddr worth trusting. Deliberately string-based rather
// than new URL(), since a malformed host:port (like "host:800:800") makes URL parsing throw
// before we ever get to look at the path.
function extractPathFromXAddr(xaddr: string): string {
  const withoutScheme = xaddr.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
  const slashIdx = withoutScheme.indexOf("/");
  return slashIdx === -1 ? "/" : withoutScheme.slice(slashIdx);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wsSecurityHeader(username: string, password: string): string {
  const nonceBuf = crypto.randomBytes(16);
  const created = new Date().toISOString();
  const digest = crypto
    .createHash("sha1")
    .update(Buffer.concat([nonceBuf, Buffer.from(created, "utf8"), Buffer.from(password, "utf8")]))
    .digest("base64");

  return `<Security xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
    <UsernameToken>
      <Username>${escapeXml(username)}</Username>
      <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</Password>
      <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceBuf.toString(
        "base64"
      )}</Nonce>
      <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</Created>
    </UsernameToken>
  </Security>`;
}

async function callOnvif(url: string, username: string, password: string, soapBody: string): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Header>${wsSecurityHeader(username, password)}</s:Header>
  <s:Body>${soapBody}</s:Body>
</s:Envelope>`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
    body: envelope,
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ONVIF request to ${url} failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  return text;
}

// Matches an element by local name regardless of its namespace prefix (devices vary: tds:,
// tt:, trt:, or no prefix at all depending on vendor/firmware).
function extractFirst(xml: string, localName: string): string | null {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${localName}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${localName}>`, "i"));
  return match ? match[1].trim() : null;
}

// Some NVR/camera firmwares self-report a broken host:port in their own addresses (seen
// live: a device echoing back "host:800:800/path", a duplicated-port config bug on the
// device itself) — and confirmed to affect not just GetCapabilities' Media XAddr but also
// GetSnapshotUri/GetStreamUri responses from the same device. Trust only the path+query from
// the device's response and rebuild the host/port from the address we actually just
// connected to successfully, rather than the device's possibly-wrong claim about itself.
// Also decodes the "&amp;" HTML-entity-escaping some firmwares apply to the query string
// (e.g. "channel=1&amp;subtype=0"), which would otherwise leave "subtype" unparseable as a
// real query parameter.
function rebuildUriFromKnownGoodHost(rawUri: string, knownGoodBaseUrl: string): string {
  const decoded = rawUri.replace(/&amp;/g, "&");
  const path = extractPathFromXAddr(decoded);
  const knownGoodHost = new URL(knownGoodBaseUrl);
  return `${knownGoodHost.protocol}//${knownGoodHost.host}${path}`;
}

export async function getMediaServiceUrl(deviceServiceUrl: string, username: string, password: string): Promise<string> {
  const body = `<GetCapabilities xmlns="http://www.onvif.org/ver10/device/wsdl"><Category>Media</Category></GetCapabilities>`;
  const xml = await callOnvif(deviceServiceUrl, username, password, body);
  const mediaBlockMatch = xml.match(/<(?:\w+:)?Media[^>]*>([\s\S]*?)<\/(?:\w+:)?Media>/i);
  const xaddr = mediaBlockMatch ? extractFirst(mediaBlockMatch[1], "XAddr") : null;
  if (!xaddr) throw new Error("NVR did not report a Media service address (GetCapabilities response missing Media/XAddr).");

  return rebuildUriFromKnownGoodHost(xaddr, deviceServiceUrl);
}

export interface OnvifProfile {
  token: string;
  name: string;
}

export async function getProfiles(mediaServiceUrl: string, username: string, password: string): Promise<OnvifProfile[]> {
  const body = `<GetProfiles xmlns="http://www.onvif.org/ver10/media/wsdl"/>`;
  const xml = await callOnvif(mediaServiceUrl, username, password, body);

  const profileBlocks = xml.match(/<(?:\w+:)?Profiles\b[^>]*token="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?Profiles>/gi) ?? [];
  const profiles: OnvifProfile[] = [];
  for (const block of profileBlocks) {
    const tokenMatch = block.match(/token="([^"]+)"/);
    const nameMatch = extractFirst(block, "Name");
    if (tokenMatch) {
      profiles.push({ token: tokenMatch[1], name: nameMatch || tokenMatch[1] });
    }
  }
  return profiles;
}

// Deliberately NOT run through rebuildUriFromKnownGoodHost: RTSP
// stream ports are commonly different from the HTTP ONVIF port (often 554), so reusing the
// media service's host:port here could just replace one wrong address with another. This
// isn't wired into any feature yet (see nvr.ts) — revisit once live-view is actually built
// and can be tested against a real stream.
export async function getStreamUri(mediaServiceUrl: string, username: string, password: string, profileToken: string): Promise<string | null> {
  const body = `<GetStreamUri xmlns="http://www.onvif.org/ver10/media/wsdl">
    <StreamSetup>
      <Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream>
      <Transport xmlns="http://www.onvif.org/ver10/schema"><Protocol>RTSP</Protocol></Transport>
    </StreamSetup>
    <ProfileToken>${escapeXml(profileToken)}</ProfileToken>
  </GetStreamUri>`;
  const xml = await callOnvif(mediaServiceUrl, username, password, body);
  return extractFirst(xml, "Uri");
}
