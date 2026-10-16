"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui";

// Minimal typing for the Barcode Detection API (Chrome on Android, Edge, etc.).
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorInstance;

function getDetector(): BarcodeDetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

const noop = () => () => {};

/** Opens the camera and reads the barcode / QR code on an ID card. Hidden where unsupported. */
export function CameraScanButton({ onDetected }: { onDetected: (value: string) => void }) {
  const supported = useSyncExternalStore(
    noop,
    () => !!getDetector() && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );
  const [open, setOpen] = useState(false);
  if (!supported) return null;
  return (
    <>
      <Button type="button" size="lg" onClick={() => setOpen(true)} aria-label="Scan ID card with camera" className="px-4">
        <Camera className="size-5" aria-hidden />
      </Button>
      {open && (
        <ScannerDialog
          onClose={() => setOpen(false)}
          onDetected={(v) => {
            setOpen(false);
            onDetected(v);
          }}
        />
      )}
    </>
  );
}

function ScannerDialog({ onClose, onDetected }: { onClose: () => void; onDetected: (v: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const Detector = getDetector()!;
    const detector = new Detector({
      formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "itf", "codabar"],
    });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(video);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              onDetected(value);
              return;
            }
          } catch {
            // Frame not ready yet; keep scanning.
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Camera unavailable. Allow camera access or type the roll number.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal aria-label="Scan ID card">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="font-medium">Point the camera at the ID card barcode</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close scanner">
            <X className="size-5" />
          </button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} className="size-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-10 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80" />
        </div>
        {error && <p className="px-4 py-3 text-sm text-danger-ink">{error}</p>}
      </div>
    </div>
  );
}
