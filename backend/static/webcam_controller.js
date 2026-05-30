import { Controller } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"

export default class extends Controller {
    // Añadimos el canvas como target
    static targets = [ "video", "canvas" ]

    connect() {
        console.log("Controlador cargado. Inicializando MediaPipe Pose...")
        this.ctx = this.canvasTarget.getContext("2d")
        this.initPose()
    }

    // Configura el modelo de MediaPipe
    initPose() {
        this.pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        })

        // Configuraciones de la IA (Balance entre velocidad y precisión)
        this.pose.setOptions({
            modelComplexity: 1, // 0 = rápido, 1 = medio, 2 = pesado (1 es perfecto para laptops)
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        })

        // Le decimos qué hacer cuando detecte un esqueleto
        this.pose.onResults((results) => this.dibujarEsqueleto(results))
    }

    async encender() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                })
                this.videoTarget.srcObject = this.stream
                
                // Iniciamos el bucle que le envía fotogramas a la IA
                this.active = true
                this.predictLoop()
                
                console.log("Cámara e IA encendidas")
            } catch (error) {
                console.error("Error al acceder a la cámara web:", error)
            }
        }
    }

    // Bucle infinito optimizado para procesar video frame por frame
    async predictLoop() {
        if (!this.active) return

        // Si el video está listo y tiene datos, procesa el frame
        if (this.videoTarget.readyState >= 2) {
            await this.pose.send({ image: this.videoTarget })
        }

        // Vuelve a llamarse a sí mismo en el siguiente frame de la pantalla
        requestAnimationFrame(() => this.predictLoop())
    }

    // Esta función dibuja los puntos y líneas en el Canvas
    dibujarEsqueleto(results) {
        this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height);

        if (!results.poseLandmarks) return;

        // Dibujar el esqueleto de MediaPipe primero
        drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#10B981', lineWidth: 4 });
        drawLandmarks(this.ctx, results.poseLandmarks, { color: '#3B82F6', lineWidth: 2, radius: 5 });

        // --- MÓDULO BIOMECÁNICO ---
        const landmarks = results.poseLandmarks;

        // Usaremos el perfil izquierdo del usuario (puedes cambiarlo al derecho si gustas)
        const hombro = landmarks[11];
        const cadera = landmarks[23];
        const rodilla = landmarks[25];
        const tobillo = landmarks[27];

        // Verificar que los puntos sean visibles en pantalla (visibilidad > 50%)
        if (hombro.visibility > 0.5 && cadera.visibility > 0.5 && rodilla.visibility > 0.5 && tobillo.visibility > 0.5) {
            
            // 1. CÁLCULO DE PALANCAS (Ratios relativos)
            let longitudTorso = this.calcularDistancia(hombro, cadera);
            let longitudFemur = this.calcularDistancia(cadera, rodilla);
            
            let ratioFemurTorso = longitudFemur / longitudTorso;

            // 2. CÁLCULO DE TÉCNICA (Ángulo de la rodilla)
            let anguloRodilla = this.calcularAngulo(cadera, rodilla, tobillo);

            // 3. PINTAR INFORMACIÓN EN EL CANVAS
            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "bold 16px sans-serif";
            
            // Mostrar Ángulo de la Rodilla
            // Ajustamos las coordenadas para que se pinte cerca de la rodilla real del usuario
            let textX = (1 - rodilla.x) * this.canvasTarget.width + 20; // Invertido por el espejo
            let textY = rodilla.y * this.canvasTarget.height;
            
            this.ctx.fillText(`${Math.round(anguloRodilla)}°`, textX, textY);

            // Alerta visual de técnica (Sentadilla profunda / Romper paralelo)
            if (anguloRodilla <= 90) {
                this.ctx.fillStyle = "#10B981"; // Verde si rompe paralelo
                this.ctx.fillText("¡BUENA PROFUNDIDAD!", 20, 40);
            } else {
                this.ctx.fillStyle = "#EF4444"; // Rojo si está arriba
                this.ctx.fillText("BAJA MÁS", 20, 40);
            }

            // Mostrar diagnóstico de palancas básico en la esquina
            this.ctx.fillStyle = "#9CA3AF";
            this.ctx.font = "14px sans-serif";
            this.ctx.fillText(`Ratio Fémur/Torso: ${ratioFemurTorso.toFixed(2)}`, 20, 70);
            
            if (ratioFemurTorso > 0.85) {
                this.ctx.fillStyle = "#F59E0B"; // Ámbar
                this.ctx.fillText("Palancas: Fémur Largo (Sentadilla Demandante)", 20, 90);
            } else {
                this.ctx.fillStyle = "#34D399"; // Esmeralda claro
                this.ctx.fillText("Palancas: Fémur Corto (Sentadilla Favorable)", 20, 90);
            }
        }
    }

    apagar() {
        this.active = false // Detiene el bucle de predicción
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop())
            this.videoTarget.srcObject = null
            // Limpia el canvas al apagar
            this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height)
            console.log("Cámara e IA apagadas")
        }
    }

    disconnect() {
        this.apagar()
    }

    // 1. Calcula la distancia euclidiana entre dos puntos (Longitud del hueso)
    calcularDistancia(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    // 2. Calcula el ángulo interno entre tres puntos (Ej: Cadera -> Rodilla -> Tobillo)
    calcularAngulo(p1, p2, p3) {
        // Vectores entre las articulaciones
        let v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        let v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        // Producto punto y magnitudes
        let dotProduct = v1.x * v2.x + v1.y * v2.y;
        let mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        let mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        // Ángulo en radianes y luego a grados
        let angle = Math.acos(dotProduct / (mag1 * mag2));
        return angle * (180 / Math.PI);
    }
}