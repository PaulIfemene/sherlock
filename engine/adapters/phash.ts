// Decode an image to 32x32 greyscale with sharp, then hash with the pure pHash.
import sharp from 'sharp'
import { phashFromGrey } from '../phash'

export async function imagePhash(image: Uint8Array): Promise<string> {
  const pixels = await sharp(image).resize(32, 32, { fit: 'fill' }).greyscale().raw().toBuffer()
  return phashFromGrey(pixels)
}
