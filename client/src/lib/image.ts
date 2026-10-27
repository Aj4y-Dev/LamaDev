import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "@/lib/constants";

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}
export type PickResult =
  | { status: "ok"; image: PickedImage }
  | { status: "denied" }
  | { status: "cancelled" };

function toResult(res: ImagePicker.ImagePickerResult): PickResult {
  if (res.canceled || !res.assets[0]) return { status: "cancelled" };
  const a = res.assets[0];
  return {
    status: "ok",
    image: { uri: a.uri, width: a.width, height: a.height },
  };
}

export async function pickFromCamera(): Promise<PickResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: "denied" };
  return toResult(
    await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }),
  );
}

export async function pickFromGallery(): Promise<PickResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: "denied" };
  return toResult(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    }),
  );
}

export class ImageTooLargeError extends Error {}

/** Resize long edge to 2000 px, JPEG 0.8, reject > 8 MB. */
export async function compressForUpload(img: PickedImage): Promise<string> {
  const ctx = ImageManipulator.manipulate(img.uri);
  if (Math.max(img.width, img.height) > MAX_IMAGE_EDGE) {
    ctx.resize(
      img.width >= img.height
        ? { width: MAX_IMAGE_EDGE }
        : { height: MAX_IMAGE_EDGE },
    );
  }
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
  });
  const blob = await (await fetch(out.uri)).blob();
  if (blob.size > MAX_IMAGE_BYTES) throw new ImageTooLargeError("too large");
  return out.uri;
}

export type PickManyResult =
  | { status: "ok"; images: PickedImage[] }
  | { status: "denied" }
  | { status: "cancelled" };

export async function pickManyFromGallery(): Promise<PickManyResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: "denied" };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
  });
  if (res.canceled || res.assets.length === 0) return { status: "cancelled" };
  return {
    status: "ok",
    images: res.assets.map((a) => ({
      uri: a.uri,
      width: a.width,
      height: a.height,
    })),
  };
}
