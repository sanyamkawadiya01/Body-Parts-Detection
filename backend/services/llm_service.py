import os
import json
import urllib.request
import urllib.error

class LLMService:
    def __init__(self):
        # Load configurations from environment variables or fall back to defaults
        self.ollama_host = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
        self.model_name = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")
        self.timeout = int(os.environ.get("OLLAMA_TIMEOUT", "15"))

    def generate_clinical_insights(self, vitals, findings):
        """
        Queries the local Ollama instance to generate clinical insights.
        If Ollama is unreachable, falls back to a rule-based assessment.
        
        :param vitals: Dict of validated vital signs.
        :param findings: Dict containing findings (flags) from the rule engine.
        :return: Dict matching the expected JSON structure:
                 {
                     "summary": "",
                     "observations": [],
                     "risk_level": "",
                     "recommendations": []
                 }
        """
        # Prepare components for the prompt
        age_str = f"{vitals.get('age')} years old" if vitals.get('age') is not None else "Not specified"
        gender_str = vitals.get('gender', 'Not specified').capitalize() if vitals.get('gender') else "Not specified"
        
        vitals_list = []
        if vitals.get('heart_rate') is not None:
            vitals_list.append(f"Heart Rate: {vitals['heart_rate']} BPM")
        if vitals.get('blood_pressure_systolic') is not None or vitals.get('blood_pressure_diastolic') is not None:
            sys = vitals.get('blood_pressure_systolic', 'N/A')
            dia = vitals.get('blood_pressure_diastolic', 'N/A')
            vitals_list.append(f"Blood Pressure: {sys}/{dia} mmHg")
        if vitals.get('oxygen_saturation') is not None:
            vitals_list.append(f"Oxygen Saturation (SpO2): {vitals['oxygen_saturation']}%")
        if vitals.get('respiratory_rate') is not None:
            vitals_list.append(f"Respiratory Rate: {vitals['respiratory_rate']} breaths/min")
        if vitals.get('temperature') is not None:
            vitals_list.append(f"Body Temperature: {vitals['temperature']}°C")
            
        vitals_formatted = "\n".join([f"- {v}" for v in vitals_list])
        
        flags = findings.get("flags", [])
        flags_formatted = "\n".join([f"- {f}" for f in flags]) if flags else "None detected (vitals are within standard ranges)."

        # System and user prompts
        system_instructions = (
            "You are a clinical assistant.\n"
            "Analyze the provided vital signs and detected findings.\n"
            "Generate:\n"
            "1. Summary of overall vitals status\n"
            "2. Key observations\n"
            "3. Risk level assessment (must be one of: Low, Moderate, High)\n"
            "4. Monitoring recommendations\n\n"
            "Important Safety Requirements:\n"
            "- Do NOT provide a diagnosis.\n"
            "- Do NOT prescribe medication.\n"
            "- Do NOT recommend treatment plans.\n"
            "- Keep insights informational and suitable for clinician review.\n"
            "- Return valid JSON only. Do not wrap in markdown blocks like ```json."
        )

        user_content = (
            f"Patient Context:\n"
            f"- Age: {age_str}\n"
            f"- Gender: {gender_str}\n\n"
            f"Patient Vital Signs:\n"
            f"{vitals_formatted}\n\n"
            f"Rule Engine Findings:\n"
            f"{flags_formatted}\n\n"
            f"Expected Output JSON Schema:\n"
            f"{{\n"
            f"  \"summary\": \"<Overall clinical status summary string>\",\n"
            f"  \"observations\": [\"<Observation 1>\", \"<Observation 2>\"],\n"
            f"  \"risk_level\": \"<Low | Moderate | High>\",\n"
            f"  \"recommendations\": [\"<Recommendation 1>\", \"<Recommendation 2>\"]\n"
            f"}}\n"
        )

        # Build payload for Ollama
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_content}
            ],
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.2  # Low temperature for clinical objectivity/determinism
            }
        }

        # Attempt local LLM inference
        try:
            url = f"{self.ollama_host}/api/chat"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                
            content = resp_data.get("message", {}).get("content", "").strip()
            
            # Parse the content to make sure it matches the required format
            parsed_result = json.loads(content)
            
            # Ensure schema completeness
            for key in ["summary", "observations", "risk_level", "recommendations"]:
                if key not in parsed_result:
                    raise KeyError(f"Missing required response field: {key}")
                    
            # Normalize risk level value
            r_level = str(parsed_result.get("risk_level", "Low")).strip().capitalize()
            if r_level not in ["Low", "Moderate", "High"]:
                parsed_result["risk_level"] = "Low"
            else:
                parsed_result["risk_level"] = r_level
                
            return parsed_result

        except Exception as e:
            # Local Ollama is unreachable or model failed; trigger graceful rule-based fallback
            print(f"Ollama integration error: {str(e)}. Triggering rule-based fallback...")
            return self._generate_rule_based_fallback(vitals, flags)

    def _generate_rule_based_fallback(self, vitals, flags):
        """
        Generates a structured fallback response using rule-based metrics
        when the local Ollama LLM is unavailable.
        """
        # Determine risk level based on flags severity and quantity
        if not flags:
            risk_level = "Low"
            summary = "Vital signs are within normal standard adult ranges. No clinical alerts detected."
            observations = [
                "All registered metrics are within safe reference thresholds.",
                "Oxygenation levels are stable and normal."
            ]
            recommendations = [
                "Continue routine clinical observation and vital signs tracking."
            ]
        else:
            # We have alerts
            num_flags = len(flags)
            
            # High risk if SpO2 is low or multiple vital signs are abnormal
            is_critical = "Low Oxygen Saturation" in flags or num_flags >= 3
            risk_level = "High" if is_critical else "Moderate"
            
            summary = f"Rule-based assessment completed. {num_flags} vital sign alerts detected."
            
            # Map flags to specific observation explanations
            observations = []
            recommendations = []
            
            for flag in flags:
                if flag == "Elevated Heart Rate":
                    observations.append("Tachycardia: Resting heart rate is above 100 BPM.")
                    recommendations.append("Ensure patient is resting and comfortable. Re-assess pulse rate in 15 minutes.")
                elif flag == "Low Heart Rate":
                    observations.append("Bradycardia: Resting heart rate is below 60 BPM.")
                    recommendations.append("Assess patient for symptoms of dizziness, fatigue, or low perfusion.")
                elif flag == "Low Oxygen Saturation":
                    observations.append("Hypoxemia: Oxygen saturation (SpO2) is below safe threshold (<95%).")
                    recommendations.append("Verify sensor alignment. Administer supplemental oxygen if clinically indicated and ordered.")
                elif flag == "Elevated Temperature":
                    observations.append("Pyrexia: Core body temperature is elevated (>38.0°C).")
                    recommendations.append("Promote hydration, keep patient in a cool environment, and consider antipyretics.")
                elif flag == "High Blood Pressure":
                    observations.append("Systolic Hypertension: Systolic blood pressure exceeds 140 mmHg.")
                    recommendations.append("Ensure resting measurements. Monitor blood pressure periodically.")
                elif flag == "Elevated Diastolic Pressure":
                    observations.append("Diastolic Hypertension: Diastolic blood pressure exceeds 90 mmHg.")
                    recommendations.append("Ensure resting measurements and follow up on cardiovascular tracking.")
                elif flag == "Elevated Respiratory Rate":
                    observations.append("Tachypnea: Respiratory rate is elevated above 20 breaths per minute.")
                    recommendations.append("Assess patient breathing mechanics and inspect for signs of dyspnea.")

            # General default recommendations
            recommendations.append("Confirm all readings manually with secondary clinical diagnostic equipment.")
            
            # Warn user that this is a rule-based fallback
            observations.append("Note: Local LLM service is offline. Insights generated via rule engine analysis.")

        return {
            "summary": summary,
            "observations": observations,
            "risk_level": risk_level,
            "recommendations": recommendations,
            "llm_status": "offline"
        }
