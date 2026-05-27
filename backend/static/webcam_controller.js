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
        // 1. Limpiamos el canvas del frame anterior
        this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height)

        // Si no hay coordenadas detectadas, no dibuja nada
        if (!results.poseLandmarks) return

        // 2. Dibujamos las conexiones (Huesos) usando la librería de MediaPipe
        drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, {
            color: '#10B981', // Verde esmeralda de Tailwind
            lineWidth: 4
        })

        // 3. Dibujamos los puntos clave (Articulaciones)
        drawLandmarks(this.ctx, results.poseLandmarks, {
            color: '#3B82F6', // Azul de Tailwind
            lineWidth: 2,
            radius: 5
        })
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
}