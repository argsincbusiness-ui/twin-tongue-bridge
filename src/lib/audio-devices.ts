/**
 * Real audio-device discovery and routing helpers.
 *
 * Everything here reflects what the browser actually exposes — there is no
 * simulated Bluetooth state. Device labels are only populated after the user
 * has granted microphone permission, which the UI makes explicit.
 */

export type AudioKind = "audioinput" | "audiooutput";

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: AudioKind;
  /** True when the OS-provided label identifies a wireless device. */
  bluetooth: boolean;
  /** True for wired headsets / USB audio interfaces. */
  wired: boolean;
}

export interface AudioDeviceSnapshot {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  /** Labels are only exposed once mic permission has been granted. */
  labelled: boolean;
  /** enumerateDevices is unavailable (insecure context / old browser). */
  supported: boolean;
  /** Output routing via HTMLMediaElement.setSinkId is available. */
  canChooseOutput: boolean;
}

const BLUETOOTH_HINTS =
  /(bluetooth|\bbt\b|airpods|buds|beats|jabra|bose|sony wh|sony wf|jbl|soundcore|anker|headset|earbud|wireless)/i;
const WIRED_HINTS = /(usb|wired|headphone|jack|3\.5|type-c|typec|dock|hdmi)/i;

export function looksBluetooth(label: string): boolean {
  return BLUETOOTH_HINTS.test(label);
}

export function looksWired(label: string): boolean {
  return !looksBluetooth(label) && WIRED_HINTS.test(label);
}

/** Human label for a device entry, falling back when the OS hides it. */
export function deviceLabel(device: MediaDeviceInfo, index: number): string {
  if (device.label) return device.label;
  if (device.deviceId === "default") return "System default";
  return `${device.kind === "audioinput" ? "Microphone" : "Speaker"} ${index + 1}`;
}

export function supportsOutputSelection(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (HTMLMediaElement.prototype as unknown as { setSinkId?: unknown })
    .setSinkId === "function";
}

export function mediaDevicesAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.enumerateDevices === "function"
  );
}

export async function enumerateAudioDevices(): Promise<AudioDeviceSnapshot> {
  const empty: AudioDeviceSnapshot = {
    inputs: [],
    outputs: [],
    labelled: false,
    supported: false,
    canChooseOutput: false,
  };
  if (!mediaDevicesAvailable()) return empty;

  const all = await navigator.mediaDevices.enumerateDevices();
  const map = (kind: AudioKind) =>
    all
      .filter((d) => d.kind === kind)
      .map((d, i) => {
        const label = deviceLabel(d, i);
        return {
          deviceId: d.deviceId,
          label,
          kind,
          bluetooth: looksBluetooth(label),
          wired: looksWired(label),
        } satisfies AudioDevice;
      });

  const inputs = map("audioinput");
  const outputs = map("audiooutput");
  return {
    inputs,
    outputs,
    labelled: all.some((d) => d.kind.startsWith("audio") && !!d.label),
    supported: true,
    canChooseOutput: supportsOutputSelection(),
  };
}

/**
 * Ask for microphone access so device labels become readable, then release
 * the stream immediately — the conversation engine opens its own.
 */
export async function primeDeviceLabels(): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, error: "This browser cannot access microphones." };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (e) {
    const name = (e as Error).name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return { ok: false, error: "Microphone access was blocked in your browser settings." };
    }
    if (name === "NotFoundError") return { ok: false, error: "No microphone was found." };
    if (name === "NotReadableError") {
      return { ok: false, error: "Another app is using the microphone." };
    }
    return { ok: false, error: (e as Error).message };
  }
}

/** Short, honest description of the current routing. */
export function connectionSummary(
  input: AudioDevice | null,
  output: AudioDevice | null,
): { icon: "bluetooth" | "wired" | "phone"; text: string } {
  const bt = input?.bluetooth || output?.bluetooth;
  if (bt) return { icon: "bluetooth", text: "Wireless audio device in use" };
  const wired = input?.wired || output?.wired;
  if (wired) return { icon: "wired", text: "Wired / USB audio device in use" };
  return { icon: "phone", text: "Built-in microphone and speaker" };
}

/** Pick a still-present device, falling back to the system default. */
export function resolveSelection(
  devices: AudioDevice[],
  selectedId: string | null,
): AudioDevice | null {
  if (devices.length === 0) return null;
  const found = devices.find((d) => d.deviceId === selectedId);
  if (found) return found;
  return devices.find((d) => d.deviceId === "default") ?? devices[0]!;
}
