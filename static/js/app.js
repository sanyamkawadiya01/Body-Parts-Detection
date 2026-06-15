document.addEventListener('DOMContentLoaded', () => {
    class OrganOverlay {
        constructor() {
            this.assets = {
                brain: '/static/images/organs/brain.png',
                heart: '/static/images/organs/heart.png',
                liver: '/static/images/organs/liver.png',
                lungs: '/static/images/organs/lungs.png',
                stomach: '/static/images/organs/stomach.png'
            };
            this.images = {};
            this.loaded = false;
            this.fadeStartTime = null;
            this.isFading = false;
        }

        async preload() {
            const promises = Object.entries(this.assets).map(([key, src]) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = src;
                    img.onload = () => {
                        const processed = this.ensureTransparency(img, key);
                        this.images[key] = processed;
                        if (processed instanceof HTMLCanvasElement) {
                            this.assets[key] = processed.toDataURL('image/png');
                        }
                        resolve();
                    };
                    img.onerror = (err) => {
                        console.error(`Failed to load organ asset: ${src}`, err);
                        resolve(); // Resolve anyway to not break entire app if one image fails
                    };
                });
            });
            await Promise.all(promises);
            this.loaded = true;
        }

        ensureTransparency(img, name) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return img;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0);

                const imgData = ctx.getImageData(0, 0, img.width, img.height);
                const data = imgData.data;

                // 1. Check transparency ratio
                let transparentPixels = 0;
                const totalPixels = img.width * img.height;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] < 200) {
                        transparentPixels++;
                    }
                }
                const transparencyRatio = transparentPixels / totalPixels;

                // 2. Sample corner pixels to detect solid backgrounds
                const getPixel = (x, y) => {
                    const idx = (y * img.width + x) * 4;
                    return {
                        r: data[idx],
                        g: data[idx+1],
                        b: data[idx+2],
                        a: data[idx+3]
                    };
                };

                const corners = [
                    getPixel(0, 0),
                    getPixel(img.width - 1, 0),
                    getPixel(0, img.height - 1),
                    getPixel(img.width - 1, img.height - 1)
                ];

                const allCornersOpaque = corners.every(p => p.a > 240);
                const avgR = Math.round(corners.reduce((sum, p) => sum + p.r, 0) / 4);
                const avgG = Math.round(corners.reduce((sum, p) => sum + p.g, 0) / 4);
                const avgB = Math.round(corners.reduce((sum, p) => sum + p.b, 0) / 4);

                const colorVariance = corners.reduce((sum, p) => {
                    return sum + Math.abs(p.r - avgR) + Math.abs(p.g - avgG) + Math.abs(p.b - avgB);
                }, 0) / 4;

                const hasOpaqueBackground = allCornersOpaque && (colorVariance < 15);
                const isCorruptedOpaque = transparencyRatio < 0.005;

                if (hasOpaqueBackground || isCorruptedOpaque) {
                    console.log(`PulseVision AI Dynamic Transparency Engine: Processing organ '${name}'`);
                    console.log(`Detected background color: rgb(${avgR}, ${avgG}, ${avgB})`);

                    const threshold1 = 20; // Distance threshold for full transparency
                    const threshold2 = 50; // Distance threshold for soft alpha feathering

                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i+1];
                        const b = data[i+2];
                        const a = data[i+3];

                        const dist = Math.sqrt((r - avgR)**2 + (g - avgG)**2 + (b - avgB)**2);

                        if (dist < threshold1) {
                            data[i+3] = 0;
                        } else if (dist < threshold2) {
                            const ratio = (dist - threshold1) / (threshold2 - threshold1);
                            const newAlpha = Math.round(a * ratio);
                            if (newAlpha < data[i+3]) {
                                data[i+3] = newAlpha;
                            }
                        }
                    }
                    ctx.putImageData(imgData, 0, 0);
                    return canvas;
                }
                
                return img;
            } catch (err) {
                console.error(`Error processing transparency for ${name}:`, err);
                return img;
            }
        }

        startFade() {
            this.fadeStartTime = Date.now();
            this.isFading = true;
        }

        getFadeOpacity() {
            if (!this.isFading) return 0.6; // default opacity
            const elapsed = Date.now() - this.fadeStartTime;
            const duration = 500; // 500ms fade duration
            if (elapsed >= duration) {
                this.isFading = false;
                return 0.6;
            }
            return (elapsed / duration) * 0.6;
        }

        // Render for static images in DOM
        renderDOM(container, coordinates, width, height, selectedOrganId, onOrganClick) {
            if (!this.loaded || !container) return;

            // Ensure container is empty
            container.innerHTML = '';

            const organsList = ['left_lung', 'right_lung', 'liver', 'stomach', 'heart', 'brain'];
            const organCoords = getOrganCoordinates(coordinates);

            organsList.forEach(organId => {
                const bbox = organCoords[organId];
                if (!bbox) return;

                const [x1, y1, x2, y2] = bbox;
                const leftPercent = (x1 / width) * 100;
                const topPercent = (y1 / height) * 100;
                const widthPercent = ((x2 - x1) / width) * 100;
                const heightPercent = ((y2 - y1) / height) * 100;

                const wrapper = document.createElement('div');
                wrapper.className = 'anatomy-organ-wrapper';
                wrapper.dataset.organ = organId;
                wrapper.style.left = `${leftPercent}%`;
                wrapper.style.top = `${topPercent}%`;
                wrapper.style.width = `${widthPercent}%`;
                wrapper.style.height = `${heightPercent}%`;

                if (organId === selectedOrganId) {
                    wrapper.classList.add('selected');
                }

                const img = document.createElement('img');
                if (organId === 'left_lung' || organId === 'right_lung') {
                    wrapper.classList.add('split-lung');
                    img.src = this.assets.lungs;
                } else {
                    img.src = this.assets[organId];
                }
                img.alt = organId;
                wrapper.appendChild(img);

                // Click listener
                wrapper.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (onOrganClick) onOrganClick(organId);
                });

                container.appendChild(wrapper);
            });
        }

        // Render for live webcam on Canvas
        renderCanvas(ctx, coordinates, canvasWidth, canvasHeight, selectedOrganId) {
            if (!this.loaded) return;

            const organsList = ['left_lung', 'right_lung', 'liver', 'stomach', 'heart', 'brain'];
            const organCoords = getOrganCoordinates(coordinates);
            const opacity = this.getFadeOpacity();

            organsList.forEach(organId => {
                const bbox = organCoords[organId];
                if (!bbox) return;

                const [x1, y1, x2, y2] = bbox;
                const w = x2 - x1;
                const h = y2 - y1;
                if (w <= 0 || h <= 0) return;

                const isSelected = organId === selectedOrganId;
                ctx.save();

                // Set drawing opacity (selected gets 0.95, others get animated/default opacity)
                ctx.globalAlpha = isSelected ? 0.95 : opacity;

                // Enable high-quality image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Apply selected glow style on Canvas
                if (isSelected) {
                    ctx.shadowColor = organColors[organId] || '#00f2fe';
                    ctx.shadowBlur = 20;
                }

                if (organId === 'left_lung' || organId === 'right_lung') {
                    const img = this.images.lungs;
                    if (img) {
                        if (organId === 'right_lung') {
                            // Left half of image (viewer's left)
                            ctx.drawImage(img, 0, 0, img.width / 2, img.height, x1, y1, w, h);
                        } else {
                            // Right half of image (viewer's right)
                            ctx.drawImage(img, img.width / 2, 0, img.width / 2, img.height, x1, y1, w, h);
                        }
                    }
                } else {
                    const img = this.images[organId];
                    if (img) {
                        ctx.drawImage(img, x1, y1, w, h);
                    }
                }

                ctx.restore();
            });
        }
    }

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
    const viewModeBodyBtn = document.getElementById('view-mode-body-btn');
    const viewModeAnatomyBtn = document.getElementById('view-mode-anatomy-btn');

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
    let currentViewMode = 'body'; // 'body' or 'anatomy'
    let selectedOrgan = null;
    const organOverlay = new OrganOverlay();
    organOverlay.preload().catch(err => console.error("Preloading organs failed", err));
    
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

    const organColors = {
        brain: '#ff5e97',     // Pinkish Red
        heart: '#ff3838',     // Crimson Red
        left_lung: '#00d2ff', // Cyan/electric blue
        right_lung: '#00d2ff',
        liver: '#c54a4a',     // Brownish red
        stomach: '#ffd32a'    // Amber gold
    };

    const bodyPartGroups = {
        head: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        chest: [11, 12, 23, 24],
        left_arm: [11, 13, 15, 17, 19, 21],
        right_arm: [12, 14, 16, 18, 20, 22],
        left_leg: [23, 25, 27, 29, 31],
        right_leg: [24, 26, 28, 30, 32]
    };

    const organRelativeBoxes = {
        brain: { parent: 'head', rx: 0.25, ry: 0.15, rw: 0.5, rh: 0.55 },
        heart: { parent: 'chest', rx: 0.43, ry: 0.22, rw: 0.14, rh: 0.16 },
        left_lung: { parent: 'chest', rx: 0.53, ry: 0.15, rw: 0.22, rh: 0.35 },
        right_lung: { parent: 'chest', rx: 0.25, ry: 0.15, rw: 0.22, rh: 0.35 },
        liver: { parent: 'chest', rx: 0.25, ry: 0.52, rw: 0.23, rh: 0.15 },
        stomach: { parent: 'chest', rx: 0.48, ry: 0.52, rw: 0.25, rh: 0.18 }
    };

    function getOrganCoordinates(parentCoordinates) {
        if (!parentCoordinates) return {};
        const organCoords = {};
        for (const [organId, config] of Object.entries(organRelativeBoxes)) {
            const parentBox = parentCoordinates[config.parent];
            if (parentBox) {
                const [px1, py1, px2, py2] = parentBox;
                const p_w = px2 - px1;
                const p_h = py2 - py1;
                const x1 = Math.round(px1 + config.rx * p_w);
                const y1 = Math.round(py1 + config.ry * p_h);
                const x2 = Math.round(x1 + config.rw * p_w);
                const y2 = Math.round(y1 + config.rh * p_h);
                organCoords[organId] = [x1, y1, x2, y2];
            }
        }
        return organCoords;
    }

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

    // Organ Medical Knowledge Base
    const organKnowledge = {
        brain: {
            name: "Brain",
            badge: "Cranial Vault",
            description: "The primary organ of the human nervous system, serving as the command center for all cognitive, sensory, and motor functions.",
            functions: [
                "Processes sensory information (vision, sound, touch, taste, smell).",
                "Controls voluntary motor movements, coordination, and balance.",
                "Manages higher cognitive functions including thought, memory, emotion, and speech.",
                "Regulates autonomic bodily functions (breathing, heart rate, temperature)."
            ],
            conditions: [
                "Stroke (Ischemic/Hemorrhagic CVA)",
                "Alzheimer's Disease and Dementia",
                "Traumatic Brain Injury (Concussions)",
                "Brain Tumors and Meningitis"
            ],
            anatomy: [
                "Cerebrum: Divided into two hemispheres, responsible for reasoning and learning.",
                "Cerebellum: Situated at the base, coordinates muscle activity and posture.",
                "Brainstem: Connects to the spinal cord, controlling life-sustaining reflexes."
            ],
            vitals: {
                neuroStatus: "Neurological Status: Normal",
                consciousness: "Consciousness Level: GCS 15 (Alert/Oriented)"
            }
        },
        heart: {
            name: "Heart",
            badge: "Cardiovascular",
            description: "A muscular organ located in the middle mediastinum that acts as a dual-pump to circulate blood throughout the body.",
            functions: [
                "Pumps oxygenated blood to body tissues via the systemic circulation.",
                "Sends deoxygenated blood to the lungs for gas exchange via pulmonary circulation.",
                "Maintains systemic blood pressure and regulates blood flow velocity."
            ],
            conditions: [
                "Coronary Artery Disease",
                "Heart Failure",
                "Arrhythmia",
                "Myocardial Infarction (Heart Attack)"
            ],
            anatomy: [
                "Atria: Upper chambers (left and right) receiving incoming blood.",
                "Ventricles: Lower chambers (left and right) pumping blood out.",
                "Myocardium: The thick muscular middle layer responsible for contractions."
            ],
            vitals: {
                rate: "Heart Rate: 72 bpm",
                pressure: "Blood Pressure: 120/80 mmHg",
                cardiacStatus: "Cardiac Status: Normal Sinus Rhythm"
            }
        },
        left_lung: {
            name: "Left Lung",
            badge: "Respiratory",
            description: "The left respiratory organ situated in the thoracic cavity, slightly smaller than the right to accommodate the heart.",
            functions: [
                "Facilitates inhalation of oxygen and exhalation of carbon dioxide.",
                "Assists in maintaining the body's acid-base balance (pH regulation).",
                "Filters out minor blood clots and air bubbles from circulation."
            ],
            conditions: [
                "Pneumonia",
                "Chronic Obstructive Pulmonary Disease (COPD)",
                "Asthma",
                "Pneumothorax (Collapsed Lung)"
            ],
            anatomy: [
                "Superior & Inferior Lobes: Two lobes divided by the oblique fissure.",
                "Cardiac Notch: A concave indentation on the anterior border accommodating the apex of the heart.",
                "Alveoli: Tiny air sacs where microscopic gas exchange occurs."
            ],
            vitals: {
                oxygen: "Oxygen Saturation: 98%",
                respRate: "Respiratory Rate: 16 br/min",
                lungStatus: "Lung Status: Clear Bilaterally"
            }
        },
        right_lung: {
            name: "Right Lung",
            badge: "Respiratory",
            description: "The right respiratory organ situated in the thoracic cavity, larger and heavier than the left lung.",
            functions: [
                "Facilitates intake of oxygen and disposal of carbon dioxide.",
                "Assists in pH blood regulation and respiration mechanics.",
                "Filters out microemboli from pulmonary venous flow."
            ],
            conditions: [
                "Pneumonia",
                "COPD and Emphysema",
                "Asthma",
                "Pulmonary Embolism"
            ],
            anatomy: [
                "Three Lobes: Superior, middle, and inferior lobes, separated by horizontal and oblique fissures.",
                "Bronchial Tree: Division of primary, secondary, and tertiary bronchi.",
                "Alveoli: Millions of capillary-wrapped sacs performing gas exchange."
            ],
            vitals: {
                oxygen: "Oxygen Saturation: 98%",
                respRate: "Respiratory Rate: 16 br/min",
                lungStatus: "Lung Status: Clear Bilaterally"
            }
        },
        liver: {
            name: "Liver",
            badge: "Gastrointestinal / Endocrine",
            description: "The largest internal organ and gland in the human body, performing hundreds of essential metabolic functions.",
            functions: [
                "Metabolizes proteins, lipids, and carbohydrates.",
                "Detoxifies chemicals, metabolizes drugs, and filters blood from the digestive tract.",
                "Produces bile essential for lipid emulsification and absorption.",
                "Stores glycogen, vitamins (A, D, E, K), and essential minerals."
            ],
            conditions: [
                "Cirrhosis and Fatty Liver Disease (NAFLD)",
                "Hepatitis (A, B, C)",
                "Hepatocellular Carcinoma (Liver Cancer)",
                "Jaundice and Hemochromatosis"
            ],
            anatomy: [
                "Lobes: Divided into a large right lobe, a smaller left lobe, and caudate/quadrate lobes.",
                "Hepatic Portal System: Receives nutrient-rich blood directly from the stomach and intestines.",
                "Hepatocytes: Specialized cells performing the metabolic, endocrine, and secretory functions."
            ],
            vitals: {
                liverFunction: "Liver Function: Normal (AST/ALT in range)",
                status: "Status: Unobstructed"
            }
        },
        stomach: {
            name: "Stomach",
            badge: "Gastrointestinal",
            description: "A J-shaped muscular organ that receives food from the esophagus, acting as a temporary storage and digestion chamber.",
            functions: [
                "Mechanically churns food, mixing it with gastric juices to form chyme.",
                "Initiates protein digestion using pepsin and hydrochloric acid.",
                "Gradually releases digested chyme into the duodenum.",
                "Destroys ingested pathogens via highly acidic environment."
            ],
            conditions: [
                "Gastritis and Peptic Ulcer Disease",
                "Gastroesophageal Reflux Disease (GERD)",
                "Gastroparesis",
                "Stomach Cancer"
            ],
            anatomy: [
                "Cardia, Fundus, Body, and Pylorus: The four main structural regions.",
                "Rugae: Muscular internal folds that stretch to expand the stomach's volume.",
                "Pyloric Sphincter: A muscular valve controlling chyme outflow into the small intestine."
            ],
            vitals: {
                digestiveStatus: "Digestive Status: Active peristalsis",
                status: "Status: Normal pH"
            }
        }
    };

    // Label mapping helper for displaying organ vitals dynamically
    const vitalsLabels = {
        rate: 'Heart Rate',
        pressure: 'Blood Pressure',
        oxygen: 'Oxygen Saturation',
        respRate: 'Respiratory Rate',
        cardiacStatus: 'Cardiac Status',
        lungStatus: 'Lung Status',
        neuroStatus: 'Neurological Status',
        consciousness: 'Consciousness Level',
        liverFunction: 'Liver Function',
        digestiveStatus: 'Digestive Status',
        status: 'Status'
    };

    // Update the information side panel
    function updateInfoPanel(partId) {
        if (!infoPanelContent) return;

        const data = currentViewMode === 'body' ? bodyPartKnowledge[partId] : organKnowledge[partId];
        const activeColors = currentViewMode === 'body' ? bodyPartColors : organColors;

        if (!partId || !data) {
            infoPanelContent.innerHTML = `
                <div class="info-placeholder">
                    <div class="pulse-icon">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                    </div>
                    <h3>${currentViewMode === 'body' ? 'Anatomy Explorer' : 'Organ Explorer'}</h3>
                    <p>Select a ${currentViewMode === 'body' ? 'body part' : 'internal organ'} to view information.</p>
                </div>
            `;
            return;
        }

        const color = activeColors[partId] || '#00f2fe';
        
        let organsOrAnatomyHtml = '';
        if (currentViewMode === 'body') {
            const organsLabel = data.isOrgan ? 'Major Organs & Structures' : 'Muscles & Bones';
            organsOrAnatomyHtml = `
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
            `;
        } else {
            // Anatomy/Organ mode: show Anatomy Information
            organsOrAnatomyHtml = `
                <div class="info-section">
                    <h4>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                            <line x1="15" y1="3" x2="15" y2="21"></line>
                            <line x1="3" y1="9" x2="21" y2="9"></line>
                            <line x1="3" y1="15" x2="21" y2="15"></line>
                        </svg>
                        Anatomy Information
                    </h4>
                    <ul>
                        ${data.anatomy.map(a => `<li>${a}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Generate Vitals section if applicable
        let vitalsHtml = '';
        if (currentViewMode === 'anatomy' && data.vitals) {
            vitalsHtml = `
                <div class="info-section">
                    <h4>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                        Clinical Vitals (Demo)
                    </h4>
                    <div class="vitals-container">
                        <div class="vitals-grid">
                            ${Object.entries(data.vitals).map(([key, value]) => {
                                const title = vitalsLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                const displayValue = value.includes(': ') ? value.split(': ')[1] : value;
                                return `
                                    <div class="vitals-card">
                                        <span class="vitals-card-title">${title}</span>
                                        <span class="vitals-card-value">${displayValue}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <p class="vitals-disclaimer">
                            Current PulseVision AI uses pose estimation only. Real vitals require medical sensors or specialized physiological monitoring models.
                        </p>
                    </div>
                </div>
            `;
        }

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
                
                ${organsOrAnatomyHtml}
                
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

                ${vitalsHtml}
            </div>
        `;
    }

    // Select body part and update UI states
    function selectBodyPart(partId) {
        selectedBodyPart = partId;
        updateInfoPanel(partId);

        // Update static image bboxes and overlays
        if (latestApiResponse && latestApiResponse.coordinates) {
            positionAllBboxes(latestApiResponse.coordinates);
        }

        // Highlight table row
        document.querySelectorAll('#metrics-table tbody tr').forEach(row => {
            row.classList.remove('selected-row');
            if (row.dataset.partId === partId) {
                row.classList.add('selected-row');
            }
        });
    }

    // Select organ and update UI states
    function selectOrgan(organId) {
        selectedOrgan = organId;
        updateInfoPanel(organId);

        // Update static image bboxes and overlays
        if (latestApiResponse && latestApiResponse.coordinates) {
            positionAllBboxes(latestApiResponse.coordinates);
        }

        // Highlight table row
        document.querySelectorAll('#metrics-table tbody tr').forEach(row => {
            row.classList.remove('selected-row');
            if (row.dataset.partId === organId) {
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
        const organs = ['brain', 'heart', 'left_lung', 'right_lung', 'liver', 'stomach'];

        const anatomyOverlay = document.getElementById('anatomy-overlay');
        const coordHighlights = document.getElementById('coord-highlights');

        if (currentViewMode === 'body') {
            // Body Mode active: show boxes, hide organ overlays
            if (anatomyOverlay) {
                anatomyOverlay.classList.remove('active');
                anatomyOverlay.innerHTML = '';
            }
            if (coordHighlights) {
                coordHighlights.classList.add('active');
            }

            // Disable and hide inactive (organs)
            organs.forEach(partId => {
                const highlightBox = document.getElementById(`highlight-${partId}`);
                if (highlightBox) {
                    highlightBox.classList.remove('detected', 'selected');
                }
            });

            // Position and display active body parts
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
        } else {
            // Anatomy Mode active: hide boxes, render organ overlays
            if (coordHighlights) {
                coordHighlights.classList.remove('active');
                // Hide all bounding box highlights
                bodyParts.concat(organs).forEach(partId => {
                    const highlightBox = document.getElementById(`highlight-${partId}`);
                    if (highlightBox) {
                        highlightBox.classList.remove('detected', 'selected');
                    }
                });
            }

            if (anatomyOverlay) {
                anatomyOverlay.classList.add('active');
                // Render DOM elements using OrganOverlay helper
                organOverlay.renderDOM(anatomyOverlay, coordinates, width, height, selectedOrgan, (clickedOrganId) => {
                    selectOrgan(clickedOrganId);
                });
            }
        }
    }

    // Reset selected states
    function resetSelectedBodyPart() {
        selectedBodyPart = null;
        selectedOrgan = null;
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

    // View Mode Toggle Listeners
    viewModeBodyBtn.addEventListener('click', () => switchViewMode('body'));
    viewModeAnatomyBtn.addEventListener('click', () => switchViewMode('anatomy'));

    function switchViewMode(mode) {
        if (currentViewMode === mode) return;
        currentViewMode = mode;

        if (mode === 'body') {
            viewModeBodyBtn.classList.add('active');
            viewModeAnatomyBtn.classList.remove('active');
        } else {
            viewModeAnatomyBtn.classList.add('active');
            viewModeBodyBtn.classList.remove('active');
            organOverlay.startFade();
        }

        // Reset selections to avoid visual mismatches
        resetSelectedBodyPart();

        // If we have active coordinates (e.g. from static image results or active webcam results), refresh the UI
        if (latestApiResponse && latestApiResponse.coordinates) {
            setupTable(latestApiResponse.coordinates);
            positionAllBboxes(latestApiResponse.coordinates);
        }
    }

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
            }
        }

        // Live update the table coordinate logs and canvas highlights based on View Mode
        if (currentViewMode === 'body') {
            for (const [part, bbox] of Object.entries(currentCoordinates)) {
                const xMin = bbox[0];
                const yMin = bbox[1];
                const xMax = bbox[2];
                const yMax = bbox[3];
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
        } else {
            // Anatomy Mode: Draw translucent organ images on Canvas
            organOverlay.renderCanvas(ctx, currentCoordinates, width, height, selectedOrgan);
        }

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

        const organs = [
            { id: 'brain', label: 'Brain' },
            { id: 'heart', label: 'Heart' },
            { id: 'left_lung', label: 'Left Lung' },
            { id: 'right_lung', label: 'Right Lung' },
            { id: 'liver', label: 'Liver' },
            { id: 'stomach', label: 'Stomach' }
        ];

        const activeParts = currentViewMode === 'body' ? bodyParts : organs;
        const activeCoords = currentViewMode === 'body' ? coordinates : getOrganCoordinates(coordinates);
        const activeColors = currentViewMode === 'body' ? bodyPartColors : organColors;
        const selectedId = currentViewMode === 'body' ? selectedBodyPart : selectedOrgan;

        // Dynamic Localization Rate Counter
        const totalDetected = Object.keys(activeCoords).length;
        if (detectionCount) {
            detectionCount.innerHTML = `${totalDetected}/6 <span>${currentViewMode === 'body' ? 'regions' : 'organs'} mapped</span>`;
            detectionCount.style.color = totalDetected === 0 ? 'var(--accent-red)' : 'var(--accent-teal)';
        }

        activeParts.forEach(part => {
            const tr = document.createElement('tr');
            tr.dataset.partId = part.id;
            
            const isDetected = activeCoords[part.id] !== undefined && activeCoords[part.id] !== null;
            const bbox = isDetected ? activeCoords[part.id] : null;
            
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
            if (part.id === selectedId) {
                tr.classList.add('selected-row');
                tr.style.setProperty('--part-color', activeColors[part.id]);
            }

            // Click interaction
            if (isDetected) {
                tr.addEventListener('click', () => {
                    if (currentViewMode === 'body') {
                        selectBodyPart(part.id);
                    } else {
                        selectOrgan(part.id);
                    }
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
            if (currentViewMode === 'body') {
                selectBodyPart(partId);
            } else {
                selectOrgan(partId);
            }
        });
    });

    // Ray-cast click events on the Live Webcam Canvas to select body parts or organs
    webcamCanvas.addEventListener('click', (e) => {
        if (currentMode !== 'webcam' || !isWebcamStreaming) return;
        if (!latestApiResponse || !latestApiResponse.coordinates) return;

        const rect = webcamCanvas.getBoundingClientRect();
        // Translate client mouse click (viewport coordinates) to canvas internal resolution
        const clickX = ((e.clientX - rect.left) / rect.width) * webcamCanvas.width;
        const clickY = ((e.clientY - rect.top) / rect.height) * webcamCanvas.height;

        const bodyParts = ['head', 'chest', 'left_arm', 'right_arm', 'left_leg', 'right_leg'];
        const organs = ['brain', 'heart', 'left_lung', 'right_lung', 'liver', 'stomach'];

        const activeSet = currentViewMode === 'body' ? bodyParts : organs;
        const activeCoords = currentViewMode === 'body' ? latestApiResponse.coordinates : getOrganCoordinates(latestApiResponse.coordinates);

        let clickedPart = null;
        for (const part of activeSet) {
            const bbox = activeCoords[part];
            if (bbox) {
                const [x1, y1, x2, y2] = bbox;
                if (clickX >= x1 && clickX <= x2 && clickY >= y1 && clickY <= y2) {
                    clickedPart = part;
                    break;
                }
            }
        }

        if (clickedPart) {
            if (currentViewMode === 'body') {
                selectBodyPart(clickedPart);
            } else {
                selectOrgan(clickedPart);
            }
        }
    });
});
