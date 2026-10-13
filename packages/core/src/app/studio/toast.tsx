import { CircleAlert, CircleCheck } from 'lucide-react';
import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { useStudioScheme } from './scheme.ts';

const FLASH = 'open-form:flash';

function showFlash(): void {
  let flash: { message?: string; at?: number } | null = null;
  try {
    flash = JSON.parse(sessionStorage.getItem(FLASH) ?? 'null');
    sessionStorage.removeItem(FLASH);
  } catch {}
  if (flash?.message && Date.now() - (flash.at ?? 0) < 10_000) toast.success(flash.message);
}

/**
 * A success toast that outlives the full reload `open-form dev` sends when a
 * form folder disappears. If no reload comes, it shows here a moment later.
 */
export function flashSuccess(message: string): void {
  try {
    sessionStorage.setItem(FLASH, JSON.stringify({ message, at: Date.now() }));
  } catch {
    toast.success(message);
    return;
  }
  setTimeout(showFlash, 1200);
}

/** Brief confirmations ("Moved … to …") and errors from Studio actions, via Sonner's `toast`. */
export function StudioToaster() {
  const scheme = useStudioScheme();
  useEffect(showFlash, []);
  return (
    <Toaster
      theme={scheme}
      position="bottom-right"
      icons={{
        success: <CircleCheck className="size-4 text-emerald-500" aria-hidden />,
        error: <CircleAlert className="size-4" aria-hidden />,
      }}
    />
  );
}
