import { Controller } from "https://unpkg.com/@hotwired/stimulus/dist/stimulus.js"

export default class extends Controller {
    static targets = [ "video", "canvas" ]

    connect() {
        this.ctx = this.canvasTarget.getContext("2d");
        this.contadorReps = 0;
        this.enSentadilla = false;
        this.ultimoRatio = 0.0;
        this.tipoPalanca = "No detectado";
        this.stream = null;
        this.active = false;
        
        this.initPose();
    }

    initPose() {
        this.pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        })
        this.pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        })
        this.pose.onResults((results) => this.dibujarEsqueleto(results))
    }

    // FUENTE 1: ENCENDER WEBCAM EN VIVO
    async encenderCamara() {
        this.apagar(); // Limpiamos fuentes previas
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
                this.videoTarget.srcObject = this.stream;
                this.videoTarget.src = ""; // Limpiar paths de archivos cargados
                
                this.mostrarElemento('video');
                document.getElementById("origen-fuente").innerText = "WebCam";
                
                this.active = true;
                this.videoTarget.onloadedmetadata = () => this.predictLoop();
            } catch (error) {
                console.error("Error al arrancar la webcam:", error);
            }
        }
    }

    // FUENTE 2: PROCESAR IMAGEN O VIDEO CARGADO DESDE EL EXPLORADOR
    procesarArchivo(event) {
        this.apagar();
        const file = event.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        document.getElementById("origen-fuente").innerText = file.name.substring(0, 15) + "...";

        if (file.type.startsWith('video/')) {
            // Configurar el video reproductor
            this.videoTarget.srcObject = null;
            this.videoTarget.src = url;
            this.videoTarget.loop = true;
            this.videoTarget.muted = true;
            
            this.mostrarElemento('video');
            this.active = true;
            
            // Forzar play y empezar análisis continuo
            this.videoTarget.play();
            this.videoTarget.onloadeddata = () => this.predictLoop();

        } else if (file.type.startsWith('image/')) {
            const img = document.getElementById('render-image');
            img.src = url;
            this.mostrarElemento('image');
            
            // Las imágenes fijas solo necesitan procesarse un único frame, sin bucles infinitos
            img.onload = async () => {
                document.getElementById("estado-ia").innerText = "PROCESANDO IMAGEN";
                await this.pose.send({ image: img });
                document.getElementById("estado-ia").innerText = "ANÁLISIS COMPLETADO";
            };
        }
    }

    // BUCLE DE ANÁLISIS PARA SECUENCIAS EN MOVIMIENTO (WEBCAM O VIDEO)
    async predictLoop() {
        if (!this.active) return;

        if (this.videoTarget.readyState >= 2) {
            document.getElementById("estado-ia").innerText = "ANALIZANDO CUERPO";
            await this.pose.send({ image: this.videoTarget });
        }
        requestAnimationFrame(() => this.predictLoop());
    }

    // UTILERÍA: INTERCAMBIAR VISIBILIDAD ENTRE ETIQUETA VIDEO E IMAGEN
    mostrarElemento(tipo) {
        if (tipo === 'video') {
            this.videoTarget.classList.remove('hidden');
            document.getElementById('render-image').classList.add('hidden');
        } else {
            document.getElementById('render-image').classList.remove('hidden');
            this.videoTarget.classList.add('hidden');
        }
    }

    dibujarEsqueleto(results) {
        this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height);
        if (!results.poseLandmarks) return;

        drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#18181b', lineWidth: 3 });
        drawLandmarks(this.ctx, results.poseLandmarks, { color: '#2563eb', lineWidth: 1, radius: 4 });

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
            this.ctx.font = "bold 16px sans-serif";

            if (window.currentTab === 'tecnica') {
                if (anguloRodilla <= 100 && !this.enSentadilla) this.enSentadilla = true;
                if (anguloRodilla >= 150 && this.enSentadilla) {
                    this.contadorReps++;
                    this.enSentadilla = false;
                    document.getElementById("contador-reps").innerText = this.contadorReps;
                }

                this.ctx.fillStyle = "#000000";
                let textX = (1 - rodilla.x) * this.canvasTarget.width + 20;
                let textY = rodilla.y * this.canvasTarget.height;
                this.ctx.fillText(`${Math.round(anguloRodilla)}°`, textX, textY);

                if (anguloRodilla <= 100) {
                    this.ctx.fillStyle = "#16a34a";
                    this.ctx.fillText("✓ PROFUNDIDAD CORRECTA", 20, 40);
                } else if (!this.enSentadilla) {
                    this.ctx.fillStyle = "#dc2626";
                    this.ctx.fillText("¡BAJA MÁS!", 20, 40);
                }

            } else if (window.currentTab === 'palancas') {
                this.ctx.fillStyle = "#000000";
                this.ctx.fillText(`Ratio Fémur/Torso: ${this.ultimoRatio.toFixed(2)}`, 20, 40);
                
                if (this.ultimoRatio > 0.85) {
                    this.ctx.fillStyle = "#d97706";
                    this.ctx.fillText("Análisis: Fémur Largo (Sentadilla Demandante)", 20, 65);
                } else {
                    this.ctx.fillStyle = "#16a34a";
                    this.ctx.fillText("Análisis: Fémur Corto (Sentadilla Favorable)", 20, 65);
                }
            }
        }
    }

    calcularDistancia(p1, p2) { return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)); }
    calcularAngulo(p1, p2, p3) {
        let v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        let v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        let dotProduct = v1.x * v2.x + v1.y * v2.y;
        let mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        let mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        return Math.acos(dotProduct / (mag1 * mag2)) * (180 / Math.PI);
    }

    apagar() {
        this.active = false;
        this.videoTarget.pause();
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.videoTarget.srcObject = null;
        this.videoTarget.src = "";
        this.ctx.clearRect(0, 0, this.canvasTarget.width, this.canvasTarget.height);
        document.getElementById("origen-fuente").innerText = "Ninguno";
        document.getElementById("estado-ia").innerText = "ESTADO: INACTIVO";
    }

    async enviarDatosAlServidor() {
        const formData = new FormData();
        formData.append("reps", this.contadorReps);
        formData.append("ratio", this.ultimoRatio.toFixed(2));
        formData.append("tipo_palanca", this.tipoPalanca);

        try {
            const response = await fetch("/guardar-entrenamiento", {
                method: "POST",
                body: formData,
                headers: { "Accept": "text/vnd.turbo-stream.html" }
            });
            if (response.ok) {
                const htmlResponse = await response.text();
                Turbo.renderStreamMessage(htmlResponse);
                this.contadorReps = 0;
                document.getElementById("contador-reps").innerText = "0";
            }
        } catch (error) { console.error("Error de sincronización:", error); }
    }

    disconnect() { this.apagar(); }
}