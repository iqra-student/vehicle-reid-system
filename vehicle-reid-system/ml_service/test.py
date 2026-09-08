import xml.etree.ElementTree as ET
from collections import defaultdict

with open(r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\test_label.xml", "r", encoding="gb2312", errors="ignore") as f:
    content = f.read()

root = ET.fromstring(content)

vehicle_info = {}
for item in root.iter("Item"):
    vid = item.get("vehicleID")
    color = item.get("colorID")
    vtype = item.get("typeID")
    img = item.get("imageName")
    if vid not in vehicle_info:
        vehicle_info[vid] = {"color": color, "type": vtype, "images": []}
    vehicle_info[vid]["images"].append(img)

group = defaultdict(list)
for vid, info in vehicle_info.items():
    key = (info["color"], info["type"])
    group[key].append(vid)

for key, vids in group.items():
    if len(vids) >= 2:
        print(f"Color/Type {key}: vehicles {vids[:2]}")
        print("Vehicle 1 images:", vehicle_info[vids[0]]["images"][:3])
        print("Vehicle 2 images:", vehicle_info[vids[1]]["images"][:3])
        break