console.log('🚀 simple_detection.js loaded');

let video = null;
let faceMesh = null;
let isDetecting = false;
let lastEvent = '';
let lastEventTime = 0;

async function initSimpleDetection() {
    try {
        console.log('═══════════════════════════════════');
        console.log('🎬 DETECTION INITIALIZATION START');
        console.log('═══════════════════════════════════');
        
        // ✅ STEP 1: Find video element
        video = document.getElementById('video');
        console.log('Step 1 - Video element:', video ? '✅ FOUND' : '❌ NOT FOUND');
        
        if (!video) {
            console.error('❌ CRITICAL: Video element #video not found in DOM');
            alert('❌ Error: Video element not found. Cannot start camera.');
            return false;
        }

        // ✅ STEP 2: Request camera permission
        console.log('Step 2 - Requesting camera access...');
        console.log('  User must ALLOW camera access when prompted');
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 }
            },
            audio: false
        });

        console.log('  ✅ Camera permission GRANTED');
        console.log('  Stream tracks:', stream.getVideoTracks().length);

        // ✅ STEP 3: Attach stream to video element
        console.log('Step 3 - Attaching stream to video element...');
        console.log('  Video element properties:');
        console.log(`    - id: ${video.id}`);
        console.log(`    - display: ${window.getComputedStyle(video).display}`);
        console.log(`    - visibility: ${window.getComputedStyle(video).visibility}`);
        console.log(`    - width: ${video.offsetWidth}px, height: ${video.offsetHeight}px`);
        
        video.srcObject = stream;
        console.log('  ✅ Stream attached to video.srcObject');
        
        // CRITICAL: Force play with proper error handling
        console.log('  🎬 Forcing video playback...');
        
        // Add event listeners to debug playback
        video.addEventListener('play', () => {
            console.log('  ✅ PLAY EVENT FIRED - Video is playing');
        });
        
        video.addEventListener('playing', () => {
            console.log('  ✅ PLAYING EVENT FIRED - Video frames flowing');
        });
        
        video.addEventListener('loadedmetadata', () => {
            console.log(`  ✅ LOADEDMETADATA EVENT - Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
        });
        
        video.addEventListener('error', (e) => {
            console.error(`  ❌ VIDEO ERROR: ${e.message}`);
        });
        
        // Set attributes to ensure browser plays it
        video.muted = true;
        video.playsInline = true;
        
        try {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                await playPromise;
                console.log('  ✅ Video.play() promise resolved - Video is playing');
            } else {
                console.log('  ℹ️ video.play() returned undefined (older browser)');
            }
        } catch (e) {
            console.error(`  ❌ VIDEO PLAY FAILED: ${e.name} - ${e.message}`);
            console.error('  Attempting workaround: Setting autoplay attribute');
            video.autoplay = true;
            setTimeout(() => {
                if (video.paused) {
                    console.error('  ❌ Video still paused after autoplay workaround');
                } else {
                    console.log('  ✅ Autoplay workaround succeeded');
                }
            }, 2000);
        }
        
        // Verify video is rendering
        setTimeout(() => {
            console.log('Step 3 - Verifying video state:');
            console.log(`  - readyState: ${video.readyState} (${['HAVE_NOTHING','HAVE_METADATA','HAVE_CURRENT_DATA','HAVE_FUTURE_DATA','HAVE_ENOUGH_DATA'][video.readyState]})`);
            console.log(`  - paused: ${video.paused}`);
            console.log(`  - currentTime: ${video.currentTime}`);
            console.log(`  - duration: ${video.duration}`);
            console.log(`  - videoWidth: ${video.videoWidth}, videoHeight: ${video.videoHeight}`);
            console.log(`  - srcObject exists: ${video.srcObject ? '✅ Yes' : '❌ No'}`);
            console.log(`  - srcObject tracks: ${video.srcObject?.getTracks().length || 0} tracks`);
            
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                console.log('  ✅ Video frames ready!');
            } else {
                console.warn(`  ⚠️ Video not ready yet (waiting for more data)`);
            }
        }, 1500);

        // ✅ STEP 4: Wait for MediaPipe FaceMesh to load
        console.log('Step 4 - Loading MediaPipe FaceMesh...');
        console.log('  Waiting for window.FaceMesh (timeout 15 seconds)...');
        
        let attempts = 0;
        const maxAttempts = 30; // 30 * 500ms = 15 seconds
        
        while (!window.FaceMesh && attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 500));
            attempts++;
            if (attempts % 5 === 0) {
                console.log(`  ⏳ Still waiting... (${attempts * 500}ms)`);
            }
        }

        if (!window.FaceMesh) {
            console.error(`❌ FaceMesh timeout after ${attempts * 500}ms`);
            alert('❌ Error: MediaPipe FaceMesh failed to load from CDN');
            return false;
        }

        console.log(`  ✅ FaceMesh available (loaded in ${attempts * 500}ms)`);

        // ✅ STEP 5: Initialize FaceMesh
        console.log('Step 5 - Initializing FaceMesh...');
        
        faceMesh = new window.FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults(detectHead);
        console.log('  ✅ FaceMesh initialized');

        // ✅ STEP 6: Start frame processing
        console.log('Step 6 - Starting frame processing...');
        isDetecting = true;
        processFrame();
        console.log('  ✅ Frame loop started');
        
        console.log('═══════════════════════════════════');
        console.log('✅ DETECTION FULLY INITIALIZED');
        console.log('═══════════════════════════════════');
        return true;

    } catch (err) {
        console.error('═══════════════════════════════════');
        console.error('❌ DETECTION FAILED');
        console.error('═══════════════════════════════════');
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);
        console.error('Full Error:', err);
        
        if (err.name === 'NotAllowedError') {
            console.error('❌ USER DENIED camera access');
            alert('❌ Camera access denied. Proctoring cannot continue.');
        } else if (err.name === 'NotFoundError') {
            console.error('❌ NO CAMERA FOUND on device');
            alert('❌ No camera found. Please connect a camera.');
        } else {
            alert(`❌ Error: ${err.message}`);
        }
        return false;
    }
}

function processFrame() {
    if (!isDetecting) return;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
            faceMesh.send({ image: video });
        } catch (e) {
            console.warn('⚠️ Frame error:', e.message);
        }
    }

    requestAnimationFrame(processFrame);
}

let lastEvent = '';
let lastEventTime = 0;

function detectHead(results) {
    if (!results.multiFaceLandmarks || !results.multiFaceLandmarks[0]) {
        console.warn('⚠️ No face detected');
        return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // Eye landmarks (eye-based gaze tracking)
    const leftEyeLeft = landmarks[33];
    const leftEyeRight = landmarks[159];
    const rightEyeLeft = landmarks[362];
    const rightEyeRight = landmarks[386];

    // Calculate eye centers
    const leftEyeX = (leftEyeLeft.x + leftEyeRight.x) / 2;
    const rightEyeX = (rightEyeLeft.x + rightEyeRight.x) / 2;
    const eyeAvgX = (leftEyeX + rightEyeX) / 2;

    let event = '';

    // Thresholds for gaze direction
    if (eyeAvgX < 0.4) {
        event = 'LEFT';
    } else if (eyeAvgX > 0.6) {
        event = 'RIGHT';
    } else {
        event = 'CENTER';
    }

    // Update UI
    const statusHead = document.getElementById('statusHead');
    if (statusHead) {
        if (event === 'LEFT') {
            statusHead.innerText = '👈 Looking Left';
        } else if (event === 'RIGHT') {
            statusHead.innerText = '👉 Looking Right';
        } else {
            statusHead.innerText = '✅ Centered';
        }
    }

    // Log LEFT/RIGHT with debounce
    const now = Date.now();
    if ((event === 'LEFT' || event === 'RIGHT') && event !== lastEvent) {
        if (now - lastEventTime > 1000) {
            console.log('📤 Event:', event);
            logEvent(event);
            lastEvent = event;
            lastEventTime = now;
        }
    } else if (event === 'CENTER') {
        lastEvent = '';
    }
}

function detectHeadPose(results) {
    // Alias for compatibility
    detectHead(results);
}

function logEvent(eventType) {
    console.log('══════════════════════════════════');
    console.log('📤 LOGGING EVENT TO DATABASE');
    console.log('══════════════════════════════════');
    
    // Get IDs from DOM
    const studentId = document.getElementById('student_id')?.value;
    const examId = document.getElementById('exam_id')?.value;

    console.log('Event Type:', eventType);
    console.log('Student ID:', studentId);
    console.log('Exam ID:', examId);
    console.log('Exam Started:', window.examStarted);

    // Validation
    if (!studentId) {
        console.error('❌ student_id not found in DOM');
        return;
    }
    
    if (!examId) {
        console.error('❌ exam_id not found in DOM');
        return;
    }

    if (!window.examStarted) {
        console.warn('⚠️ Exam not started - skipping log');
        return;
    }

    // Send to backend
    console.log('📊 Sending to /log_cheating endpoint...');
    
    fetch('/log_cheating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            student_id: parseInt(studentId),
            exam_id: parseInt(examId),
            event_type: eventType,
            severity: 'medium'
        })
    })
    .then(response => {
        console.log('Response Status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('✅ Backend Response:', data);
        console.log('══════════════════════════════════');
    })
    .catch(error => {
        console.error('❌ Fetch Error:', error);
        console.log('══════════════════════════════════');
    });
}

function stopDetection() {
    isDetecting = false;
    if (faceMesh) faceMesh.close();
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    console.log('⛔ Detection stopped');
}

// ============================================================
// DIAGNOSTIC FUNCTION - Call from console: window.cameraDebug()
// ============================================================
window.cameraDebug = function() {
    console.log('\n' + '='.repeat(60));
    console.log('🎥 CAMERA & VIDEO ELEMENT DIAGNOSTIC');
    console.log('='.repeat(60));
    
    // 1. Check video element exists
    const videoElem = document.getElementById('video');
    console.log('\n1️⃣ VIDEO ELEMENT:');
    console.log(`   Exists: ${videoElem ? '✅ YES' : '❌ NO'}`);
    
    if (videoElem) {
        console.log(`   Visible: ${videoElem.offsetHeight > 0 ? '✅ YES (height: ' + videoElem.offsetHeight + 'px)' : '❌ NO (height: 0)'}`);
        console.log(`   Display: ${window.getComputedStyle(videoElem).display}`);
        console.log(`   Visibility: ${window.getComputedStyle(videoElem).visibility}`);
        console.log(`   Position: ${videoElem.offsetLeft}, ${videoElem.offsetTop}`);
        console.log(`   srcObject: ${videoElem.srcObject ? '✅ Stream attached' : '❌ No stream'}`);
        
        if (videoElem.srcObject) {
            const tracks = videoElem.srcObject.getTracks();
            console.log(`   Tracks: ${tracks.length}`);
            tracks.forEach((track, i) => {
                console.log(`     - Track ${i}: ${track.kind}, enabled=${track.enabled}, readyState=${track.readyState}`);
            });
        }
        
        console.log(`   Playback State:`);
        console.log(`     - paused: ${videoElem.paused}`);
        console.log(`     - currentTime: ${videoElem.currentTime}`);
        console.log(`     - readyState: ${videoElem.readyState} (${['HAVE_NOTHING','HAVE_METADATA','HAVE_CURRENT_DATA','HAVE_FUTURE_DATA','HAVE_ENOUGH_DATA'][videoElem.readyState]})`);
        console.log(`     - networkState: ${videoElem.networkState}`);
        console.log(`     - videoWidth: ${videoElem.videoWidth}, videoHeight: ${videoElem.videoHeight}`);
    }
    
    // 2. Check browser camera access
    console.log('\n2️⃣ BROWSER CAMERA ACCESS:');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        console.log(`   getUserMedia: ✅ Available`);
        
        // Try to enumerate devices
        if (navigator.mediaDevices.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                console.log(`   Devices found:`);
                const cameras = devices.filter(d => d.kind === 'videoinput');
                const mics = devices.filter(d => d.kind === 'audioinput');
                console.log(`     - Cameras: ${cameras.length}`);
                cameras.forEach((c, i) => console.log(`       ${i}: ${c.label || 'Unknown'}`));
                console.log(`     - Microphones: ${mics.length}`);
            }).catch(err => {
                console.error(`   Could not enumerate devices: ${err.message}`);
            });
        }
    } else {
        console.log(`   getUserMedia: ❌ Not available`);
    }
    
    // 3. Check MediaPipe
    console.log('\n3️⃣ MEDIAPIPE STATUS:');
    console.log(`   FaceMesh: ${typeof window.FaceMesh !== 'undefined' ? '✅ Loaded' : '❌ Not loaded'}`);
    
    // 4. Test camera access
    console.log('\n4️⃣ TESTING CAMERA ACCESS:');
    console.log('   Attempting getUserMedia (check your browser for permission prompt)...');
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            console.log(`   ✅ CAMERA ACCESS GRANTED!`);
            console.log(`   Got ${stream.getTracks().length} video track(s)`);
            // Stop the test stream
            stream.getTracks().forEach(track => track.stop());
        })
        .catch(err => {
            console.error(`   ❌ CAMERA ACCESS FAILED: ${err.name}`);
            console.error(`   Message: ${err.message}`);
            
            if (err.name === 'NotAllowedError') {
                console.log('   → You denied camera access. Check browser permissions.');
                console.log('   → Chrome: Settings → Privacy → Site Settings → Camera');
            } else if (err.name === 'NotFoundError') {
                console.log('   → No camera found on your system');
            }
        });
    
    console.log('\n' + '='.repeat(60));
    console.log('💡 HOW TO FIX:');
    console.log('   1. Check camera access test above');
    console.log('   2. If denied, enable camera in browser settings');
    console.log('   3. Reload page (Ctrl+R)');
    console.log('   4. Click "Start Exam" button');
    console.log('   5. Allow camera when prompted');
    console.log('='.repeat(60) + '\n');
};

console.log('💡 Run window.cameraDebug() in browser console to diagnose');


window.initSimpleDetection = initSimpleDetection;
window.stopDetection = stopDetection;
