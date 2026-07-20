import dgram from "dgram";
import crypto from "crypto";

const WS_DISCOVERY_MULTICAST_ADDR = "239.255.255.250";
const WS_DISCOVERY_PORT = 3702;
const SCAN_WINDOW_MS = 4000;

export interface DiscoveredNvr {
  address: string;
  xaddrs: string[];
}

function buildProbeMessage(): string {
  const messageId = `uuid:${crypto.randomUUID()}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>${messageId}</w:MessageID>
    <w:To e:mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action e:mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>`;
}

// WS-Discovery is the standard ONVIF device-discovery mechanism: a SOAP "Probe" message is
// sent to a well-known multicast group, and any ONVIF device on the same broadcast
// domain/VLAN answers with its own address(es). This only finds devices on the same subnet
// as this server — it can't discover across routed/VLAN-separated networks, same limitation
// every ONVIF Device Manager-style tool has.
export function discoverOnvifDevices(timeoutMs = SCAN_WINDOW_MS): Promise<DiscoveredNvr[]> {
  return new Promise((resolve) => {
    const found = new Map<string, Set<string>>();
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    function finish() {
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve(
        [...found.entries()].map(([address, xaddrs]) => ({
          address,
          xaddrs: [...xaddrs],
        }))
      );
    }

    socket.on("error", () => finish());

    socket.on("message", (msg, rinfo) => {
      const text = msg.toString("utf8");
      const xaddrsMatch = text.match(/<(?:\w+:)?XAddrs>([\s\S]*?)<\/(?:\w+:)?XAddrs>/i);
      if (!xaddrsMatch) return;
      const urls = xaddrsMatch[1].trim().split(/\s+/).filter(Boolean);
      const existing = found.get(rinfo.address) ?? new Set<string>();
      for (const url of urls) existing.add(url);
      found.set(rinfo.address, existing);
    });

    socket.on("listening", () => {
      try {
        socket.setBroadcast(true);
      } catch {
        // not fatal — multicast itself is what matters here
      }
      const probe = Buffer.from(buildProbeMessage());
      socket.send(probe, WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST_ADDR);
    });

    socket.bind(0, () => {
      setTimeout(finish, timeoutMs);
    });
  });
}
