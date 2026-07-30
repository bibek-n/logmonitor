import { runRemoteCommand, sendTerminalInput, startTerminalSession } from "./connectionService";

// Docker/Kubernetes terminal (Phase 3) - deliberately NOT a new protocol gateway. A connection
// that already has a working SSH shell (this app's existing Terminal) can just as well run
// `docker exec` / `kubectl exec` as its first command - so "container listing" is a one-off
// `docker ps`/`kubectl get pods` run over the connection's existing SSH auth, and "open a shell
// in a container" is: start a normal Terminal session, then write the exec command as the first
// keystrokes into that already-open shell channel, exactly like a user would type it themselves.
// This reuses 100% of the existing Terminal infrastructure (including its recording) rather than
// inventing a second live-session type.

const SAFE_IDENTIFIER = /^[a-zA-Z0-9_.:-]+$/;

function assertSafeIdentifier(value: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`Invalid ${label} - only letters, numbers, '.', '_', '-', ':' are allowed.`);
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
}

export async function listDockerContainers(connectionId: number): Promise<DockerContainer[]> {
  const { stdout, code } = await runRemoteCommand(connectionId, "docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}'");
  if (code !== 0) throw new Error("docker ps failed - is Docker installed and accessible to this user on the target host?");
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, name, image, ...statusParts] = line.split("|");
      return { id: id ?? "", name: name ?? "", image: image ?? "", status: statusParts.join("|") };
    })
    .filter((c) => c.id);
}

export interface KubernetesPod {
  name: string;
  ready: string;
  status: string;
  restarts: string;
  age: string;
}

export async function listKubernetesPods(connectionId: number, namespace: string): Promise<KubernetesPod[]> {
  assertSafeIdentifier(namespace, "namespace");
  const { stdout, code } = await runRemoteCommand(connectionId, `kubectl get pods -n ${namespace} --no-headers`);
  if (code !== 0) throw new Error("kubectl get pods failed - is kubectl installed and configured for this user on the target host?");
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      return { name: parts[0] ?? "", ready: parts[1] ?? "", status: parts[2] ?? "", restarts: parts[3] ?? "", age: parts[4] ?? "" };
    })
    .filter((p) => p.name);
}

// Opens a normal Terminal session on the connection's host, then writes the exec command as the
// session's first input - the browser terminal that opens is already inside the container/pod
// shell, without this app ever needing its own protocol gateway for it.
export async function openDockerContainerShell(connectionId: number, containerId: string, userId: number, username: string): Promise<number> {
  assertSafeIdentifier(containerId, "container ID/name");
  const sessionId = await startTerminalSession({ connectionId, userId, username });
  await new Promise((resolve) => setTimeout(resolve, 500)); // let the remote shell's own prompt settle before we type into it
  sendTerminalInput(sessionId, `docker exec -it ${containerId} sh -c "exec bash || exec sh"\n`);
  return sessionId;
}

export async function openKubernetesPodShell(connectionId: number, namespace: string, podName: string, userId: number, username: string): Promise<number> {
  assertSafeIdentifier(namespace, "namespace");
  assertSafeIdentifier(podName, "pod name");
  const sessionId = await startTerminalSession({ connectionId, userId, username });
  await new Promise((resolve) => setTimeout(resolve, 500));
  sendTerminalInput(sessionId, `kubectl exec -it ${podName} -n ${namespace} -- sh -c "exec bash || exec sh"\n`);
  return sessionId;
}
