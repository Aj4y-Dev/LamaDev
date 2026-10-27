import type { ComponentRef, RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

/** Adapter: captures the report view as a JPG and opens the share sheet. */
export async function exportJpg(
  target: RefObject<ComponentRef<typeof View> | null>,
): Promise<void> {
  if (!target.current) throw new Error("Nothing to capture");
  const uri = await captureRef(target, {
    format: "jpg",
    quality: 0.9,
    result: "tmpfile",
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "image/jpeg" });
  }
}
