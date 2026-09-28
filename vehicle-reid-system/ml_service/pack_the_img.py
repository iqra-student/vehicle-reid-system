import os, pickle

src = r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"
data = {}
for f in sorted(os.listdir(src)):
    if f.lower().endswith((".jpg", ".jpeg", ".png")):
        with open(os.path.join(src, f), "rb") as fh:
            data[f] = fh.read()

with open("image_test.pkl", "wb") as out:
    pickle.dump(data, out, protocol=4)

print(len(data), "images packed")