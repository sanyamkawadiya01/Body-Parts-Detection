import cv2
import mediapipe as mp
import numpy as np
import os

class PoseDetector:
    def __init__(self, min_detection_confidence=0.5, visibility_threshold=0.5):
        """
        Initializes the PoseDetector.
        
        :param min_detection_confidence: Confidence threshold for MediaPipe Pose detection.
        :param visibility_threshold: Minimum landmark visibility required to include it in bounding box calculations.
        """
        self.mp_pose = mp.solutions.pose
        self.min_detection_confidence = min_detection_confidence
        self.visibility_threshold = visibility_threshold
        
        # Color mapping for each body part (BGR for OpenCV)
        # Head: Neon Orange/Gold (0, 165, 255)
        # Chest: Neon Teal (238, 242, 0) -> Wait, BGR for (0, 242, 254) is (254, 242, 0)
        # Left Arm: Neon Purple (211, 85, 186)
        # Right Arm: Neon Pink (147, 20, 255)
        # Left Leg: Electric Blue (255, 144, 30)
        # Right Leg: Royal Indigo (226, 43, 138)
        self.colors = {
            "head": (0, 165, 255),        # Orange-Gold
            "chest": (220, 220, 0),       # Cyan-Teal
            "left_arm": (211, 85, 186),   # Purple
            "right_arm": (147, 20, 255),  # Pink
            "left_leg": (255, 144, 30),   # Electric Blue
            "right_leg": (226, 43, 138)   # Royal Indigo
        }
        
        # Landmark index mappings for each body part region
        self.body_part_groups = {
            "head": list(range(0, 11)),
            "chest": [11, 12, 23, 24],
            "left_arm": [11, 13, 15, 17, 19, 21],
            "right_arm": [12, 14, 16, 18, 20, 22],
            "left_leg": [23, 25, 27, 29, 31],
            "right_leg": [24, 26, 28, 30, 32]
        }

    def detect_and_draw(self, image_path, output_path):
        """
        Processes a patient photograph, calculates bounding boxes for body regions,
        annotates the image, and returns the bounding box coordinates.
        
        :param image_path: Path to the input image file.
        :param output_path: Path to save the annotated output image.
        :return: A dictionary containing bounding box coordinates of detected regions.
        """
        # Read the image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Could not read the uploaded image.")
            
        height, width, _ = img.shape
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Run MediaPipe Pose detector
        with self.mp_pose.Pose(
            static_image_mode=True, 
            min_detection_confidence=self.min_detection_confidence
        ) as pose:
            results = pose.process(img_rgb)
            
        # If no landmarks are detected, return empty coordinates dictionary
        if not results.pose_landmarks:
            # Save the original image as the output since no pose was found
            cv2.imwrite(output_path, img)
            return {}

        landmarks = results.pose_landmarks.landmark
        coordinates = {}
        
        # Temporary image to draw semi-transparent overlays
        overlay = img.copy()
        
        for part, indices in self.body_part_groups.items():
            # Gather valid landmarks for this body part group
            part_lms = []
            for idx in indices:
                lm = landmarks[idx]
                if lm.visibility >= self.visibility_threshold:
                    # Map normalized coordinates to pixel values
                    x_px = int(lm.x * width)
                    y_px = int(lm.y * height)
                    part_lms.append((x_px, y_px))
            
            # Require a minimum number of visible landmarks to consider the part detected
            min_required = 3 if part == "head" else 2
            if len(part_lms) < min_required:
                continue # Skip this body part, it's not visible enough in the photograph
                
            # Extract basic bounding box of landmarks
            xs = [pt[0] for pt in part_lms]
            ys = [pt[1] for pt in part_lms]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            
            box_w = max_x - min_x
            box_h = max_y - min_y
            
            # Apply padding specific to the body part for accurate regional coverage
            if part == "head":
                # Expand upwards for top of head/hair, downwards for chin, and slightly outwards
                x1 = int(min_x - 0.2 * box_w)
                x2 = int(max_x + 0.2 * box_w)
                y1 = int(min_y - 0.65 * box_h)
                y2 = int(max_y + 0.25 * box_h)
            elif part == "chest":
                # Torso requires horizontal padding to capture body width, slight vertical padding
                x1 = int(min_x - 0.15 * box_w)
                x2 = int(max_x + 0.15 * box_w)
                y1 = int(min_y - 0.05 * box_h)
                y2 = int(max_y + 0.05 * box_h)
            else: # Arms and Legs
                # Capture muscle width around joints
                pad = int(0.12 * max(box_w, box_h))
                x1 = min_x - pad
                x2 = max_x + pad
                y1 = min_y - pad
                y2 = max_y + pad
                
            # Clamp bounding box coordinates to image dimensions
            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(0, min(x2, width - 1))
            y2 = max(0, min(y2, height - 1))
            
            # Ensure coordinates are in correct top-left, bottom-right order
            x_min, x_max = min(x1, x2), max(x1, x2)
            y_min, y_max = min(y1, y2), max(y1, y2)
            
            # Only record if the bounding box has non-zero area
            if x_max > x_min and y_max > y_min:
                coordinates[part] = [x_min, y_min, x_max, y_max]
                
                # Fetch BGR color for visualization
                color = self.colors.get(part, (0, 255, 0))
                
                # Draw filled translucent rectangle on the overlay
                cv2.rectangle(overlay, (x_min, y_min), (x_max, y_max), color, -1)
                
        # Blend overlay for transparent fill
        alpha = 0.12
        cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, dst=img)
        
        # Draw borders and labels
        for part, bbox in coordinates.items():
            x_min, y_min, x_max, y_max = bbox
            color = self.colors.get(part, (0, 255, 0))
            
            # Draw bounding box borders
            cv2.rectangle(img, (x_min, y_min), (x_max, y_max), color, 2)
            
            # Format display label (e.g., "Left Arm", "Head")
            label_text = part.replace("_", " ").title()
            
            # Calculate text size and place label box
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.5
            thickness = 1
            (w, h), baseline = cv2.getTextSize(label_text, font, font_scale, thickness)
            
            # Draw label background flag (draw inside if too close to the top)
            if y_min - h - 10 > 0:
                bg_y1, bg_y2 = y_min - h - 10, y_min
                text_y = y_min - 6
            else:
                bg_y1, bg_y2 = y_min, y_min + h + 10
                text_y = y_min + h + 4
                
            cv2.rectangle(img, (x_min, bg_y1), (x_min + w + 10, bg_y2), color, -1)
            cv2.putText(img, label_text, (x_min + 5, text_y), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)
            
        # Save the annotated image
        cv2.imwrite(output_path, img)
        
        return coordinates
