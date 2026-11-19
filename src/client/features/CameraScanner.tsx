import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/** Reads QR codes from the camera; calls `onCode` with each new one. */
export function CameraScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const last = useRef<{ code: string; at: number } | null>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setError("The camera isn't available. Type the code instead.");
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      const Native = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      const tick = async () => {
        if (stopped || !video.current) return;
        const v = video.current;
        let found: string | null = null;
        if (v.readyState >= 2) {
          if (detector) {
            const codes = await detector.detect(v).catch(() => []);
            found = codes[0]?.rawValue ?? null;
          } else if (jsQR && ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            found = jsQR(image.data, image.width, image.height)?.data ?? null;
          }
        }
        if (found) {
          const now = Date.now();
          if (!last.current || last.current.code !== found || now - last.current.at > 4000) {
            last.current = { code: found, at: now };
            onCodeRef.current(found);
          }
        }
        timer = setTimeout(tick, 250);
      };
      void tick();
    }
    void start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <Alert>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  return <video ref={video} className="aspect-square w-full max-w-xs rounded-xl bg-muted object-cover" muted playsInline />;
}
