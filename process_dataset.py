import cv2
import mediapipe as mp
import numpy as np
import csv
import os
import math
from pathlib import Path

DATASET_DIR = "dataset"        
OUTPUT_CSV  = "silentsign_dataset_images.csv"
mp_hands = mp.solutions.hands

def normalize_hand(landmarks):
    """Normalize 21 landmarks: subtract wrist, scale by wrist→point9 distance."""
    wrist = landmarks[0]
    norm = [(lm[0]-wrist[0], lm[1]-wrist[1], lm[2]-wrist[2]) for lm in landmarks]
    ref = norm[9]
    scale = math.sqrt(ref[0]**2 + ref[1]**2 + ref[2]**2) or 1.0
    return [v/scale for lm in norm for v in lm]  # 63 floats

def extract_features(image_path):
    """Run MediaPipe on one image, return 126-float feature vector or None."""
    img = cv2.imread(str(image_path))
    if img is None:
        return None
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    with mp_hands.Hands(
        static_image_mode=True,
        max_num_hands=2,
        min_detection_confidence=0.3
    ) as hands:
        results = hands.process(img_rgb)

    if not results.multi_hand_landmarks:
        return None

    h, w, _ = img.shape
    hand_features = {}

    for i, hand_landmarks in enumerate(results.multi_hand_landmarks):
        label = results.multi_handedness[i].classification[0].label  # 'Left' or 'Right'
        landmarks = [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark]
        hand_features[label] = normalize_hand(landmarks)

    zeros = [0.0] * 63
    right = hand_features.get('Right', zeros)
    left  = hand_features.get('Left',  zeros)
    return right + left  # 126 floats

def main():
    dataset_path = Path(DATASET_DIR)
    if not dataset_path.exists():
        print(f"ERROR: '{DATASET_DIR}' folder not found. Put this script next to your dataset folder.")
        return

    letters = sorted([d.name for d in dataset_path.iterdir() if d.is_dir()])
    print(f"Found {len(letters)} letter folders: {', '.join(letters)}")

    header = [f"f{i}" for i in range(126)] + ["label"]
    total = 0
    skipped = 0

    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)

        for letter in letters:
            letter_dir = dataset_path / letter
            images = list(letter_dir.glob("*.jpg")) + \
                     list(letter_dir.glob("*.jpeg")) + \
                     list(letter_dir.glob("*.png"))

            letter_count = 0
            for img_path in images:
                features = extract_features(img_path)
                if features is None:
                    skipped += 1
                    continue
                writer.writerow(features + [letter.upper()])
                letter_count += 1
                total += 1

            print(f"  {letter}: {letter_count}/{len(images)} images processed")

    print(f"\nDone! {total} rows saved to {OUTPUT_CSV}")
    print(f"Skipped {skipped} images (no hand detected)")

if __name__ == "__main__":
    main()