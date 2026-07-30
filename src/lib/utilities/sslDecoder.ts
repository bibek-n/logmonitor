import { X509Certificate } from "crypto";

export function decodeCertificate(pem: string): X509Certificate {
  return new X509Certificate(pem);
}

export function formatDecodedCertificate(cert: X509Certificate): string {
  const lines = [
    `Subject:             ${cert.subject.replace(/\n/g, ", ")}`,
    `Issuer:              ${cert.issuer.replace(/\n/g, ", ")}`,
    `Valid From:          ${cert.validFrom}`,
    `Valid To:            ${cert.validTo}`,
    `Serial Number:       ${cert.serialNumber}`,
    `SHA-1 Fingerprint:   ${cert.fingerprint}`,
    `SHA-256 Fingerprint: ${cert.fingerprint256}`,
    `Is CA:               ${cert.ca ? "Yes" : "No"}`,
  ];
  if (cert.subjectAltName) lines.push(`Subject Alt Names:   ${cert.subjectAltName}`);
  if (cert.keyUsage && cert.keyUsage.length) lines.push(`Key Usage:           ${cert.keyUsage.join(", ")}`);

  const daysLeft = Math.floor((new Date(cert.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  lines.push(daysLeft < 0 ? `Status:              EXPIRED ${Math.abs(daysLeft)} day(s) ago` : `Status:              Valid, expires in ${daysLeft} day(s)`);

  return lines.join("\n");
}
