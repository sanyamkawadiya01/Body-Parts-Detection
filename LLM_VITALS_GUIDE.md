# Clinical Vitals Analysis & Local LLM Integration Guide

This guide details the installation, configuration, and API specifications for the local LLM-powered patient vitals analysis feature in PulseVision AI.

---

## 1. Local Ollama Integration Setup

PulseVision AI is designed to use **Ollama** as its local inference engine. All patient health data stays entirely on your local machine; **no cloud services or external APIs are used.**

### Prerequisites
- **Ollama**: Download and install Ollama from [https://ollama.com](https://ollama.com).
- Available local models (one of): `llama3.1:8b` (default), `qwen3:8b`, `phi4`, `gemma3`.

### Step 1: Start the Ollama Service
Ensure the Ollama application is running. On Windows, verify that the Ollama icon is present in the taskbar tray, or run:
```powershell
ollama serve
```

### Step 2: Download the Required Model
By default, the server expects `llama3.1:8b`. Pull this model locally:
```powershell
ollama pull llama3.1:8b
```
*(If you want to use another model like `phi4`, run `ollama pull phi4`.)*

---

## 2. Environment Configuration

You can configure the model name and host endpoint by setting environment variables in your terminal before running the PulseVision server:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OLLAMA_HOST` | `http://localhost:11434` | The host address where the local Ollama service is listening. |
| `OLLAMA_MODEL` | `llama3.1:8b` | The model tag identifier to query for clinical insights. |
| `OLLAMA_TIMEOUT` | `15` | Timeout limit in seconds for Ollama API responses. |

### Configuration Example
To run the server using `phi4` on an alternative port:
```powershell
$env:OLLAMA_MODEL="phi4"
$env:OLLAMA_HOST="http://127.0.0.1:11434"
python app.py
```

---

## 3. API Specification

### Endpoint: Analyze Patient Vitals

- **URL**: `/analyze-vitals`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`

#### Request Payload Schema

The request payload is a JSON object containing the vital signs and patient details:

```json
{
  "age": 45,                          // Optional (Integer: 0-120)
  "gender": "male",                   // Optional (String: "male" | "female" | "other" | "")
  "heart_rate": 82,                   // Optional (Integer: 0-300)
  "blood_pressure_systolic": 118,     // Optional (Integer: 0-300)
  "blood_pressure_diastolic": 76,     // Optional (Integer: 0-200)
  "oxygen_saturation": 98,            // Optional (Integer: 0-100)
  "respiratory_rate": 16,             // Optional (Integer: 0-100)
  "temperature": 36.8                 // Optional (Float: 20.0-50.0)
}
```
*Note: While all fields are optional, you must provide at least one vital sign metric for the analysis to proceed.*

#### Successful Response Example (LLM Online)

```json
{
  "success": true,
  "analysis": {
    "summary": "Patient vital signs are stable and reside within expected adult physiological baselines.",
    "observations": [
      "Heart rate is normal (82 BPM) indicating adequate resting perfusion.",
      "Oxygen saturation is optimal at 98%.",
      "Blood pressure (118/76 mmHg) falls into the normal range."
    ],
    "risk_level": "Low",
    "recommendations": [
      "Continue standard outpatient observations.",
      "Re-assess vitals at the next scheduled physical checkup."
    ],
    "flags": []
  },
  "llm_status": "online"
}
```

#### Successful Response Example (LLM Offline / Fallback)

If the local Ollama service is unreachable or not running, the backend automatically fails over to the rule-based clinical analysis engine to generate insights and structures:

```json
{
  "success": true,
  "analysis": {
    "summary": "Rule-based assessment completed. 1 vital sign alerts detected.",
    "observations": [
      "Tachycardia: Resting heart rate is above 100 BPM.",
      "Note: Local LLM service is offline. Insights generated via rule engine analysis."
    ],
    "risk_level": "Moderate",
    "recommendations": [
      "Ensure patient is resting and comfortable. Re-assess pulse rate in 15 minutes.",
      "Confirm all readings manually with secondary clinical diagnostic equipment."
    ],
    "flags": [
      "Elevated Heart Rate"
    ]
  },
  "llm_status": "offline"
}
```

#### Error Response Example (Validation Failure)

If invalid values are passed, a `400 Bad Request` is returned with detailed field errors:

```json
{
  "success": false,
  "error": "Validation Error",
  "details": {
    "oxygen_saturation": "Value must be between 0 and 100.",
    "temperature": "Value must be between 20.0 and 50.0."
  }
}
```

---

## 4. Safety & Compliance

### Regulated Disclaimers
AI diagnostics should never make absolute medical decisions. As enforced in the panel dashboard UI:
> **AI-generated insights are informational only and should not be used as a substitute for professional medical judgment.**

### Data Privacy & HIPAA
Since Ollama runs fully locally:
- No Patient Health Information (PHI) is transmitted over external networks.
- Vitals data is processed in memory and is not stored in local files.
