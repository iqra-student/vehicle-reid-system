import os
import numpy as np
from main import extract_clip_embedding  # reuse your existing function

GALLERY_DIR = r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"
gallery_embeddings = []
gallery_filenames = []

for fname in os.listdir(GALLERY_DIR):
    if fname.endswith(".jpg"):
        emb = extract_clip_embedding(os.path.join(GALLERY_DIR, fname))
        gallery_embeddings.append(emb)
        gallery_filenames.append(fname)

np.savez("gallery_embeddings.npz",
         embeddings=np.array(gallery_embeddings),
         filenames=np.array(gallery_filenames))
print(f"Saved {len(gallery_filenames)} gallery embeddings")