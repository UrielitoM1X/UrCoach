import { Controller } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"

export default class extends Controller {
    // Añadimos el canvas como target
    static targets = [ "video", "canvas" ]

    connect() {
        console.log("Controlador de Biomecánica Inicializado.");
        this.ctx = this.canvasTarget.getContext("2d");
        
        // Variables para controlar el conteo de repeticiones de sentadillas
        this.contadorReps = 0;
        this.enSentadilla = false; // Bandera para saber si está abajo
        
        // Almacenes de datos biomecánicos
        this.ultimoRatio = 0.0;
        this.tipoPalanca = "No detectado";

        this.initPose();
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

        drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#10B981', lineWidth: 4 });
        drawLandmarks(this.ctx, results.poseLandmarks, { color: '#3B82F6', lineWidth: 2, radius: 5 });

        const landmarks = results.poseLandmarks;
        const hombro = landmarks[11];
        const cadera = landmarks[23];
        const rodilla = landmarks[25];
        const tobillo = landmarks[27];

        if (hombro.visibility > 0.5 && cadera.visibility > 0.5 && rodilla.visibility > 0.5 && tobillo.visibility > 0.5) {
            
            let longitudTorso = this.calcularDistancia(hombro, cadera);
            let longitudFemur = this.calcularDistancia(cadera, rodilla);
            this.ultimoRatio = longitudFemur / longitudTorso;
            this.tipoPalanca = this.ultimoRatio > 0.85 ? "Femur Largo" : "Femur Corto";

            let anguloRodilla = this.calcularAngulo(cadera, rodilla, tobillo);

            // --- LÓGICA DE CONTEO DE REPETICIONES VÁLIDAS ---
            // Si el ángulo baja de 100 grados y no estábamos registrados abajo, entra a la zona de repetición
            if (anguloRodilla <= 100 && !this.enSentadilla) {
                this.enSentadilla = true;
                document.getElementById("estado-ia").innerText = "Abajo (Zona Válida)";
                document.getElementById("estado-ia").className = "text-emerald-400";
            }
            
            // Si vuelve a subir de 150 grados (pierna casi estirada) estando abajo, cuenta la repetición
            if (anguloRodilla >= 150 && this.enSentadilla) {
                this.contadorReps++;
                this.enSentadilla = false;
                document.getElementById("contador-reps").innerText = this.contadorReps;
                document.getElementById("estado-ia").innerText = "¡Repetición Completada!";
                document.getElementById("estado-ia").className = "text-blue-400";
            }

            // Pintar textos en Canvas
            this.ctx.fillStyle = "#FFFFFF";
            this.ctx.font = "bold 16px sans-serif";
            let textX = (1 - rodilla.x) * this.canvasTarget.width + 20;
            let textY = rodilla.y * this.canvasTarget.height;
            this.ctx.fillText(`${Math.round(anguloRodilla)}°`, textX, textY);

            if (anguloRodilla <= 100) {
                this.ctx.fillStyle = "#10B981";
                this.ctx.fillText("¡BUENA PROFUNDIDAD!", 20, 40);
            } else if (!this.enSentadilla) {
                this.ctx.fillStyle = "#EF4444";
                this.ctx.fillText("BAJA MÁS", 20, 40);
            }
        }
    }

    async apagar() {
        this.active = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.videoTarget.srcObject = null;
            this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height);
            document.getElementById("estado-ia").innerText = "Procesando Serie...";
            
            // --- ENVIAR LOS DATOS AL BACKEND VIA TURBO STREAM ---
            await this.enviarDatosAlServidor();
        }
    }

    async enviarDatosAlServidor() {
        // Formateamos los datos como un formulario clásico (lo que FastAPI espera)
        const formData = new FormData();
        formData.append("reps", this.contadorReps);
        formData.append("ratio", this.ultimoRatio.toFixed(2));
        formData.append("tipo_palanca", this.tipoPalanca);

        try {
            const response = await fetch("/guardar-entrenamiento", {
                method: "POST",
                body: formData,
                headers: {
                    // Esta cabecera es crucial para que el navegador entienda que va a recibir un fragmento de Hotwire Turbo
                    "Accept": "text/vnd.turbo-stream.html"
                }
            });

            if (response.ok) {
                const htmlResponse = await response.text();
                // Turbo procesa el fragmento HTML y actualiza el DOM automáticamente
                Turbo.renderStreamMessage(htmlResponse);
                
                // Reiniciamos contadores locales para la siguiente serie
                this.contadorReps = 0;
                document.getElementById("contador-reps").innerText = "0";
                document.getElementById("estado-ia").innerText = "Serie Guardada";
            }
        } catch (error) {
            console.error("Error al sincronizar con el servidor:", error);
            document.getElementById("estado-ia").innerText = "Error de Conexión";
        }
    }

    disconnect() {
        this.apagar();
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