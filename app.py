from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import os
import uuid
from detector.pose_detector import PoseDetector
from backend.routes.vitals_routes import vitals_bp

app = Flask(__name__)

# Register Blueprints
app.register_blueprint(vitals_bp)

# Configure directories
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
# Set maximum upload size to 16MB
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Ensure target directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Allowed file extensions for security and processing compatibility
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}

def allowed_file(filename):
    """Checks if the uploaded file has a valid image extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize the MediaPipe Pose Detector
detector = PoseDetector(min_detection_confidence=0.5, visibility_threshold=0.5)

@app.route('/')
def index():
    """Renders the main patient detection dashboard."""
    return render_template('index.html')

@app.route('/detect', methods=['POST'])
def detect_body_parts():
    """
    API endpoint that accepts an uploaded image, processes it to detect
    body parts, saves the annotated image, and returns coordinates.
    """
    # 1. Validate request containing file
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided in request."}), 400
        
    file = request.files['image']
    
    # 2. Validate empty filename
    if file.filename == '':
        return jsonify({"error": "No file was selected for upload."}), 400
        
    # 3. Validate file type
    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file format. Please upload an image (PNG, JPG, JPEG, WEBP, BMP)."}), 400

    try:
        # 4. Save file with a unique secure filename to avoid collision
        original_ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{original_ext}"
        secured_filename = secure_filename(unique_filename)
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], secured_filename)
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], secured_filename)
        
        file.save(input_path)
        
        # 5. Run the detection using MediaPipe Pose
        coordinates = detector.detect_and_draw(input_path, output_path)
        
        # 6. Format the JSON response
        # If coordinates dictionary is empty, it means no landmarks/person was detected
        detected_flag = len(coordinates) > 0
        
        response_data = {
            "success": True,
            "detected": detected_flag,
            "processed_image": f"/outputs/{secured_filename}",
            "coordinates": coordinates
        }
        
        # Merge individual bounding boxes directly into root as requested by the user API
        for part in ["head", "chest", "left_arm", "right_arm", "left_leg", "right_leg"]:
            response_data[part] = coordinates.get(part, None)
            
        return jsonify(response_data), 200
        
    except Exception as e:
        # Clean fallback in case of processing crashes
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"An error occurred during image processing: {str(e)}"}), 500

# Route to serve uploaded raw files
@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Route to serve processed annotated files
@app.route('/outputs/<filename>')
def serve_output(filename):
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename)

# Error handlers for client-side uploads
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "File size exceeds the maximum limit of 16MB."}), 413

if __name__ == '__main__':
    # Run server locally on default port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
