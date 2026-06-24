from flask import Blueprint, request, jsonify
from backend.services.vitals_analysis_service import VitalsAnalysisService
from backend.services.llm_service import LLMService

vitals_bp = Blueprint('vitals', __name__)
llm_service = LLMService()

@vitals_bp.route('/analyze-vitals', methods=['POST'])
def analyze_patient_vitals():
    """
    API endpoint that accepts patient vital signs, validates the inputs,
    performs a rule-based check against clinical thresholds, and orchestrates
    local LLM insights using Ollama.
    """
    # 1. Parse JSON request body
    if not request.is_json:
        return jsonify({
            "success": False,
            "error": "Content-Type must be application/json."
        }), 415

    try:
        data = request.get_json()
    except Exception:
        return jsonify({
            "success": False,
            "error": "Malformed JSON payload in request body."
        }), 400

    # 2. Input validation
    is_valid, validation_errors = VitalsAnalysisService.validate_vitals(data)
    if not is_valid:
        return jsonify({
            "success": False,
            "error": "Validation Error",
            "details": validation_errors
        }), 400

    try:
        # 3. Perform rule-based analysis (detect abnormal values)
        findings = VitalsAnalysisService.analyze_vitals(data)
        
        # 4. Generate structured clinical insights via local LLM / Fallback
        analysis_result = llm_service.generate_clinical_insights(data, findings)
        
        # 5. Build structured response
        response_data = {
            "success": True,
            "analysis": {
                "summary": analysis_result.get("summary", ""),
                "observations": analysis_result.get("observations", []),
                "risk_level": analysis_result.get("risk_level", "Low"),
                "recommendations": analysis_result.get("recommendations", [])
            }
        }
        
        # Include rule-based flags in response for debugging or additional UI indicators
        response_data["analysis"]["flags"] = findings.get("flags", [])
        
        # Include LLM service status flag for system telemetry
        if "llm_status" in analysis_result:
            response_data["llm_status"] = analysis_result["llm_status"]
        else:
            response_data["llm_status"] = "online"

        return jsonify(response_data), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"An internal error occurred during vitals processing: {str(e)}"
        }), 500
