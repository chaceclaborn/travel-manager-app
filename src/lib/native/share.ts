import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export type ShareResult = 'native' | 'web' | 'clipboard' | 'cancelled' | 'failed';

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
  dialogTitle?: string;
}

/**
 * Three-tier share: Capacitor native sheet on iOS/Android, Web Share API on
 * supporting browsers (mobile Safari / Chrome Android), clipboard copy as
 * final fallback on desktop. Returning the tier used lets callers show an
 * accurate toast ("Copied" vs "Shared") without duplicating the detection.
 *
 * Why three tiers, not two: Apple Guideline 4.2 wants a concretely native
 * feature — the Capacitor path satisfies that. The Web Share API path keeps
 * mobile-web users first-class. The clipboard path avoids a silent failure
 * on desktop where neither is available.
 */
export async function nativeShare(payload: SharePayload): Promise<ShareResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          dialogTitle: payload.dialogTitle ?? payload.title,
        });
        return 'native';
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(msg)) return 'cancelled';
      return 'failed';
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return 'web';
    } catch (err) {
      // AbortError fires when the user dismisses the sheet — not a failure.
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(payload.url);
      return 'clipboard';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}
