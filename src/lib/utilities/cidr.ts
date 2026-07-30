// Shared IPv4 bitwise math for the CIDR Calculator and Subnet Calculator utilities.

export interface CidrInfo {
  input: string;
  networkAddress: string;
  broadcastAddress: string;
  netmask: string;
  wildcardMask: string;
  prefix: number;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: string;
  isPrivate: boolean;
}

export function ipToInt(ip: string): number {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) throw new Error(`"${ip}" is not a valid IPv4 address`);
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new Error(`"${ip}" is not a valid IPv4 address`);
  }
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function prefixToMaskInt(prefix: number): number {
  if (prefix === 0) return 0;
  return (-1 << (32 - prefix)) >>> 0;
}

export function maskToPrefix(mask: string): number {
  const n = ipToInt(mask);
  let prefix = 0;
  let seenZero = false;
  for (let i = 31; i >= 0; i--) {
    const bit = (n >>> i) & 1;
    if (bit === 1) {
      if (seenZero) throw new Error(`"${mask}" is not a valid contiguous subnet mask`);
      prefix++;
    } else {
      seenZero = true;
    }
  }
  return prefix;
}

function ipClassOf(n: number): string {
  const firstOctet = (n >>> 24) & 255;
  if (firstOctet < 128) return "A";
  if (firstOctet < 192) return "B";
  if (firstOctet < 224) return "C";
  if (firstOctet < 240) return "D (Multicast)";
  return "E (Reserved)";
}

function isPrivateIp(n: number): boolean {
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

// Accepts "192.168.1.0/24" or "192.168.1.10 255.255.255.0" style input (space or slash
// separated address + prefix-or-dotted-mask).
export function parseCidrLike(input: string): { ip: string; prefix: number } {
  const trimmed = input.trim();
  const sep = trimmed.includes("/") ? "/" : /\s+/.test(trimmed) ? " " : null;
  if (!sep) throw new Error("Enter an address and prefix, e.g. 192.168.1.0/24");
  const [ipPart, maskPart] = sep === " " ? trimmed.split(/\s+/) : trimmed.split("/");
  if (!ipPart || !maskPart) throw new Error("Enter an address and prefix, e.g. 192.168.1.0/24");

  const prefix = maskPart.includes(".") ? maskToPrefix(maskPart) : Number(maskPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Prefix length must be an integer between 0 and 32 (or a valid dotted subnet mask)");
  }
  return { ip: ipPart, prefix };
}

export function computeCidrInfo(ip: string, prefix: number): CidrInfo {
  const ipInt = ipToInt(ip);
  const maskInt = prefixToMaskInt(prefix);
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
  const totalAddresses = Math.pow(2, 32 - prefix);
  const usableHosts = prefix >= 31 ? 0 : totalAddresses - 2;
  const firstHostInt = prefix >= 31 ? networkInt : networkInt + 1;
  const lastHostInt = prefix >= 31 ? broadcastInt : broadcastInt - 1;

  return {
    input: `${ip}/${prefix}`,
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    netmask: intToIp(maskInt),
    wildcardMask: intToIp(~maskInt >>> 0),
    prefix,
    firstHost: intToIp(firstHostInt),
    lastHost: intToIp(lastHostInt),
    totalAddresses,
    usableHosts,
    ipClass: ipClassOf(ipInt),
    isPrivate: isPrivateIp(ipInt),
  };
}

export interface SubnetSplitResult {
  originalPrefix: number;
  newPrefix: number;
  subnets: CidrInfo[];
}

export function splitIntoSubnets(networkIp: string, basePrefix: number, subnetsNeeded: number): SubnetSplitResult {
  if (!Number.isInteger(subnetsNeeded) || subnetsNeeded < 1) {
    throw new Error("Number of subnets must be a positive integer");
  }
  const bitsNeeded = Math.ceil(Math.log2(subnetsNeeded));
  const newPrefix = basePrefix + bitsNeeded;
  if (newPrefix > 30) {
    throw new Error("Not enough address space in this network to create that many usable subnets");
  }
  const base = computeCidrInfo(networkIp, basePrefix);
  const baseInt = ipToInt(base.networkAddress);
  const blockSize = Math.pow(2, 32 - newPrefix);
  const count = Math.pow(2, bitsNeeded);

  const subnets: CidrInfo[] = [];
  for (let i = 0; i < count; i++) {
    const subnetIp = intToIp((baseInt + i * blockSize) >>> 0);
    subnets.push(computeCidrInfo(subnetIp, newPrefix));
  }
  return { originalPrefix: basePrefix, newPrefix, subnets };
}
