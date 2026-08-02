"""
Sanity-check for weights/model.pth.

This does NOT run the model - it just inspects the saved state_dict to infer
what dataset it was trained on, using the size of the final classifier layer
as a fingerprint. OSNet's backbone/feature layers look identical regardless
of training data, so the classifier's output size (= number of identity
classes it was trained to distinguish) is the most reliable clue left in
the checkpoint.

Known identity-class counts for common ReID benchmarks:
  Vehicle ReID:
    VeRi-776      -> 576   train identities
    VehicleID     -> 13164 train identities (large-scale variant)
    VRIC          -> 2811  train identities
  Person ReID:
    Market1501    -> 751   train identities
    DukeMTMC-reID -> 702   train identities
    MSMT17        -> 1041  train identities

Usage:
    python check_checkpoint.py weights/model.pth
"""

import sys
import torch


def inspect_checkpoint(path: str):
    checkpoint = torch.load(path, map_location="cpu")

    # torchreid checkpoints are sometimes a raw state_dict, sometimes a dict
    # wrapping it under a "state_dict" key alongside training metadata.
    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        state_dict = checkpoint["state_dict"]
        meta_keys = [k for k in checkpoint.keys() if k != "state_dict"]
        if meta_keys:
            print("Extra metadata found in checkpoint:", meta_keys)
            for k in meta_keys:
                val = checkpoint[k]
                # only print small/simple values, skip large tensors/optimizer states
                if isinstance(val, (int, float, str)):
                    print(f"  {k}: {val}")
    else:
        state_dict = checkpoint

    print(f"\nTotal parameter tensors in checkpoint: {len(state_dict)}\n")

    classifier_layers = []
    for key, tensor in state_dict.items():
        lower_key = key.lower()
        if any(tag in lower_key for tag in ["classifier", "fc.weight", "fc.bias", "head"]):
            classifier_layers.append((key, tuple(tensor.shape)))

    if not classifier_layers:
        print("No obvious classifier layer found (checkpoint may be feature-extractor-only,")
        print("i.e. classifier head already stripped). Can't infer dataset from shape alone.")
        print("Printing last 10 layer names/shapes instead, for manual inspection:\n")
        for key, tensor in list(state_dict.items())[-10:]:
            print(f"  {key}: {tuple(tensor.shape)}")
        return

    print("Classifier / head layers found:")
    for key, shape in classifier_layers:
        print(f"  {key}: {shape}")

    # The classifier weight is typically [num_classes, feature_dim]
    known_vehicle = {576: "VeRi-776", 13164: "VehicleID", 2811: "VRIC"}
    known_person = {751: "Market1501", 702: "DukeMTMC-reID", 1041: "MSMT17"}

    print("\n--- Interpretation ---")
    matched_any = False
    for key, shape in classifier_layers:
        if len(shape) < 1:
            continue
        num_classes = shape[0]
        if num_classes in known_vehicle:
            print(f"'{key}' has {num_classes} output classes -> matches {known_vehicle[num_classes]} "
                  f"(VEHICLE dataset). Good sign.")
            matched_any = True
        elif num_classes in known_person:
            print(f"'{key}' has {num_classes} output classes -> matches {known_person[num_classes]} "
                  f"(PERSON dataset). This checkpoint was likely trained on people, not vehicles.")
            matched_any = True

    if not matched_any:
        print("Output class count didn't match a known benchmark exactly.")
        print("If it's a custom-trained checkpoint on your own vehicle dataset, that's expected -")
        print("just confirm with whoever trained it what data/labels were used.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_checkpoint.py <path-to-model.pth>")
        sys.exit(1)
    inspect_checkpoint(sys.argv[1])