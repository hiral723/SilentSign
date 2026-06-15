# SilentSign

> Real-time ASL finger spelling to text — directly in your browser.

SilentSign is a Chrome extension that translates American Sign Language (ASL) finger spelling into text using your camera. It runs entirely on your device — no internet connection, no server, no GPU required. It also ships with a **Dev Trainer** web app for recording your own hand sign data and training a custom neural network entirely in the browser.

---

## Repository Structure

```
SilentSign/
├── extension/               # Chrome extension
│   ├── icons/               # Extension icons
│   ├── mediapipe/           # Local MediaPipe files (see setup)
│   ├── model/               # Trained TF.js model (see dataset section)
│   ├── tfjs/                # Local TF.js build
│   ├── manifest.json
│   ├── background.js        # Service worker — manages camera tab
│   ├── content.js           # In-page subtitle overlay
│   ├── overlay.css
│   ├── popup.html           # Extension popup UI
│   ├── popup.js             # Popup logic
│   ├── popup.css
│   ├── permission.html      # Camera tab (runs MediaPipe + inference)
│   └── permission.js        # Full camera + detection pipeline
│
├── trainer/                 # Dev Trainer web app
│   ├── src/
│   │   ├── Collector.jsx    # Data collection UI
│   │   ├── Trainer.jsx      # Model training UI
│   │   ├── useMediaPipe.js  # Camera + hand tracking hook
│   │   ├── TrainerApp.jsx
│   │   └── config.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── process_dataset.py       # Converts ASL image dataset → training CSV
├── generate-icons.js        # Icon generation utility
└── .gitignore
```

---

## Dataset

The dataset is **not included in this repository** due to size. It is a merged CSV with 12,000+ samples across all 26 ASL letters (A–Z), combining:

1. **Recorded samples** — collected using the Dev Trainer with a real webcam
2. **Image dataset samples** — extracted from a folder-organized ASL image dataset using `process_dataset.py`

### Download the dataset
> 📁 **[Download merged CSV from Google Drive](https://drive.google.com/file/d/16Km9rLsWIZYa6fk78CMZ4JXA4iDuCbHq/view?usp=sharing)**

Place the CSV in the `trainer/` folder when training.

### Generating the CSV from images yourself

If you have an ASL image dataset organized like:
```
dataset/
  A/  B/  C/ ... Z/
```

Run `process_dataset.py` — it uses MediaPipe to extract hand landmarks from every image and outputs a CSV in the exact format the trainer expects:

```bash
pip install mediapipe==0.10.14 opencv-python   # requires Python 3.9–3.12
python process_dataset.py
```

This outputs `silentsign_dataset_images.csv` with 127 columns — `f0` through `f125` (126 landmark features) + `label`. You can merge this with any CSV exported from the trainer before training for better accuracy.

---

## How It Works

```
Camera → MediaPipe Hands → Landmark Normalization → Neural Network → Letter
```

- **MediaPipe Hands** detects 21 landmarks per hand at up to 30fps, locally in the browser
- Each frame produces a **126-dimensional feature vector** — 63 values per hand (right hand first, then left), zeros if a hand is not visible
- Landmarks are normalized: wrist-relative, scaled by wrist→middle-finger-base distance — making the model robust to hand size, distance, and camera position
- A **TensorFlow.js neural network** classifies the 126 features into one of 26 ASL letters
- Temporal smoothing over a sliding window + hold-frame threshold reduces noise and false positives

---

## Setup

### Prerequisites
- Node.js 18+
- Google Chrome
- Python 3.9–3.12 (only needed for `process_dataset.py`)

---

### 1. Trainer

```bash
cd trainer
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome.

**Collect tab** — Start camera, select a letter, click Record. Aim for 150+ samples per sign. Vary hand position, distance from camera, and lighting between bursts. Export CSV when done.

**Train tab** — Upload your CSV, click Train Neural Network. Runs entirely in the browser (~2 min). Downloads `model.json` and `model.weights.bin` when complete.

---

### 2. Extension Setup

#### Download MediaPipe and TF.js files

Run from the `extension/` folder:

```bash
cd extension
npm install
mkdir -p tfjs mediapipe model

# TF.js — must use es2017 build (NOT tf.min.js, uses eval which MV3 blocks)
cp node_modules/@tensorflow/tfjs/dist/tf.es2017.js tfjs/tf.es2017.js

# MediaPipe scripts
curl -o mediapipe/hands.js https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js
curl -o mediapipe/camera_utils.js https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js
curl -o mediapipe/drawing_utils.js https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js
curl -o mediapipe/hands_solution_packed_assets_loader.js https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands_solution_packed_assets_loader.js
curl -o mediapipe/hands_solution_simd_wasm_bin.js https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands_solution_simd_wasm_bin.js
curl -o mediapipe/hands.binarypb https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.binarypb
curl -o mediapipe/hand_landmark_full.tflite https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hand_landmark_full.tflite
curl -o mediapipe/palm_detection_full.tflite https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/palm_detection_full.tflite
```

> On Windows use `curl.exe` instead of `curl`

#### Add your trained model

Copy the files output by the trainer into the extension:

```
extension/model/model.json
extension/model/model.weights.bin
```

Open `model.json` and check the `"paths"` field at the bottom — make sure it matches your `.bin` filename exactly.

#### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. The SilentSign icon appears in your toolbar

---

### 3. Using the Extension

1. Click the **SilentSign** icon in Chrome
2. Click **Start translating** — a camera tab opens automatically
3. Allow camera access when Chrome prompts (one time only)
4. Sign ASL letters in front of your camera
5. Letters and words appear in the popup and as a subtitle overlay on the page
6. Use **Copy** to copy the full transcript, **Overlay** to toggle subtitles on the current page
7. Click **Stop translating** to close the camera

> Keep the camera tab open while translating — this is a Chrome MV3 requirement. Extension popups cannot access the camera directly.

---

## CSV Format

| Columns | Description |
|---------|-------------|
| `f0` – `f62` | Right hand landmarks (63 floats) |
| `f63` – `f125` | Left hand landmarks (63 floats) |
| `label` | Uppercase letter A–Z |

Each hand: 21 landmarks × 3 axes (x, y, z) = 63 floats. Normalized wrist-relative and scale-invariant. Zeros if that hand is not detected in the frame.

---

## Model Architecture

```
Input(126) → Dense(256, ReLU) → BatchNorm → Dropout(0.3)
           → Dense(128, ReLU) → BatchNorm → Dropout(0.2)
           → Dense(64,  ReLU)
           → Dense(26,  Softmax)
```

Trained with Adam optimizer, categorical crossentropy loss, 60 epochs — entirely in the browser via TensorFlow.js.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| MediaPipe Hands | Real-time hand landmark detection (in-browser) |
| TensorFlow.js | In-browser neural network training and inference |
| React + Vite | Dev Trainer web app |
| Chrome Extensions MV3 | Browser extension architecture |
| JavaScript | Extension and trainer logic |
| Python + OpenCV | Image dataset processing (`process_dataset.py`) |

---

## Tips for Better Accuracy

- Record **150–200 samples per sign** minimum
- Do **short bursts** (2–3 sec), reposition hand slightly between each burst
- Vary **distance** from camera — close, medium, arm's length
- Vary **lighting** — bright, dim, side-lit
- Signs that look similar (H/U, M/N, R/U) need more samples to distinguish

---

## Known Limitations

- Works best in good lighting with a plain background
- Similar-looking signs may be confused with limited training data
- Requires a dedicated browser tab to stay open while translating (Chrome MV3 restriction)
- Currently supports ASL finger spelling only (A–Z), not full ASL words or phrases
