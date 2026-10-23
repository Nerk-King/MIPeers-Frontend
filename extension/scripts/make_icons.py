"""
One-off generator for the extension's toolbar icons. Not part of any build step — run manually
(`python scripts/make_icons.py`) only if the icon needs regenerating. Draws a simplified version of
the robot mascot used throughout the main app (see src/components/AgentAvatar.vue), since there's
no SVG-to-PNG tool available in this environment to rasterize that SVG directly.
"""
from PIL import Image, ImageDraw
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..")
SIZE = 512  # draw large, downsample for crisp edges at each target size

SHELL_TOP = (209, 249, 103)     # #d1f967
SHELL_BOTTOM = (7, 140, 169)    # #078ca9
EAR = (12, 153, 172)            # #0c99ac
FACE_TOP = (18, 72, 94)         # #12485e
FACE_BOTTOM = (7, 27, 50)       # #071b32
EYE = (100, 245, 245)           # #64f5f5
OUTLINE = (9, 45, 66, 255)      # #092d42
ANTENNA = (182, 237, 81)        # #b6ed51


def vertical_gradient(size, top, bottom):
 img = Image.new("RGB", (1, size[1]), color=0)
 for y in range(size[1]):
  t = y / max(1, size[1] - 1)
  r = round(top[0] + (bottom[0] - top[0]) * t)
  g = round(top[1] + (bottom[1] - top[1]) * t)
  b = round(top[2] + (bottom[2] - top[2]) * t)
  img.putpixel((0, y), (r, g, b))
 return img.resize(size)


def rounded_mask(size, radius):
 mask = Image.new("L", size, 0)
 d = ImageDraw.Draw(mask)
 d.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
 return mask


def draw_icon(size):
 s = size
 canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))

 # Antenna
 draw = ImageDraw.Draw(canvas)
 cx = s // 2
 draw.line([(cx, int(s * 0.16)), (cx, int(s * 0.26))], fill=OUTLINE, width=max(2, s // 40))
 r = max(6, s // 16)
 draw.ellipse([cx - r, int(s * 0.10) - r, cx + r, int(s * 0.10) + r], fill=ANTENNA, outline=OUTLINE, width=max(2, s // 60))

 # Ears (behind head)
 ear_w, ear_h = int(s * 0.14), int(s * 0.30)
 ear_y = int(s * 0.34)
 draw.rounded_rectangle([int(s * 0.08), ear_y, int(s * 0.08) + ear_w, ear_y + ear_h], radius=ear_w // 2, fill=EAR, outline=OUTLINE, width=max(2, s // 60))
 draw.rounded_rectangle([s - int(s * 0.08) - ear_w, ear_y, s - int(s * 0.08), ear_y + ear_h], radius=ear_w // 2, fill=EAR, outline=OUTLINE, width=max(2, s // 60))

 # Head (shell gradient, rounded)
 head_box = [int(s * 0.18), int(s * 0.24), int(s * 0.82), int(s * 0.78)]
 head_size = (head_box[2] - head_box[0], head_box[3] - head_box[1])
 shell = vertical_gradient(head_size, SHELL_TOP, SHELL_BOTTOM).convert("RGBA")
 mask = rounded_mask(head_size, int(head_size[1] * 0.42))
 shell.putalpha(mask)
 canvas.alpha_composite(shell, (head_box[0], head_box[1]))
 draw.rounded_rectangle(head_box, radius=int(head_size[1] * 0.42), outline=OUTLINE, width=max(2, s // 50))

 # Face plate (inset)
 pad_x, pad_top, pad_bottom = int(head_size[0] * 0.14), int(head_size[1] * 0.28), int(head_size[1] * 0.14)
 face_box = [head_box[0] + pad_x, head_box[1] + pad_top, head_box[2] - pad_x, head_box[3] - pad_bottom]
 face_size = (face_box[2] - face_box[0], face_box[3] - face_box[1])
 face = vertical_gradient(face_size, FACE_TOP, FACE_BOTTOM).convert("RGBA")
 face_mask = rounded_mask(face_size, int(face_size[1] * 0.38))
 face.putalpha(face_mask)
 canvas.alpha_composite(face, (face_box[0], face_box[1]))

 # Eyes
 eye_w, eye_h = int(face_size[0] * 0.22), int(face_size[1] * 0.3)
 eye_y = face_box[1] + int(face_size[1] * 0.32)
 eye_lx = face_box[0] + int(face_size[0] * 0.18)
 eye_rx = face_box[2] - int(face_size[0] * 0.18) - eye_w
 for ex in (eye_lx, eye_rx):
  draw.ellipse([ex, eye_y, ex + eye_w, eye_y + eye_h], fill=EYE)

 # Mouth (simple smile arc)
 mouth_box = [face_box[0] + int(face_size[0] * 0.3), eye_y + eye_h, face_box[2] - int(face_size[0] * 0.3), eye_y + eye_h + int(face_size[1] * 0.35)]
 draw.arc(mouth_box, start=20, end=160, fill=EYE, width=max(2, s // 60))

 return canvas


def main():
 for size, name in [(128, "icon128.png"), (48, "icon48.png"), (16, "icon16.png")]:
  icon = draw_icon(SIZE).resize((size, size), Image.LANCZOS)
  path = os.path.join(OUT_DIR, name)
  icon.save(path)
  print(f"wrote {path}")


if __name__ == "__main__":
 main()
