import re, numpy as np
from collections import defaultdict

names = np.load("gallery_embeddings.npz")["filenames"]
cams = defaultdict(set)
for n in names:
    m = re.match(r"(\d+)_c(\d+)_", str(n))
    cams[int(m.group(1))].add(int(m.group(2)))

print(sorted(cams[108]))