document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const imageInput = document.getElementById('image-input');
    const previewContainer = document.getElementById('preview-container');
    const previewImg = document.getElementById('preview-img');
    const clearBtn = document.getElementById('clear-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    
    // UI Mode Selectors
    const modeUploadBtn = document.getElementById('mode-upload-btn');
    const modeWebcamBtn = document.getElementById('mode-webcam-btn');
    const panelTitleUpload = document.getElementById('panel-title-upload');
    const panelTitleWebcam = document.getElementById('panel-title-webcam');
    const uploadModeWrapper = document.getElementById('upload-mode-wrapper');
    const webcamModeWrapper = document.getElementById('webcam-mode-wrapper');
    
    // Webcam specific elements
    const webcamElement = document.getElementById('webcam-element');
    const webcamCanvas = document.getElementById('webcam-canvas');
    const webcamMessage = document.getElementById('webcam-message');
    const captureBtn = document.getElementById('capture-btn');
    const liveTelemetryPlaceholder = document.getElementById('live-telemetry-placeholder');

    // UI Panel States
    const emptyState = document.getElementById('empty-state');
    const scanningState = document.getElementById('scanning-state');
    const resultsState = document.getElementById('results-state');
    const scanningImg = document.getElementById('scanning-img');
    
    // Results Elements
    const outputImg = document.getElementById('output-img');
    const detectionCount = document.getElementById('detection-count');
    const metricsTableBody = document.querySelector('#metrics-table tbody');
    const copyJsonBtn = document.getElementById('copy-json-btn');
    const downloadImgBtn = document.getElementById('download-img-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    // Scanning Stepper Steps
    const stepUpload = document.getElementById('step-upload');
    const stepModel = document.getElementById('step-model');
    const stepProcess = document.getElementById('step-process');
    const stepFinish = document.getElementById('step-finish');
    
    // Toast Notification elements
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Body Part Info Panel
    const infoPanelContent = document.getElementById('info-panel-content');

    // State Variables
    let selectedFile = null;
    let latestApiResponse = null;
    let originalImageDimensions = { width: 0, height: 0 };
    let currentMode = 'upload'; // 'upload' or 'webcam'
    let selectedBodyPart = null;
    
    // Webcam stream state
    let webcamStream = null;
    let isWebcamStreaming = false;
    let lastFrameTime = 0;
    const FPS_LIMIT = 25; // Target 20-30 FPS
    const FRAME_INTERVAL = 1000 / FPS_LIMIT;
    let animationFrameId = null;
    let poseInstance = null;

    // Body Part Drawing & Coordinates configurations (JS equivalents of Python detector)
    const bodyPartColors = {
        head: '#ff9000',      // Orange-Gold
        chest: '#00f2fe',     // Cyan-Teal
        left_arm: '#ba55d3',  // Purple
        right_arm: '#ff8c00', // Pink/Orange
        left_leg: '#1e90ff',  // Electric Blue
        right_leg: '#8a2be2'  // Royal Violet
    };

    const bodyPartGroups = {
        head: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        chest: [11, 12, 23, 24],
        left_arm: [11, 13, 15, 17, 19, 21],
        right_arm: [12, 14, 16, 18, 20, 22],
        left_leg: [23, 25, 27, 29, 31],
        right_leg: [24, 26, 28, 30, 32]
    };

    // Body Part Medical Knowledge Base
    const bodyPartKnowledge = {
        head: {
            name: "Head",
            badge: "Cranial Region",
            description: "The uppermost part of the human body, containing the brain, major sensory organs, and the cranial vault.",
            functions: [
                "Sensory perception (sight, hearing, smell, taste)",
                "Neurological control and cognitive processing",
                "Ingestion of nutrients and airway protection",
                "Communication, speech, and facial expression"
            ],
            organs: [
                "Brain (cerebrum, cerebellum, brainstem)",
                "Sensory organs (eyes, ears, nose, tongue)",
                "Skull (cranial and facial bones)",
                "Facial muscles and salivary glands"
            ],
            conditions: [
                "Concussion and Traumatic Brain Injury (TBI)",
                "Migraines, tension, and cluster headaches",
                "Stroke (ischemic and hemorrhagic CVA)",
                "Sinusitis and skull fractures"
            ],
            isOrgan: true
        },
        chest: {
            name: "Chest / Torso",
            badge: "Thoracic Region",
            description: "The thoracic region of the body, bounded by the ribs, spine, and diaphragm.",
            functions: [
                "Protection of vital cardiopulmonary organs",
                "Facilitation of respiration (breathing mechanics)",
                "Structural support and posture for the upper body",
                "Conduit for major blood vessels and esophagus"
            ],
            organs: [
                "Heart and pericardium",
                "Lungs and pleural cavity",
                "Trachea and bronchi",
                "Ribcage (sternum and thoracic vertebrae)"
            ],
            conditions: [
                "Myocardial infarction (Heart Attack)",
                "Pneumonia and acute bronchitis",
                "Pneumothorax (collapsed lung)",
                "Asthma and rib fractures"
            ],
            isOrgan: true
        },
        left_arm: {
            name: "Left Arm",
            badge: "Left Upper Extremity",
            description: "The left upper limb, extending from the shoulder joint to the fingertips, optimized for reach and mobility.",
            functions: [
                "Reaching and positioning the hand in space",
                "Grasping, pulling, pushing, and lifting objects",
                "Tactile feedback and fine motor coordination",
                "Proprioception and balance assistance"
            ],
            organs: [
                "Bones (humerus, radius, ulna, clavicle, scapula)",
                "Muscles (deltoid, biceps brachii, triceps)",
                "Nerves (brachial plexus, radial, ulnar, median nerves)",
                "Joints (glenohumeral, humeroulnar, radioulnar joints)"
            ],
            conditions: [
                "Rotator cuff tears and shoulder impingement",
                "Lateral/medial epicondylitis (tennis/golfer's elbow)",
                "Carpal tunnel syndrome",
                "Fractures (clavicle, humerus, radius, ulna)",
                "Joint sprains and muscle strains"
            ],
            isOrgan: false
        },
        right_arm: {
            name: "Right Arm",
            badge: "Right Upper Extremity",
            description: "The right upper limb, extending from the shoulder joint to the fingertips, optimized for reach and mobility.",
            functions: [
                "Reaching and positioning the hand in space",
                "Grasping, pulling, pushing, and lifting objects",
                "Tactile feedback and fine motor coordination",
                "Proprioception and balance assistance"
            ],
            organs: [
                "Bones (humerus, radius, ulna, clavicle, scapula)",
                "Muscles (deltoid, biceps brachii, triceps)",
                "Nerves (brachial plexus, radial, ulnar, median nerves)",
                "Joints (glenohumeral, humeroulnar, radioulnar joints)"
            ],
            conditions: [
                "Rotator cuff tears and shoulder impingement",
                "Lateral/medial epicondylitis (tennis/golfer's elbow)",
                "Carpal tunnel syndrome",
                "Fractures (clavicle, humerus, radius, ulna)",
                "Joint sprains and muscle strains"
            ],
            isOrgan: false
        },
        left_leg: {
            name: "Left Leg",
            badge: "Left Lower Extremity",
            description: "The left lower limb, extending from the hip joint to the toes, designed for weight-bearing and locomotion.",
            functions: [
                "Locomotion (walking, running, climbing)",
                "Weight-bearing support for the entire skeleton",
                "Balance maintenance and postural stability",
                "Shock absorption during physical impact"
            ],
            organs: [
                "Bones (femur, patella, tibia, fibula, pelvis)",
                "Muscles (quadriceps, hamstrings, gastrocnemius)",
                "Nerves (sciatic, femoral, tibial nerves)",
                "Joints (coxofemoral/hip, tibiofemoral/knee, talocrural/ankle)"
            ],
            conditions: [
                "Osteoarthritis (hip and knee joints)",
                "Ligament tears (ACL, MCL) and meniscus tears",
                "Deep Vein Thrombosis (DVT)",
                "Sciatica and shin splints",
                "Fractures (femur, tibia, fibula)"
            ],
            isOrgan: false
        },
        right_leg: {
            name: "Right Leg",
            badge: "Right Lower Extremity",
            description: "The right lower limb, extending from the hip joint to the toes, designed for weight-bearing and locomotion.",
            functions: [
                "Locomotion (walking, running, climbing)",
                "Weight-bearing support for the entire skeleton",
                "Balance maintenance and postural stability",
                "Shock absorption during physical impact"
            ],
            organs: [
                "Bones (femur, patella, tibia, fibula, pelvis)",
                "Muscles (quadriceps, hamstrings, gastrocnemius)",
                "Nerves (sciatic, femoral, tibial nerves)",
                "Joints (coxofemoral/hip, tibiofemoral/knee, talocrural/ankle)"
            ],
            conditions: [
                "Osteoarthritis (hip and knee joints)",
                "Ligament tears (ACL, MCL) and meniscus tears",
                "Deep Vein Thrombosis (DVT)",
                "Sciatica and shin splints",
                "Fractures (femur, tibia, fibula)"
            ],
            isOrgan: false
        }
    };

    // Update the information side panel
    function updateInfoPanel(partId) {
        if (!infoPanelContent) return;

        if (!partId || !bodyPartKnowledge[partId]) {
            infoPanelContent.innerHTML = `
                <div class="info-placeholder">
                    <div class="pulse-icon">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                    <h3>Anatomy Explorer</h3>
                    <p>Select a body part to view information.</p>
                </div>
            `;
            return;
        }

        const data = bodyPartKnowledge[partId];
        const color = bodyPartColors[partId] || '#00f2fe';
        const organsLabel = data.isOrgan ? 'Major Organs & Structures' : 'Muscles & Bones';

        infoPanelContent.innerHTML = `
            <div class="info-details">
                <div class="info-header" style="border-left-color: ${color}">
                    <span class="info-badge" style="background-color: ${color}20; color: ${color}; border-color: ${color}40">${data.badge}</span>
                    <h3 class="info-title">${data.name}</h3>
                </div>
                
                <div class="info-section">
                    <h4>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        Description
                    </h4>
                    <p>${data.description}</p>
                </div>
                
                <div class="info-section">
                    <h4>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Main Functions
                    </h4>
                    <ul>
                        ${data.functions.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="info-section">
                    <h4>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                            <line x1="15" y1="3" x2="15" y2="21"></line>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="3" y1="15" x2="21" y2="15"></line>
                        </svg>
                        ${organsLabel}
                    </h4>
                    <ul>
                        ${data.organs.map(o => `<li>${o}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="info-section">
                    <h4>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Common Clinical Conditions
                    </h4>
                    <ul>
                        ${data.conditions.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    // Select body part and update UI states
    function selectBodyPart(partId) {
        selectedBodyPart = partId;
        updateInfoPanel(partId);

        // Update static image bboxes
        document.querySelectorAll('.coord-highlight-box').forEach(box => {
            box.classList.remove('selected');
        });
        const selectedBox = document.getElementById(`highlight-${partId}`);
        if (selectedBox) {
            selectedBox.classList.add('selected');
        }

        // Highlight table row
        document.querySelectorAll('#metrics-table tbody tr').forEach(row => {
            row.classList.remove('selected-row');
            if (row.dataset.partId === partId) {
                row.classList.add('selected-row');
            }
        });
    }

    // Position and enable click events for all bounding boxes on the uploaded image/captured snapshot
    function positionAllBboxes(coordinates) {
        const width = originalImageDimensions.width;
        const height = originalImageDimensions.height;
        if (width === 0 || height === 0) return;

        const bodyParts = ['head', 'chest', 'left_arm', 'right_arm', 'left_leg', 'right_leg'];
        bodyParts.forEach(partId => {
            const highlightBox = document.getElementById(`highlight-${partId}`);
            if (!highlightBox) return;

            const bbox = coordinates[partId];
            if (bbox) {
                const [x1, y1, x2, y2] = bbox;
                const leftPercent = (x1 / width) * 100;
                const topPercent = (y1 / height) * 100;
                const widthPercent = ((x2 - x1) / width) * 100;
                const heightPercent = ((y2 - y1) / height) * 100;

                highlightBox.style.left = `${leftPercent}%`;
                highlightBox.style.top = `${topPercent}%`;
                highlightBox.style.width = `${widthPercent}%`;
                highlightBox.style.height = `${heightPercent}%`;
                
                const colorHex = bodyPartColors[partId] || '#00f2fe';
                highlightBox.style.setProperty('--part-color', colorHex);
                highlightBox.style.borderColor = colorHex;
                
                highlightBox.classList.add('detected');
                if (selectedBodyPart === partId) {
                    highlightBox.classList.add('selected');
                } else {
                    highlightBox.classList.remove('selected');
                }
            } else {
                highlightBox.classList.remove('detected', 'selected');
            }
        });
    }

    // Reset selected states
    function resetSelectedBodyPart() {
        selectedBodyPart = null;
        updateInfoPanel(null);
        document.querySelectorAll('.coord-highlight-box').forEach(box => {
            box.classList.remove('selected', 'detected');
            box.style.pointerEvents = 'none';
        });
        document.querySelectorAll('#metrics-table tbody tr').forEach(row => {
            row.classList.remove('selected-row');
        });
    }

    // Initialize MediaPipe Pose Client
    function initMediaPipePose() {
        if (poseInstance) return;

        poseInstance = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        poseInstance.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        poseInstance.onResults(onPoseResults);
    }

    // Helper: Convert HEX color to RGBA string for canvas overlay
    function hexToRgba(hex, alpha) {
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length === 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x' + c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
        }
        return `rgba(0, 242, 254, ${alpha})`;
    }

    // 2. Mode Switching Logic
    modeUploadBtn.addEventListener('click', () => switchMode('upload'));
    modeWebcamBtn.addEventListener('click', () => switchMode('webcam'));

    function switchMode(mode) {
        if (currentMode === mode) return;
        currentMode = mode;

        if (mode === 'upload') {
            // Update mode switch active status
            modeUploadBtn.classList.add('active');
            modeWebcamBtn.classList.remove('active');

            // Toggle headers and wrappers
            panelTitleUpload.style.display = 'flex';
            panelTitleWebcam.style.display = 'none';
            uploadModeWrapper.style.display = 'flex';
            webcamModeWrapper.style.display = 'none';

            // Clean up webcam
            stopWebcam();

            // Clear right panel and reset upload state
            resetUpload();
            resultsState.style.display = 'none';
            emptyState.style.display = 'flex';
        } else {
            // Webcam mode active
            modeWebcamBtn.classList.add('active');
            modeUploadBtn.classList.remove('active');

            panelTitleWebcam.style.display = 'flex';
            panelTitleUpload.style.display = 'none';
            webcamModeWrapper.style.display = 'flex';
            uploadModeWrapper.style.display = 'none';

            // Reset image upload states
            resetUpload();

            // Initialize MediaPipe model
            initMediaPipePose();

            // Show results panel on the right with Live Telemetry Active placeholder
            emptyState.style.display = 'none';
            scanningState.style.display = 'none';
            resultsState.style.display = 'flex';
            outputImg.style.display = 'none';
            liveTelemetryPlaceholder.style.display = 'flex';
            
            // Disable highlights
            document.querySelectorAll('.coord-highlight-box').forEach(box => {
                box.classList.remove('active');
            });

            // Start Webcam
            startWebcam();
        }
    }

    // 3. Webcam Stream Control
    async function startWebcam() {
        try {
            webcamMessage.textContent = 'Requesting camera access...';
            webcamMessage.style.opacity = '1';
            
            webcamStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                }
            });

            webcamElement.srcObject = webcamStream;
            webcamElement.onloadedmetadata = () => {
                webcamElement.play();
                isWebcamStreaming = true;
                webcamMessage.style.opacity = '0';
                captureBtn.disabled = false;
                
                // Set canvas dimension matching stream resolution
                webcamCanvas.width = webcamElement.videoWidth;
                webcamCanvas.height = webcamElement.videoHeight;
                originalImageDimensions.width = webcamElement.videoWidth;
                originalImageDimensions.height = webcamElement.videoHeight;

                // Begin render frame loop
                animationFrameId = requestAnimationFrame(processWebcamFrame);
                showToast('Webcam feed initialized successfully.', 'success');
            };
        } catch (error) {
            console.error('Webcam access error:', error);
            webcamMessage.textContent = 'Camera access denied or unavailable.';
            webcamMessage.style.opacity = '1';
            captureBtn.disabled = true;
            showToast('Unable to start live camera feed.', 'error');
        }
    }

    function stopWebcam() {
        isWebcamStreaming = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
        webcamElement.srcObject = null;
        webcamMessage.textContent = "Click 'Live Webcam' above to start camera";
        webcamMessage.style.opacity = '1';
        captureBtn.disabled = true;
        
        // Clear canvas
        const ctx = webcamCanvas.getContext('2d');
        ctx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);
    }

    async function processWebcamFrame(timestamp) {
        if (!isWebcamStreaming) return;

        if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
            lastFrameTime = timestamp;
            try {
                // Ensure canvas size stays synchronized
                if (webcamCanvas.width !== webcamElement.videoWidth || webcamCanvas.height !== webcamElement.videoHeight) {
                    webcamCanvas.width = webcamElement.videoWidth || 640;
                    webcamCanvas.height = webcamElement.videoHeight || 480;
                    originalImageDimensions.width = webcamCanvas.width;
                    originalImageDimensions.height = webcamCanvas.height;
                }
                
                // Run inference on current video frame
                if (poseInstance) {
                    await poseInstance.send({ image: webcamElement });
                }
            } catch (err) {
                console.error('Frame processing failed:', err);
            }
        }
        animationFrameId = requestAnimationFrame(processWebcamFrame);
    }

    // 4. Live MediaPipe Landmarks Callback
    function onPoseResults(results) {
        if (currentMode !== 'webcam' || !isWebcamStreaming) return;

        const ctx = webcamCanvas.getContext('2d');
        ctx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);

        const currentCoordinates = {};
        
        if (!results.poseLandmarks) {
            // No landmarks found
            setupTable(currentCoordinates);
            return;
        }

        const landmarks = results.poseLandmarks;
        const width = webcamCanvas.width;
        const height = webcamCanvas.height;
        const visibilityThreshold = 0.5;

        for (const [part, indices] of Object.entries(bodyPartGroups)) {
            const partLms = [];
            for (const idx of indices) {
                const lm = landmarks[idx];
                if (lm && lm.visibility >= visibilityThreshold) {
                    const xPx = Math.round(lm.x * width);
                    const yPx = Math.round(lm.y * height);
                    partLms.push({ x: xPx, y: yPx });
                }
            }

            const minRequired = (part === 'head') ? 3 : 2;
            if (partLms.length < minRequired) {
                continue; // Body part is marked as NOT DETECTED (skip drawing)
            }

            const xs = partLms.map(pt => pt.x);
            const ys = partLms.map(pt => pt.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const boxW = maxX - minX;
            const boxH = maxY - minY;

            let x1, y1, x2, y2;

            // Apply specific anatomical padding offsets identical to the Python backend
            if (part === 'head') {
                x1 = Math.round(minX - 0.2 * boxW);
                x2 = Math.round(maxX + 0.2 * boxW);
                y1 = Math.round(minY - 0.65 * boxH);
                y2 = Math.round(maxY + 0.25 * boxH);
            } else if (part === 'chest') {
                x1 = Math.round(minX - 0.15 * boxW);
                x2 = Math.round(maxX + 0.15 * boxW);
                y1 = Math.round(minY - 0.05 * boxH);
                y2 = Math.round(maxY + 0.05 * boxH);
            } else {
                const pad = Math.round(0.12 * Math.max(boxW, boxH));
                x1 = minX - pad;
                x2 = maxX + pad;
                y1 = minY - pad;
                y2 = maxY - pad;
            }

            // Clamp bounding box to frame size boundaries
            x1 = Math.max(0, Math.min(x1, width - 1));
            y1 = Math.max(0, Math.min(y1, height - 1));
            x2 = Math.max(0, Math.min(x2, width - 1));
            y2 = Math.max(0, Math.min(y2, height - 1));

            const xMin = Math.min(x1, x2);
            const xMax = Math.max(x1, x2);
            const yMin = Math.min(y1, y2);
            const yMax = Math.max(y1, y2);

            if (xMax > xMin && yMax > yMin) {
                currentCoordinates[part] = [xMin, yMin, xMax, yMax];
                const color = bodyPartColors[part];

                const isSelected = part === selectedBodyPart;

                // 1. Draw Translucent Fill overlay (higher opacity if selected)
                ctx.fillStyle = hexToRgba(color, isSelected ? 0.28 : 0.12);
                ctx.fillRect(xMin, yMin, xMax - xMin, yMax - yMin);

                // 2. Draw Bounding Box Border line
                ctx.strokeStyle = color;
                ctx.lineWidth = isSelected ? 4 : 2;
                ctx.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);

                // If selected, draw glowing outer overlay
                if (isSelected) {
                    ctx.save();
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 15;
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
                    ctx.restore();
                }

                // 3. Draw Label badge header
                const labelText = part.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                ctx.font = 'bold 10px Outfit, Inter, sans-serif';
                
                const textMetrics = ctx.measureText(labelText);
                const textW = textMetrics.width;
                const textH = 10; 

                let bgY1, textY;
                if (yMin - textH - 10 > 0) {
                    bgY1 = yMin - textH - 10;
                    textY = yMin - 6;
                } else {
                    bgY1 = yMin;
                    textY = yMin + textH + 4;
                }

                ctx.fillStyle = color;
                ctx.fillRect(xMin, bgY1, textW + 10, textH + 8);

                ctx.fillStyle = '#ffffff';
                ctx.fillText(labelText, xMin + 5, textY);
            }
        }

        // Live update the table coordinate logs
        latestApiResponse = { coordinates: currentCoordinates };
        setupTable(currentCoordinates);
    }

    // 5. Capture Snapshot and Upload to Flask API
    captureBtn.addEventListener('click', async () => {
        if (!isWebcamStreaming || currentMode !== 'webcam') return;

        // Temporarily pause live stream loop rendering to capture frame
        isWebcamStreaming = false;

        // Create a temporary canvas matching webcam video aspect ratio to snap the frame
        const snapCanvas = document.createElement('canvas');
        snapCanvas.width = webcamElement.videoWidth;
        snapCanvas.height = webcamElement.videoHeight;
        
        const snapCtx = snapCanvas.getContext('2d');
        // Draw the raw camera frame
        snapCtx.drawImage(webcamElement, 0, 0, snapCanvas.width, snapCanvas.height);

        // Convert raw canvas frame to Blob to send to Flask POST endpoint
        snapCanvas.toBlob(async (blob) => {
            if (!blob) {
                showToast('Unable to capture camera snapshot.', 'error');
                isWebcamStreaming = true;
                animationFrameId = requestAnimationFrame(processWebcamFrame);
                return;
            }

            // Enter loading transition states
            liveTelemetryPlaceholder.style.display = 'none';
            scanningState.style.display = 'flex';
            resetStepper();

            const formData = new FormData();
            formData.append('image', blob, 'webcam_clinical_record.png');

            try {
                // Step 1: Uploading
                setStepState(stepUpload, 'active');
                const response = await fetch('/detect', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Server error during analysis.');
                }

                latestApiResponse = data;
                setStepState(stepUpload, 'completed');

                // Step 2: Initialize model (simulated)
                setStepState(stepModel, 'active');
                await delay(400);
                setStepState(stepModel, 'completed');

                // Step 3: Calculate coordinates
                setStepState(stepProcess, 'active');
                await delay(400);
                setStepState(stepProcess, 'completed');

                // Step 4: Visual overlays
                setStepState(stepFinish, 'active');
                await delay(300);
                setStepState(stepFinish, 'completed');

                await delay(100);
                
                // Show static result (annotated image returned by Flask backend)
                scanningState.style.display = 'none';
                resultsState.style.display = 'flex';
                outputImg.style.display = 'block';
                
                outputImg.src = data.processed_image;
                downloadImgBtn.href = data.processed_image;
                downloadImgBtn.download = `captured_patient_${Date.now()}.png`;

                const totalDetected = Object.keys(data.coordinates || {}).length;
                detectionCount.innerHTML = `${totalDetected}/6 <span>regions mapped</span>`;
                detectionCount.style.color = totalDetected === 0 ? 'var(--accent-red)' : 'var(--accent-teal)';

                setupTable(data.coordinates || {});
                positionAllBboxes(data.coordinates || {});
                showToast('Clinical record saved and analyzed successfully.', 'success');

            } catch (error) {
                console.error(error);
                showToast(error.message || 'Capture analysis failed.', 'error');
                scanningState.style.display = 'none';
                resultsState.style.display = 'flex';
                liveTelemetryPlaceholder.style.display = 'flex';
                // Resume camera stream on failure
                isWebcamStreaming = true;
                animationFrameId = requestAnimationFrame(processWebcamFrame);
            }
        }, 'image/png');
    });

    // 6. Drag and Drop Actions (Upload Mode only)
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentMode === 'upload') {
                dropZone.classList.add('drag-over');
            }
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        if (currentMode !== 'upload') return;
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    dropZone.addEventListener('click', () => {
        if (currentMode === 'upload') {
            imageInput.click();
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetUpload();
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file.', 'error');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showToast('Image size exceeds 10MB limit.', 'error');
            return;
        }

        selectedFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            scanningImg.src = e.target.result;
            
            dropZone.style.display = 'none';
            previewContainer.style.display = 'block';
            analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
        showToast('Image selected successfully.', 'success');
    }

    function resetUpload() {
        selectedFile = null;
        imageInput.value = '';
        previewImg.src = '';
        scanningImg.src = '';
        dropZone.style.display = 'flex';
        previewContainer.style.display = 'none';
        analyzeBtn.disabled = true;
        resetSelectedBodyPart();
    }

    function showToast(message, type = 'success') {
        toastMessage.textContent = message;
        
        if (type === 'error') {
            toast.style.borderColor = 'var(--accent-red)';
            toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 15px rgba(239, 68, 68, 0.25)';
        } else {
            toast.style.borderColor = 'var(--accent-blue)';
            toast.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.5), var(--glow-blue)';
        }
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // 7. Static Image Analysis Execution
    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile || currentMode !== 'upload') return;

        emptyState.style.display = 'none';
        resultsState.style.display = 'none';
        scanningState.style.display = 'flex';
        
        resetStepper();
        
        const formData = new FormData();
        formData.append('image', selectedFile);

        try {
            setStepState(stepUpload, 'active');
            
            const response = await fetch('/detect', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Server error during detection.');
            }

            latestApiResponse = data;
            
            setStepState(stepUpload, 'completed');
            
            setStepState(stepModel, 'active');
            await delay(600);
            setStepState(stepModel, 'completed');
            
            setStepState(stepProcess, 'active');
            await delay(600);
            setStepState(stepProcess, 'completed');
            
            setStepState(stepFinish, 'active');
            await delay(500);
            setStepState(stepFinish, 'completed');
            
            await delay(200);
            
            // Show static image results
            scanningState.style.display = 'none';
            resultsState.style.display = 'flex';
            outputImg.style.display = 'block';
            liveTelemetryPlaceholder.style.display = 'none';

            outputImg.src = data.processed_image;
            downloadImgBtn.href = data.processed_image;
            downloadImgBtn.download = `annotated_${selectedFile.name}`;

            const totalDetected = Object.keys(data.coordinates || {}).length;
            detectionCount.innerHTML = `${totalDetected}/6 <span>regions mapped</span>`;
            detectionCount.style.color = totalDetected === 0 ? 'var(--accent-red)' : 'var(--accent-teal)';

            const tempImg = new Image();
            tempImg.onload = function() {
                originalImageDimensions.width = this.width;
                originalImageDimensions.height = this.height;
                setupTable(data.coordinates || {});
                positionAllBboxes(data.coordinates || {});
            };
            tempImg.src = data.processed_image;

            showToast(`Analysis complete. Mapped ${totalDetected} body regions.`, 'success');

        } catch (error) {
            console.error(error);
            showToast(error.message || 'Detection failed.', 'error');
            scanningState.style.display = 'none';
            emptyState.style.display = 'flex';
        }
    });

    // 8. Results Metrics Table Loader
    function setupTable(coordinates) {
        metricsTableBody.innerHTML = '';
        
        const bodyParts = [
            { id: 'head', label: 'Head' },
            { id: 'chest', label: 'Chest / Torso' },
            { id: 'left_arm', label: 'Left Arm' },
            { id: 'right_arm', label: 'Right Arm' },
            { id: 'left_leg', label: 'Left Leg' },
            { id: 'right_leg', label: 'Right Leg' }
        ];

        bodyParts.forEach(part => {
            const tr = document.createElement('tr');
            tr.dataset.partId = part.id;
            
            const isDetected = coordinates[part.id] !== undefined && coordinates[part.id] !== null;
            const bbox = isDetected ? coordinates[part.id] : null;
            
            const nameTd = document.createElement('td');
            nameTd.className = 'part-cell';
            nameTd.innerHTML = `<span class="part-dot ${part.id}-dot"></span>${part.label}`;
            
            const coordsTd = document.createElement('td');
            coordsTd.className = 'coords-cell';
            coordsTd.textContent = isDetected ? `[${bbox.join(', ')}]` : 'N/A';
            
            const statusTd = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `status-badge ${isDetected ? 'detected' : 'not-detected'}`;
            badge.textContent = isDetected ? 'DETECTED' : 'NOT DETECTED';
            statusTd.appendChild(badge);
            
            tr.appendChild(nameTd);
            tr.appendChild(coordsTd);
            tr.appendChild(statusTd);
            
            // Highlight row if currently selected
            if (part.id === selectedBodyPart) {
                tr.classList.add('selected-row');
                tr.style.setProperty('--part-color', bodyPartColors[part.id]);
            }

            // Click interaction
            if (isDetected) {
                tr.addEventListener('click', () => {
                    selectBodyPart(part.id);
                });
                
                // Hover highlights (Only when static results are displayed)
                const isStaticResult = (currentMode === 'upload') || (currentMode === 'webcam' && outputImg.style.display === 'block');
                if (isStaticResult) {
                    tr.addEventListener('mouseenter', () => {
                        const highlightBox = document.getElementById(`highlight-${part.id}`);
                        if (highlightBox) highlightBox.classList.add('hovered-box');
                        
                        document.querySelectorAll('#metrics-table tbody tr').forEach(row => {
                            if (row.dataset.partId !== part.id) {
                                row.style.opacity = '0.35';
                            } else {
                                row.classList.add('hovered');
                            }
                        });
                    });
                    
                    tr.addEventListener('mouseleave', () => {
                        const highlightBox = document.getElementById(`highlight-${part.id}`);
                        if (highlightBox) highlightBox.classList.remove('hovered-box');
                        
                        document.querySelectorAll('#metrics-table tbody tr').forEach(row => {
                            row.style.opacity = '1';
                            row.classList.remove('hovered');
                        });
                    });
                }
            }
            
            metricsTableBody.appendChild(tr);
        });
    }

    // 10. Helper Controls
    copyJsonBtn.addEventListener('click', () => {
        if (!latestApiResponse) return;
        
        const jsonStr = JSON.stringify(latestApiResponse, null, 2);
        navigator.clipboard.writeText(jsonStr)
            .then(() => {
                showToast('Coordinates JSON copied to clipboard.', 'success');
            })
            .catch(err => {
                console.error(err);
                showToast('Failed to copy JSON.', 'error');
            });
    });

    resetBtn.addEventListener('click', () => {
        resetSelectedBodyPart();
        if (currentMode === 'upload') {
            resetUpload();
            resultsState.style.display = 'none';
            emptyState.style.display = 'flex';
        } else {
            // Webcam mode: return to live active telemetry
            outputImg.style.display = 'none';
            liveTelemetryPlaceholder.style.display = 'flex';
            
            // Re-initialize webcam loop
            if (!isWebcamStreaming) {
                isWebcamStreaming = true;
                animationFrameId = requestAnimationFrame(processWebcamFrame);
            }
            showToast('Returned to active live camera stream.', 'success');
        }
        
        latestApiResponse = null;
    });

    function resetStepper() {
        [stepUpload, stepModel, stepProcess, stepFinish].forEach(step => {
            step.className = 'step-item';
        });
    }

    function setStepState(stepElement, state) {
        stepElement.classList.remove('active', 'completed');
        if (state === 'active') {
            stepElement.classList.add('active');
        } else if (state === 'completed') {
            stepElement.classList.add('completed');
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 11. Bounding Box Click Listeners (Upload Mode Overlays & Live Webcam Canvas)
    
    // Attach click listeners to static image bounding box highlights
    document.querySelectorAll('.coord-highlight-box').forEach(box => {
        const partId = box.id.replace('highlight-', '');
        box.addEventListener('click', () => {
            selectBodyPart(partId);
        });
    });

    // Ray-cast click events on the Live Webcam Canvas to select body parts
    webcamCanvas.addEventListener('click', (e) => {
        if (currentMode !== 'webcam' || !isWebcamStreaming) return;
        if (!latestApiResponse || !latestApiResponse.coordinates) return;

        const rect = webcamCanvas.getBoundingClientRect();
        // Translate client mouse click (viewport coordinates) to canvas internal resolution
        const clickX = ((e.clientX - rect.left) / rect.width) * webcamCanvas.width;
        const clickY = ((e.clientY - rect.top) / rect.height) * webcamCanvas.height;

        let clickedPart = null;
        const parts = ['head', 'chest', 'left_arm', 'right_arm', 'left_leg', 'right_leg'];
        for (const part of parts) {
            const bbox = latestApiResponse.coordinates[part];
            if (bbox) {
                const [x1, y1, x2, y2] = bbox;
                if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
                    clickedPart = part;
                    break;
                }
            }
        }

        if (clickedPart) {
            selectBodyPart(clickedPart);
        }
    });
});
