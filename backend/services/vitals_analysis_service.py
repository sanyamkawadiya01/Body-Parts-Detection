import backend.config.vitals_thresholds as thresholds

class VitalsAnalysisService:
    @staticmethod
    def validate_vitals(data):
        """
        Validates the incoming patient vitals payload.
        Checks for proper data types, missing required inputs, and realistic physical bounds.
        
        :param data: Dict containing vital signs.
        :return: A tuple of (is_valid, error_details)
        """
        errors = {}
        
        # Check if empty or not a dictionary
        if not isinstance(data, dict):
            return False, {"error": "Invalid request payload. Expected a JSON object."}
            
        # We need at least one vital sign for analysis to be meaningful
        vital_fields = [
            "heart_rate", "blood_pressure_systolic", "blood_pressure_diastolic", 
            "oxygen_saturation", "respiratory_rate", "temperature"
        ]
        
        provided_vitals = [field for field in vital_fields if field in data and data[field] is not None]
        if not provided_vitals:
            return False, {"error": "No vital signs provided. Please provide at least one vital sign metric."}

        # Helper validator for numeric fields
        def check_numeric(field_name, min_val, max_val, is_integer=False):
            if field_name in data:
                val = data[field_name]
                if val is None:
                    return
                # Check type
                if not isinstance(val, (int, float)):
                    errors[field_name] = f"Must be a numeric value."
                    return
                # Check range
                if val < min_val or val > max_val:
                    errors[field_name] = f"Value must be between {min_val} and {max_val}."
                    return
                # Check integer if required
                if is_integer and isinstance(val, float) and not val.is_integer():
                    errors[field_name] = f"Must be an integer."

        # Validate each field
        check_numeric("heart_rate", 0, 300, is_integer=True)
        check_numeric("blood_pressure_systolic", 0, 300, is_integer=True)
        check_numeric("blood_pressure_diastolic", 0, 200, is_integer=True)
        check_numeric("oxygen_saturation", 0, 100, is_integer=True)
        check_numeric("respiratory_rate", 0, 100, is_integer=True)
        check_numeric("temperature", 20.0, 50.0)
        check_numeric("age", 0, 150, is_integer=True)

        if "gender" in data:
            gender = data["gender"]
            if gender is not None and not isinstance(gender, str):
                errors["gender"] = "Must be a string."
            elif isinstance(gender, str) and gender.lower() not in ["male", "female", "other", ""]:
                errors["gender"] = "Must be 'male', 'female', or 'other'."

        if errors:
            return False, errors
            
        return True, None

    @staticmethod
    def analyze_vitals(data):
        """
        Performs rule-based evaluation of patient vitals based on thresholds.
        
        :param data: Dict containing validated patient vitals.
        :return: Dict containing lists of detected findings/flags.
        """
        flags = []
        
        # 1. Heart Rate Check
        hr = data.get("heart_rate")
        if hr is not None:
            if hr > thresholds.HEART_RATE_HIGH:
                flags.append("Elevated Heart Rate")
            elif hr < thresholds.HEART_RATE_LOW:
                flags.append("Low Heart Rate")
                
        # 2. Oxygen Saturation Check
        spo2 = data.get("oxygen_saturation")
        if spo2 is not None:
            if spo2 < thresholds.SPO2_LOW:
                flags.append("Low Oxygen Saturation")
                
        # 3. Body Temperature Check
        temp = data.get("temperature")
        if temp is not None:
            if temp > thresholds.TEMPERATURE_HIGH:
                flags.append("Elevated Temperature")
                
        # 4. Blood Pressure Check
        sbp = data.get("blood_pressure_systolic")
        dbp = data.get("blood_pressure_diastolic")
        
        if sbp is not None:
            if sbp > thresholds.BLOOD_PRESSURE_SYSTOLIC_HIGH:
                flags.append("High Blood Pressure")
        if dbp is not None:
            if dbp > thresholds.BLOOD_PRESSURE_DIASTOLIC_HIGH:
                flags.append("Elevated Diastolic Pressure")
                
        # 5. Respiratory Rate Check
        rr = data.get("respiratory_rate")
        if rr is not None:
            if rr > thresholds.RESPIRATORY_RATE_HIGH:
                flags.append("Elevated Respiratory Rate")
                
        return {
            "flags": flags
        }
