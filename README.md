# PulseVision AI - Patient Body-Part Localization & Vitals Dashboard

PulseVision AI is a lightweight, high-performance web application designed to automatically detect and map anatomical body regions from standard patient photographs, evaluate patient vital signs using clinical rule thresholds, and generate clinician-ready clinical insights using a local LLM.

---

## Technical Features

- **MediaPipe Pose Tracking**: Employs Google's MediaPipe Pose model to locate 33 key physical joints (landmarks) on the patient.
- **Dynamic Bounding Boxes**: Automatically groups joints anatomically into six major regions:
  - **Head**, **Chest / Torso**, **Left / Right Arms**, and **Left / Right Legs**.
- **Rule-Based Vitals Evaluation**: Evaluates patient vital signs (heart rate, blood pressure, oxygen saturation, temperature, respiratory rate) against clinical thresholds to immediately flag abnormal readings.
- **Local LLM-Powered Insights**: Integrates with local Ollama service (`llama3.1:8b`, etc.) to produce clinician summaries, risk level classifications, and monitoring suggestions with zero cloud requirements.
- **Robust Failover System**: Automatically falls back to local rule-based clinical insights if Ollama is offline or unreachable.
- **Clinical Aesthetics**: Features a modern web app dashboard built using glassmorphism, glowing telemetry accents, real-time webcam telemetry, and AI vitals analysis panels.
- **Developer API Integration**: Exposes endpoints `/detect` for pose coordinates and `/analyze-vitals` for local LLM vitals diagnostics.

---

## Folder Structure

```
project/
├── app.py                      # Flask main server application
├── requirements.txt            # Python package dependencies
├── README.md                   # This instruction manual
├── LLM_VITALS_GUIDE.md         # Local LLM Vitals Integration Manual
├── backend/                    # Modular vitals & LLM services
│   ├── config/
│   │   └── vitals_thresholds.py # Configurable vitals range thresholds
│   ├── services/
│   │   ├── vitals_analysis_service.py # Rule-based vitals checker
│   │   └── llm_service.py      # Ollama local LLM integration
│   └── routes/
│       └── vitals_routes.py    # POST /analyze-vitals blueprint route
├── uploads/                    # Sandbox folder for raw uploads
├── outputs/                    # Sandbox folder for annotated outcomes
├── static/
│   ├── css/
│   │   └── style.css           # Premium stylesheet
│   └── js/
│       └── app.js              # Frontend interactive application logic
├── templates/
│   └── index.html              # Main HTML panel dashboard
└── detector/
    ├── __init__.py             # Python package marker
    └── pose_detector.py        # MediaPipe and OpenCV detection engine
```

---

## Getting Started

### Prerequisites

Ensure you have **Python 3.8+** installed on your system.

### Installation

1. Clone or download this project folder into your workspace directory.
2. Open your shell (Terminal or PowerShell) in the project directory.
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

Start the Flask development server:
```bash
python app.py
```

By default, the server will launch on:
[http://127.0.0.1:5000](http://127.0.0.1:5000)

Open this URL in any modern web browser to interact with the dashboard.

---

## API Documentation

### Bounding Box Extraction API

- **Endpoint**: `/detect`
- **Method**: `POST`
- **Payload Type**: `multipart/form-data`
- **Parameter**: `image` (File input)

#### Example Response (Success)

```json
{
  "success": true,
  "detected": true,
  "head": [210, 84, 380, 260],
  "chest": [180, 260, 410, 520],
  "left_arm": [390, 260, 480, 480],
  "right_arm": [110, 260, 200, 480],
  "left_leg": [280, 520, 390, 910],
  "right_leg": [180, 520, 290, 910],
  "processed_image": "/outputs/4a5b6c7d8e.jpg",
  "coordinates": {
    "head": [210, 84, 380, 260],
    "chest": [180, 260, 410, 520],
    "left_arm": [390, 260, 480, 480],
    "right_arm": [110, 260, 200, 480],
    "left_leg": [280, 520, 390, 910],
    "right_leg": [180, 520, 290, 910]
  }
}
```

*Note: If any body region falls below the visibility threshold (e.g. cropped out of the photograph), its coordinate field in the JSON will return `null`.*

---

## Healthcare System Integration Guide

To integrate this utility into a larger healthcare environment (like a telehealth provider website or hospital system):

1. **Service-Oriented Decoupling**: 
   The code is structured with a standalone detector layer inside `detector/pose_detector.py`. You can import `PoseDetector` directly into other backend architectures (such as Django, FastAPI, or Celery task queues) to handle batch diagnostic jobs.
2. **Database Integration**:
   Instead of just returning the JSON payload, save the returned bounding box coordinates into database records tied to the patient's record ID.
3. **PACS/DICOM Storage**:
   The generated annotated outputs can be converted into standard DICOM images using Python libraries like `pydicom` and uploaded to a hospital's PACS server for medical records keeping.
4. **Security & HIPAA Compliance**:
   Ensure patient photographs are transmitted over secure HTTPS channels, and implement authentication tokens (JWT or session keys) on the `/detect` endpoint. In production, configure automatic deletion policies on the `uploads/` and `outputs/` directories to prevent retaining Protected Health Information (PHI) longer than required.
